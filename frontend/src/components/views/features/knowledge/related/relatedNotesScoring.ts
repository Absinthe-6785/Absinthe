/** Rule-based relationship weights for related note scoring */
export const RELATED_SCORE = {
  SHARED_TAG: 5,
  BACKLINK: 10,
  MENTION: 3,
  MUTUAL_BACKLINK: 15,
  RELATION: 8,
} as const;

export type RelatedReason = 'shared tag' | 'backlink' | 'mutual backlink' | 'mention';

export const RELATED_REASON_LABELS: Record<RelatedReason, string> = {
  'shared tag': '공유 태그',
  backlink: '백링크',
  'mutual backlink': '상호 링크',
  mention: '언급',
};

export interface RelatedScoreBreakdown {
  score: number;
  reasons: RelatedReason[];
}

export interface RelatedScoreInput {
  sharedTag: boolean;
  backlink: boolean;
  mutualBacklink: boolean;
  mention: boolean;
}

/** Compute weighted score and human-readable reasons */
export function computeRelatedScore(input: RelatedScoreInput): RelatedScoreBreakdown {
  let score = 0;
  const reasons: RelatedReason[] = [];

  if (input.sharedTag) {
    score += RELATED_SCORE.SHARED_TAG;
    reasons.push('shared tag');
  }

  if (input.mutualBacklink) {
    score += RELATED_SCORE.MUTUAL_BACKLINK;
    reasons.push('mutual backlink');
  } else if (input.backlink) {
    score += RELATED_SCORE.BACKLINK;
    reasons.push('backlink');
  }

  if (input.mention) {
    score += RELATED_SCORE.MENTION;
    reasons.push('mention');
  }

  return { score, reasons };
}

/** Format reasons for UI display */
export function formatRelatedReasons(reasons: readonly RelatedReason[]): string {
  return reasons.join(' + ');
}
