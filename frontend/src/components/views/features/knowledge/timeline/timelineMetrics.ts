import type { NoteBase } from '../../../noteUtils';
import type { KnowledgeIndexService } from '../KnowledgeIndexService';
import { buildGlobalGraphData } from '../graph/buildGlobalGraphData';
import { getNoteGalaxyMap, type GalaxyAssignment } from '../graph/knowledgeUniverse/galaxyClustering';
import {
  evaluateKnowledgeImportance,
  type ImportanceClassification,
} from '../cosmos/intelligence/knowledgeImportance';
import { buildImportanceInputForNote } from '../cosmos/intelligence/knowledgeOpportunities';
import { getProperty } from '../properties/noteProperties';
import { isAreaNote, listAreaNotes } from '../trace/areaNotes';
import type {
  DiscoveryHistorySummary,
  StructuralGrowthMetrics,
  TimelineSnapshot,
  VaultGrowthMetrics,
} from './timelineTypes';

export function noteEffectiveCreatedAt(note: NoteBase): number {
  if (note.createdAt && note.createdAt > 0) return note.createdAt;
  const fromId = Number(note.id.split('-')[1] || 0);
  return fromId > 0 ? fromId : note.updatedAt;
}

export function notesActiveAt(notes: readonly NoteBase[], endMs: number): NoteBase[] {
  return notes.filter(note => {
    if (note.deletedAt != null && note.deletedAt <= endMs) return false;
    return noteEffectiveCreatedAt(note) <= endMs;
  });
}

export function isHubClassification(classification: ImportanceClassification): boolean {
  return classification === 'core-hub' || classification === 'major-hub';
}

export function countHubs(
  notes: readonly NoteBase[],
  service: KnowledgeIndexService,
  galaxyMap?: Map<string, GalaxyAssignment>,
): number {
  const map = galaxyMap ?? getNoteGalaxyMap(notes, service);
  let count = 0;
  for (const note of notes) {
    if (isAreaNote(note)) {
      count += 1;
      continue;
    }
    const input = buildImportanceInputForNote(note, service, map.get(note.id));
    if (isHubClassification(evaluateKnowledgeImportance(input).classification)) {
      count += 1;
    }
  }
  return count;
}

export function countGalaxies(
  notes: readonly NoteBase[],
  service: KnowledgeIndexService,
  galaxyMap?: Map<string, GalaxyAssignment>,
): number {
  const map = galaxyMap ?? getNoteGalaxyMap(notes, service);
  const ids = new Set<string>();
  for (const note of notes) {
    const galaxy = map.get(note.id);
    if (galaxy && galaxy.galaxyId !== 'uncategorized') ids.add(galaxy.galaxyId);
  }
  return ids.size;
}

export function countAreas(notes: readonly NoteBase[]): number {
  return listAreaNotes(notes).length;
}

export function countLinksForNotes(
  active: readonly NoteBase[],
  service: KnowledgeIndexService,
): number {
  if (active.length === 0) return 0;
  const activeIds = new Set(active.map(n => n.id));
  const edges = buildGlobalGraphData({ service }).edges;
  return edges.filter(
    e => activeIds.has(e.sourceId) && activeIds.has(e.targetId),
  ).length;
}

export function connectionDensity(linkCount: number, noteCount: number): number {
  if (noteCount <= 0) return 0;
  return Math.round((linkCount / noteCount) * 100) / 100;
}

export function buildSnapshotMetrics(
  active: readonly NoteBase[],
  service: KnowledgeIndexService,
  discoveriesOpen: number,
  periodId: string,
  label: string,
  galaxyMap?: Map<string, GalaxyAssignment>,
): TimelineSnapshot {
  const linkCount = countLinksForNotes(active, service);
  const noteCount = active.length;
  return {
    periodId,
    label,
    noteCount,
    linkCount,
    hubCount: countHubs(active, service, galaxyMap),
    galaxyCount: countGalaxies(active, service, galaxyMap),
    areaCount: countAreas(active),
    connectionDensity: connectionDensity(linkCount, noteCount),
    discoveriesOpen,
  };
}

export function vaultGrowthBetween(
  previous: TimelineSnapshot | null,
  current: TimelineSnapshot,
  notes: readonly NoteBase[],
  startMs: number,
  endMs: number,
): VaultGrowthMetrics {
  const notesCreated = notes.filter(note => {
    if (note.deletedAt != null) return false;
    const created = noteEffectiveCreatedAt(note);
    return created >= startMs && created <= endMs;
  }).length;

  const linksCreated = previous
    ? Math.max(0, current.linkCount - previous.linkCount)
    : current.linkCount;

  const areasCreated = notes.filter(note => {
    if (!isAreaNote(note) || note.deletedAt != null) return false;
    const created = noteEffectiveCreatedAt(note);
    return created >= startMs && created <= endMs;
  }).length;

  return { notesCreated, linksCreated, areasCreated };
}

export function structuralGrowthFrom(snapshot: TimelineSnapshot): StructuralGrowthMetrics {
  return {
    hubCount: snapshot.hubCount,
    galaxyCount: snapshot.galaxyCount,
    connectionDensity: snapshot.connectionDensity,
  };
}

export function buildDiscoveryHistory(
  notes: readonly NoteBase[],
  service: KnowledgeIndexService,
  now: number,
  windowDays = 30,
  galaxyMap?: Map<string, GalaxyAssignment>,
): DiscoveryHistorySummary {
  const map = galaxyMap ?? getNoteGalaxyMap(notes, service);
  const active = notes.filter(n => !n.deletedAt);
  const windowMs = windowDays * 86_400_000;

  let missingConnectionsResolved = 0;
  for (const source of active) {
    const tags = service.getTags(source.id);
    if (tags.length === 0) continue;
    for (const target of active) {
      if (target.id === source.id) continue;
      const sharedTag = tags.some(t => service.getTags(target.id).includes(t));
      if (!sharedTag) continue;
      const outgoing = service.getOutgoing(source.id);
      const targetTitle = (target.title ?? '').trim().toLowerCase();
      if (targetTitle && outgoing.some(t => t.toLowerCase() === targetTitle)) {
        missingConnectionsResolved += 1;
      }
    }
  }
  missingConnectionsResolved = Math.min(missingConnectionsResolved, 500);

  const weakHubsCreated = listAreaNotes(active).length;

  let forgottenNotesRevisited = 0;
  for (const note of active) {
    const input = buildImportanceInputForNote(note, service, map.get(note.id));
    const { classification } = evaluateKnowledgeImportance(input);
    if (!isHubClassification(classification)) continue;
    const lastOpened = note.lastOpenedAt ?? 0;
    if (lastOpened <= 0) continue;
    if (now - lastOpened <= windowMs) forgottenNotesRevisited += 1;
  }

  return {
    missingConnectionsResolved,
    weakHubsCreated,
    forgottenNotesRevisited,
  };
}
