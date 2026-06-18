import type { NoteBase } from '../../../noteUtils';
import type { KnowledgeIndexService } from '../KnowledgeIndexService';
import type { GalaxyAssignment } from '../graph/knowledgeUniverse/galaxyClustering';
import type { DiscoveryItem, DiscoveryRelationshipSignals } from './discoveryTypes';
import {
  evaluateKnowledgeImportance,
  type KnowledgeImportanceResult,
} from '../cosmos/intelligence/knowledgeImportance';
import { buildImportanceInputForNote } from '../cosmos/intelligence/knowledgeOpportunities';
import {
  buildAreaHealthSummaries,
  type AreaHealthSummary,
} from '../cosmos/intelligence/areaHealth';

export interface ConnectionCandidateIndex {
  galaxyMembers: Map<string, string[]>;
  titleTokens: Map<string, string[]>;
}

export interface DiscoveryFeedContext {
  readonly notes: readonly NoteBase[];
  readonly service: KnowledgeIndexService;
  readonly galaxyMap: ReadonlyMap<string, GalaxyAssignment>;
  readonly now: number;
  readonly activeNotes: readonly NoteBase[];
  readonly noteById: ReadonlyMap<string, NoteBase>;
  areaHealth?: AreaHealthSummary[];
  connectionIndex?: ConnectionCandidateIndex;
  /** Alias: shared candidate pool for connection suggestions (K-95A). */
  candidatePool?: ConnectionCandidateIndex;
  /** Alias to candidatePool.galaxyMembers after first pool build (K-95D). */
  galaxyMemberIds?: Map<string, string[]>;
  importanceByNoteId: Map<string, KnowledgeImportanceResult>;
  /** Cached missing-connection discovery items for this refresh. */
  connectionSignals?: DiscoveryItem[];
  /** Cached hub activity signals (forgotten + drift) for this refresh. */
  relationshipSignals?: DiscoveryRelationshipSignals;
}

export function createDiscoveryFeedContext(
  notes: readonly NoteBase[],
  service: KnowledgeIndexService,
  galaxyMap: ReadonlyMap<string, GalaxyAssignment>,
  now: number,
): DiscoveryFeedContext {
  const activeNotes = notes.filter(n => !n.deletedAt);
  return {
    notes,
    service,
    galaxyMap,
    now,
    activeNotes,
    noteById: new Map(activeNotes.map(n => [n.id, n])),
    importanceByNoteId: new Map(),
  };
}

export function getDiscoveryImportance(
  ctx: DiscoveryFeedContext,
  noteId: string,
): KnowledgeImportanceResult {
  const cached = ctx.importanceByNoteId.get(noteId);
  if (cached) return cached;

  const note = ctx.noteById.get(noteId);
  if (!note) {
    const empty: KnowledgeImportanceResult = { importanceScore: 0, classification: 'isolated' };
    ctx.importanceByNoteId.set(noteId, empty);
    return empty;
  }

  const input = buildImportanceInputForNote(note, ctx.service, ctx.galaxyMap.get(noteId));
  const result = evaluateKnowledgeImportance(input);
  ctx.importanceByNoteId.set(noteId, result);
  return result;
}

export function getDiscoveryAreaHealth(ctx: DiscoveryFeedContext): AreaHealthSummary[] {
  if (!ctx.areaHealth) {
    ctx.areaHealth = buildAreaHealthSummaries(ctx.notes, ctx.service, ctx.galaxyMap, {
      noteById: ctx.noteById,
      getImportance: noteId => getDiscoveryImportance(ctx, noteId),
    });
  }
  return ctx.areaHealth;
}

export function getGalaxyMemberIds(
  ctx: DiscoveryFeedContext,
  galaxyId: string,
): readonly string[] {
  const pool = ensureConnectionCandidateIndex(ctx);
  if (!ctx.galaxyMemberIds) {
    ctx.galaxyMemberIds = pool.galaxyMembers;
  }
  return pool.galaxyMembers.get(galaxyId) ?? [];
}

export function ensureConnectionCandidateIndex(ctx: DiscoveryFeedContext): ConnectionCandidateIndex {
  if (ctx.connectionIndex) return ctx.connectionIndex;
  if (ctx.candidatePool) {
    ctx.connectionIndex = ctx.candidatePool;
    return ctx.candidatePool;
  }

  const galaxyMembers = new Map<string, string[]>();
  const titleTokens = new Map<string, string[]>();

  for (const note of ctx.activeNotes) {
    const galaxyId = ctx.galaxyMap.get(note.id)?.galaxyId ?? 'uncategorized';
    const galaxyBucket = galaxyMembers.get(galaxyId) ?? [];
    galaxyBucket.push(note.id);
    galaxyMembers.set(galaxyId, galaxyBucket);

    const title = (note.title ?? '').toLowerCase();
    for (const token of title.split(/[\s\-_/]+/)) {
      if (token.length <= 2) continue;
      const bucket = titleTokens.get(token) ?? [];
      bucket.push(note.id);
      titleTokens.set(token, bucket);
    }
  }

  const index = { galaxyMembers, titleTokens };
  ctx.connectionIndex = index;
  ctx.candidatePool = index;
  return index;
}

/** Shared candidate pool accessor — same index as connection suggestions (K-95A). */
export function getCandidatePool(ctx: DiscoveryFeedContext): ConnectionCandidateIndex {
  return ensureConnectionCandidateIndex(ctx);
}
