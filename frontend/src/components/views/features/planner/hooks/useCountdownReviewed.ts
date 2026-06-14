import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getReviewedCountdownIds,
  isCountdownReviewed,
  markCountdownReviewed,
  unmarkCountdownReviewed,
} from '../../../../../lib/countdownReviewed';
import { COUNTDOWN_REVIEWED_CHANGED } from '../../../../../lib/countdownReviewedEvents';

export function useCountdownReviewed() {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const refresh = () => setVersion(v => v + 1);
    window.addEventListener(COUNTDOWN_REVIEWED_CHANGED, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(COUNTDOWN_REVIEWED_CHANGED, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const reviewedIds = useMemo(() => getReviewedCountdownIds(), [version]);

  const markReviewed = useCallback((noteId: string) => {
    markCountdownReviewed(noteId);
    setVersion(v => v + 1);
  }, []);

  const unmarkReviewed = useCallback((noteId: string) => {
    unmarkCountdownReviewed(noteId);
    setVersion(v => v + 1);
  }, []);

  return {
    reviewedIds,
    isReviewed: isCountdownReviewed,
    markReviewed,
    unmarkReviewed,
  };
}

export function filterUnreviewedCountdowns<T extends { sourceRefId: string; daysUntil?: number }>(
  countdowns: readonly T[],
  isReviewed: (noteId: string) => boolean,
  options?: { upcomingOnly?: boolean },
): T[] {
  return countdowns.filter(c => {
    if (options?.upcomingOnly && c.daysUntil !== undefined && c.daysUntil < 0) return false;
    return !isReviewed(c.sourceRefId);
  });
}
