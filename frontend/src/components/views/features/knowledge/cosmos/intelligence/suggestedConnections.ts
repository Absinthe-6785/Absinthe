import type { NoteBase } from '../../../../noteUtils';
import { displayNoteTitle } from '../../../../noteDisplayTitle';
import { normalizeWikiTitle } from '../../../../noteUtils';
import type { KnowledgeIndexService } from '../../KnowledgeIndexService';
import type { GalaxyAssignment } from '../../graph/knowledgeUniverse/galaxyClustering';
import { SUGGESTION_WEIGHTS, OPPORTUNITY_LIMITS } from './importanceWeights';

export type SuggestionSignal =
  | 'shared-tag'
  | 'shared-area'
  | 'title-similarity'
  | 'mutual-mention'
  | 'common-backlink'
  | 'related';

export interface SuggestedConnection {
  noteId: string;
  noteTitle: string;
  score: number;
  signals: SuggestionSignal[];
}

export interface BuildSuggestedConnectionsOptions {
  limit?: number;
}

function tokenize(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .split(/[\s\-_/]+/)
      .filter(token => token.length > 2),
  );
}

function titleSimilarity(a: string, b: string): number {
  const tokensA = tokenize(a);
  const tokensB = tokenize(b);
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let overlap = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) overlap += 1;
  }
  return overlap / Math.max(tokensA.size, tokensB.size);
}

function commonBacklinkCount(
  sourceId: string,
  targetId: string,
  service: KnowledgeIndexService,
): number {
  const sourceTitle = normalizeWikiTitle(service.getNoteTitle(sourceId));
  const targetTitle = normalizeWikiTitle(service.getNoteTitle(targetId));
  if (!sourceTitle || !targetTitle) return 0;

  const sourceBacklinkIds = new Set(
    service.getIncoming(sourceTitle).map(ref => ref.noteId),
  );
  const targetBacklinkIds = service.getIncoming(targetTitle).map(ref => ref.noteId);
  return targetBacklinkIds.filter(id => sourceBacklinkIds.has(id)).length;
}

/** Lightweight deterministic connection recommendations — local only. */
export function buildSuggestedConnections(
  noteId: string,
  notes: readonly NoteBase[],
  service: KnowledgeIndexService,
  galaxyMap: ReadonlyMap<string, GalaxyAssignment>,
  options: BuildSuggestedConnectionsOptions = {},
): SuggestedConnection[] {
  const limit = options.limit ?? OPPORTUNITY_LIMITS.SUGGESTIONS_DEFAULT;
  const source = notes.find(n => n.id === noteId && !n.deletedAt);
  if (!source) return [];

  const sourceTitle = displayNoteTitle(source.title);
  const sourceGalaxy = galaxyMap.get(noteId);
  const sourceTags = new Set(service.getTags(noteId));
  const scored = new Map<string, { score: number; signals: SuggestionSignal[] }>();

  const addCandidate = (targetId: string, delta: number, signal: SuggestionSignal) => {
    if (targetId === noteId) return;
    const entry = scored.get(targetId) ?? { score: 0, signals: [] };
    entry.score += delta;
    if (!entry.signals.includes(signal)) entry.signals.push(signal);
    scored.set(targetId, entry);
  };

  for (const related of service.getRelatedNotes(noteId)) {
    addCandidate(related.noteId, SUGGESTION_WEIGHTS.EXISTING_RELATED + related.score * 0.5, 'related');
  }

  for (const note of notes) {
    if (note.deletedAt || note.id === noteId) continue;

    const targetTitle = displayNoteTitle(note.title);
    const sim = titleSimilarity(sourceTitle, targetTitle);
    if (sim >= 0.35) {
      addCandidate(note.id, Math.round(sim * SUGGESTION_WEIGHTS.TITLE_SIMILARITY), 'title-similarity');
    }

    const targetGalaxy = galaxyMap.get(note.id);
    if (
      sourceGalaxy
      && targetGalaxy
      && sourceGalaxy.galaxyId === targetGalaxy.galaxyId
      && sourceGalaxy.galaxyId !== 'uncategorized'
    ) {
      addCandidate(note.id, SUGGESTION_WEIGHTS.SHARED_AREA, 'shared-area');
    }

    const targetTags = service.getTags(note.id);
    if (targetTags.some(tag => sourceTags.has(tag))) {
      addCandidate(note.id, SUGGESTION_WEIGHTS.SHARED_TAG, 'shared-tag');
    }

    const mentionsSource = service.getMentioningNotes(noteId).some(m => m.noteId === note.id);
    const mentionsTarget = service.getMentioningNotes(note.id).some(m => m.noteId === noteId);
    if (mentionsSource && mentionsTarget) {
      addCandidate(note.id, SUGGESTION_WEIGHTS.MUTUAL_MENTION, 'mutual-mention');
    }

    const sharedBacklinks = commonBacklinkCount(noteId, note.id, service);
    if (sharedBacklinks > 0) {
      addCandidate(note.id, SUGGESTION_WEIGHTS.COMMON_BACKLINK * sharedBacklinks, 'common-backlink');
    }
  }

  return [...scored.entries()]
    .map(([id, { score, signals }]) => {
      const note = notes.find(n => n.id === id);
      return {
        noteId: id,
        noteTitle: note ? displayNoteTitle(note.title) : id,
        score: Math.round(score),
        signals,
      };
    })
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.noteTitle.localeCompare(b.noteTitle))
    .slice(0, limit);
}
