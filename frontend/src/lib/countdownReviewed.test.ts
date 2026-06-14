import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getReviewedCountdownIds,
  isCountdownReviewed,
  markCountdownReviewed,
} from './countdownReviewed';
import { filterUnreviewedCountdowns } from '../components/views/features/planner/hooks/useCountdownReviewed';

const storage = new Map<string, string>();

beforeEach(() => {
  storage.clear();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => { storage.set(key, value); },
    removeItem: (key: string) => { storage.delete(key); },
    clear: () => { storage.clear(); },
  });
});

describe('countdown reviewed consistency', () => {
  const rows = [
    { id: 'c1', sourceRefId: 'note-1', daysUntil: 3, title: 'Exam' },
    { id: 'c2', sourceRefId: 'note-2', daysUntil: 5, title: 'Deadline' },
  ];

  it('filters reviewed countdowns consistently', () => {
    markCountdownReviewed('note-1');
    const visible = filterUnreviewedCountdowns(rows, isCountdownReviewed, { upcomingOnly: true });
    expect(visible).toHaveLength(1);
    expect(visible[0].sourceRefId).toBe('note-2');
    expect(getReviewedCountdownIds().has('note-1')).toBe(true);
  });
});
