import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  computeHabitMetrics,
  getHabitCompletionHistory,
  isHabitCompleted,
  resolveTodaySplitDay,
  setHabitCompleted,
} from './habitCompletion';

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

describe('habitCompletion', () => {
  it('tracks completion for a habit on a date', () => {
    setHabitCompleted('habit-1', '2026-06-14', true);
    expect(isHabitCompleted('habit-1', '2026-06-14')).toBe(true);
    setHabitCompleted('habit-1', '2026-06-14', false);
    expect(isHabitCompleted('habit-1', '2026-06-14')).toBe(false);
  });

  it('resolves split day from date', () => {
    const day = resolveTodaySplitDay(new Date('2026-06-14T12:00:00'), 3);
    expect(day).toMatch(/^Day [1-3]$/);
  });

  it('computes streak and completion rate', () => {
    setHabitCompleted('h1', '2026-06-14', true);
    setHabitCompleted('h1', '2026-06-13', true);
    const formatDate = (d: Date) => d.toISOString().slice(0, 10);
    const metrics = computeHabitMetrics('h1', '2026-06-14', formatDate, 10);
    expect(metrics.streak).toBe(2);
    expect(metrics.completedToday).toBe(true);
    expect(metrics.completionRate).toBeGreaterThan(0);
  });

  it('returns completion history', () => {
    setHabitCompleted('h1', '2026-06-12', true);
    setHabitCompleted('h1', '2026-06-14', true);
    const formatDate = (d: Date) => d.toISOString().slice(0, 10);
    const history = getHabitCompletionHistory('h1', new Date('2026-06-14T12:00:00'), formatDate, 3);
    expect(history).toHaveLength(3);
    expect(history.find(h => h.date === '2026-06-14')?.completed).toBe(true);
    expect(history.find(h => h.date === '2026-06-13')?.completed).toBe(false);
  });
});
