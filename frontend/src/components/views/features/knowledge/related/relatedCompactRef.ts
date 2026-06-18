import type { RelatedReason } from './relatedNotesScoring';

/** Compact structural related-neighbor ref stored in the index (K-95C). */
export interface CompactRelatedRef {
  noteId: string;
  score: number;
  reasonFlags: number;
}

export const RELATED_REASON_FLAG = {
  SHARED_TAG: 1 << 0,
  BACKLINK: 1 << 1,
  MUTUAL_BACKLINK: 1 << 2,
  MENTION: 1 << 3,
  RELATION: 1 << 4,
  SHARED_RELATION: 1 << 5,
  DIRECT_LINK: 1 << 6,
} as const;

export function encodeRelatedReasonFlags(reasons: readonly RelatedReason[]): number {
  let flags = 0;
  for (const reason of reasons) {
    switch (reason) {
      case 'shared tag':
        flags |= RELATED_REASON_FLAG.SHARED_TAG;
        break;
      case 'backlink':
        flags |= RELATED_REASON_FLAG.BACKLINK;
        break;
      case 'mutual backlink':
        flags |= RELATED_REASON_FLAG.MUTUAL_BACKLINK;
        break;
      case 'mention':
        flags |= RELATED_REASON_FLAG.MENTION;
        break;
      case 'relation':
        flags |= RELATED_REASON_FLAG.RELATION;
        break;
      case 'shared relation':
        flags |= RELATED_REASON_FLAG.SHARED_RELATION;
        break;
      case 'direct link':
        flags |= RELATED_REASON_FLAG.DIRECT_LINK;
        break;
      default:
        break;
    }
  }
  return flags;
}

export function decodeRelatedReasonFlags(flags: number): RelatedReason[] {
  const reasons: RelatedReason[] = [];
  if (flags & RELATED_REASON_FLAG.SHARED_TAG) reasons.push('shared tag');
  if (flags & RELATED_REASON_FLAG.MUTUAL_BACKLINK) reasons.push('mutual backlink');
  else if (flags & RELATED_REASON_FLAG.BACKLINK) reasons.push('backlink');
  if (flags & RELATED_REASON_FLAG.MENTION) reasons.push('mention');
  if (flags & RELATED_REASON_FLAG.DIRECT_LINK) reasons.push('direct link');
  else if (flags & RELATED_REASON_FLAG.RELATION) reasons.push('relation');
  if (flags & RELATED_REASON_FLAG.SHARED_RELATION) reasons.push('shared relation');
  return reasons;
}

export function toCompactRelatedRef(
  noteId: string,
  score: number,
  reasons: readonly RelatedReason[],
): CompactRelatedRef {
  return { noteId, score, reasonFlags: encodeRelatedReasonFlags(reasons) };
}
