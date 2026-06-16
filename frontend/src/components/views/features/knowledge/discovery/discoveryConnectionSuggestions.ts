import { displayNoteTitle } from '../../../noteDisplayTitle';
import { normalizeWikiTitle } from '../../../noteUtils';
import type { KnowledgeIndexService } from '../KnowledgeIndexService';
import type { SuggestedConnection, SuggestionSignal } from '../cosmos/intelligence/suggestedConnections';
import { SUGGESTION_WEIGHTS } from '../cosmos/intelligence/importanceWeights';
import {
  ensureConnectionCandidateIndex,
  type DiscoveryFeedContext,
} from './discoveryFeedContext';

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

function collectCandidateIds(sourceId: string, ctx: DiscoveryFeedContext): Set<string> {
  const { service, galaxyMap } = ctx;
  const index = ensureConnectionCandidateIndex(ctx);
  const candidates = new Set<string>();

  for (const tag of service.getTags(sourceId)) {
    for (const id of service.getNotesWithTag(tag)) {
      if (id !== sourceId) candidates.add(id);
    }
  }

  const sourceGalaxyId = galaxyMap.get(sourceId)?.galaxyId;
  if (sourceGalaxyId) {
    for (const id of index.galaxyMembers.get(sourceGalaxyId) ?? []) {
      if (id !== sourceId) candidates.add(id);
    }
  }

  for (const ref of service.getMentioningNotes(sourceId)) {
    if (ref.noteId !== sourceId) candidates.add(ref.noteId);
  }
  for (const ref of service.getMentionedNotes(sourceId)) {
    if (ref.noteId !== sourceId) candidates.add(ref.noteId);
  }

  const sourceTitle = displayNoteTitle(ctx.noteById.get(sourceId)?.title ?? '');
  for (const token of tokenize(sourceTitle)) {
    for (const id of index.titleTokens.get(token) ?? []) {
      if (id !== sourceId) candidates.add(id);
    }
  }

  return candidates;
}

/** Indexed connection suggestions for discovery — avoids O(n) vault scans per source. */
export function buildDiscoveryConnectionSuggestions(
  sourceId: string,
  ctx: DiscoveryFeedContext,
  limit = 3,
): SuggestedConnection[] {
  const source = ctx.noteById.get(sourceId);
  if (!source) return [];

  const { service, galaxyMap } = ctx;
  const sourceTitle = displayNoteTitle(source.title);
  const sourceGalaxy = galaxyMap.get(sourceId);
  const sourceTags = new Set(service.getTags(sourceId));
  const scored = new Map<string, { score: number; signals: SuggestionSignal[] }>();

  const addCandidate = (targetId: string, delta: number, signal: SuggestionSignal) => {
    if (targetId === sourceId) return;
    const entry = scored.get(targetId) ?? { score: 0, signals: [] };
    entry.score += delta;
    if (!entry.signals.includes(signal)) entry.signals.push(signal);
    scored.set(targetId, entry);
  };

  const mentionersOfSource = new Set(
    service.getMentioningNotes(sourceId).map(m => m.noteId),
  );

  for (const targetId of collectCandidateIds(sourceId, ctx)) {
    const target = ctx.noteById.get(targetId);
    if (!target) continue;

    const targetTitle = displayNoteTitle(target.title);
    const sim = titleSimilarity(sourceTitle, targetTitle);
    if (sim >= 0.35) {
      addCandidate(targetId, Math.round(sim * SUGGESTION_WEIGHTS.TITLE_SIMILARITY), 'title-similarity');
    }

    const targetGalaxy = galaxyMap.get(targetId);
    if (
      sourceGalaxy
      && targetGalaxy
      && sourceGalaxy.galaxyId === targetGalaxy.galaxyId
      && sourceGalaxy.galaxyId !== 'uncategorized'
    ) {
      addCandidate(targetId, SUGGESTION_WEIGHTS.SHARED_AREA, 'shared-area');
    }

    const targetTags = service.getTags(targetId);
    if (targetTags.some(tag => sourceTags.has(tag))) {
      addCandidate(targetId, SUGGESTION_WEIGHTS.SHARED_TAG, 'shared-tag');
    }

    const mentionsSource = mentionersOfSource.has(targetId);
    const mentionsTarget = service.getMentioningNotes(targetId).some(m => m.noteId === sourceId);
    if (mentionsSource && mentionsTarget) {
      addCandidate(targetId, SUGGESTION_WEIGHTS.MUTUAL_MENTION, 'mutual-mention');
    }

    const sharedBacklinks = commonBacklinkCount(sourceId, targetId, service);
    if (sharedBacklinks > 0) {
      addCandidate(targetId, SUGGESTION_WEIGHTS.COMMON_BACKLINK * sharedBacklinks, 'common-backlink');
    }
  }

  return [...scored.entries()]
    .map(([id, { score, signals }]) => {
      const note = ctx.noteById.get(id);
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
