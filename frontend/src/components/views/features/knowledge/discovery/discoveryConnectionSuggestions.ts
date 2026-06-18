import { displayNoteTitle } from '../../../noteDisplayTitle';
import { normalizeWikiTitle } from '../../../noteUtils';
import type { KnowledgeIndexService } from '../KnowledgeIndexService';
import type { SuggestedConnection, SuggestionSignal } from '../cosmos/intelligence/suggestedConnections';
import { SUGGESTION_WEIGHTS } from '../cosmos/intelligence/importanceWeights';
import {
  ensureConnectionCandidateIndex,
  type DiscoveryFeedContext,
} from './discoveryFeedContext';
import {
  addSuggestionSignal,
  createCompactSuggestedRef,
  decodeSuggestionSignals,
  type CompactSuggestedRef,
} from './discoveryCompactCandidate';

function tokenize(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .split(/[\s\-_/]+/)
      .filter(token => token.length > 2),
  );
}

function titleSimilarity(tokensA: Set<string>, tokensB: Set<string>): number {
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

function upsertScoredCandidate(
  scored: Map<string, CompactSuggestedRef>,
  targetId: string,
  delta: number,
  signal: SuggestionSignal,
): void {
  const existing = scored.get(targetId);
  scored.set(
    targetId,
    existing ? addSuggestionSignal(existing, delta, signal) : createCompactSuggestedRef(targetId, delta, signal),
  );
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
  const sourceTitleTokens = tokenize(sourceTitle);
  const sourceGalaxy = galaxyMap.get(sourceId);
  const sourceTags = service.getTags(sourceId);
  const scored = new Map<string, CompactSuggestedRef>();

  const mentionersOfSource = new Set(
    service.getMentioningNotes(sourceId).map(m => m.noteId),
  );

  for (const targetId of collectCandidateIds(sourceId, ctx)) {
    if (targetId === sourceId || !ctx.noteById.has(targetId)) continue;

    const targetTitle = displayNoteTitle(ctx.noteById.get(targetId)?.title ?? '');
    const sim = titleSimilarity(sourceTitleTokens, tokenize(targetTitle));
    if (sim >= 0.35) {
      upsertScoredCandidate(
        scored,
        targetId,
        Math.round(sim * SUGGESTION_WEIGHTS.TITLE_SIMILARITY),
        'title-similarity',
      );
    }

    const targetGalaxy = galaxyMap.get(targetId);
    if (
      sourceGalaxy
      && targetGalaxy
      && sourceGalaxy.galaxyId === targetGalaxy.galaxyId
      && sourceGalaxy.galaxyId !== 'uncategorized'
    ) {
      upsertScoredCandidate(scored, targetId, SUGGESTION_WEIGHTS.SHARED_AREA, 'shared-area');
    }

    if (service.getTags(targetId).some(tag => sourceTags.includes(tag))) {
      upsertScoredCandidate(scored, targetId, SUGGESTION_WEIGHTS.SHARED_TAG, 'shared-tag');
    }

    const mentionsSource = mentionersOfSource.has(targetId);
    const mentionsTarget = service.getMentioningNotes(targetId).some(m => m.noteId === sourceId);
    if (mentionsSource && mentionsTarget) {
      upsertScoredCandidate(scored, targetId, SUGGESTION_WEIGHTS.MUTUAL_MENTION, 'mutual-mention');
    }

    const sharedBacklinks = commonBacklinkCount(sourceId, targetId, service);
    if (sharedBacklinks > 0) {
      upsertScoredCandidate(
        scored,
        targetId,
        SUGGESTION_WEIGHTS.COMMON_BACKLINK * sharedBacklinks,
        'common-backlink',
      );
    }
  }

  const ranked: SuggestedConnection[] = [];
  for (const entry of scored.values()) {
    if (entry.score <= 0) continue;
    ranked.push({
      noteId: entry.noteId,
      noteTitle: displayNoteTitle(ctx.noteById.get(entry.noteId)?.title ?? entry.noteId),
      score: Math.round(entry.score),
      signals: decodeSuggestionSignals(entry.signalFlags),
    });
  }

  ranked.sort((a, b) => b.score - a.score || a.noteTitle.localeCompare(b.noteTitle));
  return ranked.slice(0, limit);
}
