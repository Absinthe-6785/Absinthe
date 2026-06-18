import type { SuggestionSignal } from '../cosmos/intelligence/suggestedConnections';

/** Compact scored discovery candidate stored during suggestion build (K-95D). */
export interface CompactSuggestedRef {
  noteId: string;
  score: number;
  signalFlags: number;
}

export const SUGGESTION_SIGNAL_FLAG = {
  SHARED_TAG: 1 << 0,
  SHARED_AREA: 1 << 1,
  TITLE_SIMILARITY: 1 << 2,
  MUTUAL_MENTION: 1 << 3,
  COMMON_BACKLINK: 1 << 4,
  RELATED: 1 << 5,
} as const;

export function encodeSuggestionSignalFlags(signal: SuggestionSignal): number {
  switch (signal) {
    case 'shared-tag': return SUGGESTION_SIGNAL_FLAG.SHARED_TAG;
    case 'shared-area': return SUGGESTION_SIGNAL_FLAG.SHARED_AREA;
    case 'title-similarity': return SUGGESTION_SIGNAL_FLAG.TITLE_SIMILARITY;
    case 'mutual-mention': return SUGGESTION_SIGNAL_FLAG.MUTUAL_MENTION;
    case 'common-backlink': return SUGGESTION_SIGNAL_FLAG.COMMON_BACKLINK;
    case 'related': return SUGGESTION_SIGNAL_FLAG.RELATED;
    default: return 0;
  }
}

/** Stable decode order matches scoring pass in buildDiscoveryConnectionSuggestions. */
export function decodeSuggestionSignals(flags: number): SuggestionSignal[] {
  const signals: SuggestionSignal[] = [];
  if (flags & SUGGESTION_SIGNAL_FLAG.TITLE_SIMILARITY) signals.push('title-similarity');
  if (flags & SUGGESTION_SIGNAL_FLAG.SHARED_AREA) signals.push('shared-area');
  if (flags & SUGGESTION_SIGNAL_FLAG.SHARED_TAG) signals.push('shared-tag');
  if (flags & SUGGESTION_SIGNAL_FLAG.MUTUAL_MENTION) signals.push('mutual-mention');
  if (flags & SUGGESTION_SIGNAL_FLAG.COMMON_BACKLINK) signals.push('common-backlink');
  if (flags & SUGGESTION_SIGNAL_FLAG.RELATED) signals.push('related');
  return signals;
}

export function addSuggestionSignal(
  entry: CompactSuggestedRef,
  delta: number,
  signal: SuggestionSignal,
): CompactSuggestedRef {
  const signalFlags = entry.signalFlags | encodeSuggestionSignalFlags(signal);
  return {
    noteId: entry.noteId,
    score: entry.score + delta,
    signalFlags: signalFlags === entry.signalFlags ? entry.signalFlags : signalFlags,
  };
}

export function createCompactSuggestedRef(
  noteId: string,
  delta: number,
  signal: SuggestionSignal,
): CompactSuggestedRef {
  return {
    noteId,
    score: delta,
    signalFlags: encodeSuggestionSignalFlags(signal),
  };
}
