import type { NoteBase } from '../../../../noteUtils';
import type { KnowledgeIndexService } from '../../KnowledgeIndexService';
import { listAreaNotes } from '../../trace/areaNotes';

export interface GalaxyAssignment {
  galaxyId: string;
  galaxyLabel: string;
  /** Area note id when galaxy is anchored to a knowledge domain. */
  anchorNoteId: string | null;
}

export interface GalaxyCenter {
  x: number;
  y: number;
}

export const INTER_GALAXY_REPULSION_BOOST = 1.8;
export const INTRA_GALAXY_COHESION = 0.012;

/** Assign each note to a domain galaxy (area note, folder, or uncategorized). */
export function buildNoteGalaxyMap(
  notes: readonly NoteBase[],
  service: KnowledgeIndexService,
): Map<string, GalaxyAssignment> {
  const activeNotes = notes.filter(note => note.deletedAt == null);
  const areaNotes = listAreaNotes(activeNotes);
  const areaById = new Map(areaNotes.map(area => [area.id, area]));
  const result = new Map<string, GalaxyAssignment>();

  for (const area of areaNotes) {
    result.set(area.id, {
      galaxyId: area.id,
      galaxyLabel: area.title?.trim() || 'Area',
      anchorNoteId: area.id,
    });
  }

  for (const note of activeNotes) {
    if (result.has(note.id)) continue;

    let assignment: GalaxyAssignment | null = null;

    for (const title of service.getOutgoing(note.id)) {
      const targetId = service.resolveNoteId(title);
      if (targetId && areaById.has(targetId)) {
        const area = areaById.get(targetId)!;
        assignment = {
          galaxyId: area.id,
          galaxyLabel: area.title?.trim() || 'Area',
          anchorNoteId: area.id,
        };
        break;
      }
    }

    if (!assignment) {
      for (const area of areaNotes) {
        const linked = service.getNotesLinkedTo(area.title ?? '');
        if (linked.includes(note.id)) {
          assignment = {
            galaxyId: area.id,
            galaxyLabel: area.title?.trim() || 'Area',
            anchorNoteId: area.id,
          };
          break;
        }
      }
    }

    if (!assignment && note.folderId) {
      assignment = {
        galaxyId: `folder:${note.folderId}`,
        galaxyLabel: 'Folder',
        anchorNoteId: null,
      };
    }

    result.set(note.id, assignment ?? {
      galaxyId: 'uncategorized',
      galaxyLabel: 'Uncategorized',
      anchorNoteId: null,
    });
  }

  return result;
}

let cachedGalaxyMap: Map<string, GalaxyAssignment> | null = null;
let cachedGalaxyKey = '';

/** Shared memoized galaxy map — invalidate via `invalidateNoteGalaxyMapCache` on vault structure changes. */
export function getNoteGalaxyMap(
  notes: readonly NoteBase[],
  service: KnowledgeIndexService,
  cacheKey?: string,
): Map<string, GalaxyAssignment> {
  const key = cacheKey ?? `ephemeral:${notes.filter(n => !n.deletedAt).length}`;
  if (cachedGalaxyMap && key === cachedGalaxyKey) return cachedGalaxyMap;
  cachedGalaxyMap = buildNoteGalaxyMap(notes, service);
  cachedGalaxyKey = key;
  return cachedGalaxyMap;
}

export function invalidateNoteGalaxyMapCache(): void {
  cachedGalaxyMap = null;
  cachedGalaxyKey = '';
}

export function computeGalaxyCenters(
  nodes: ReadonlyArray<{ id: string; x: number; y: number; galaxyId: string }>,
): Map<string, GalaxyCenter> {
  const sums = new Map<string, { x: number; y: number; n: number }>();
  for (const node of nodes) {
    const row = sums.get(node.galaxyId) ?? { x: 0, y: 0, n: 0 };
    row.x += node.x;
    row.y += node.y;
    row.n += 1;
    sums.set(node.galaxyId, row);
  }

  const centers = new Map<string, GalaxyCenter>();
  for (const [galaxyId, row] of sums) {
    if (row.n === 0) continue;
    centers.set(galaxyId, { x: row.x / row.n, y: row.y / row.n });
  }
  return centers;
}

/** Extra repulsion multiplier when nodes belong to different galaxies. */
export function interGalaxyRepulsionMultiplier(
  galaxyA: string,
  galaxyB: string,
  enabled: boolean,
): number {
  if (!enabled || galaxyA === galaxyB) return 1;
  return INTER_GALAXY_REPULSION_BOOST;
}

/** Pull nodes toward their galaxy centroid in universe mode. */
export function applyGalaxyCohesion(
  node: { x: number; y: number; vx: number; vy: number; galaxyId: string },
  center: GalaxyCenter | undefined,
  enabled: boolean,
): void {
  if (!enabled || !center) return;
  node.vx += (center.x - node.x) * INTRA_GALAXY_COHESION;
  node.vy += (center.y - node.y) * INTRA_GALAXY_COHESION;
}
