import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getRecoveryEntry,
  getRecoveryHistory,
  getRecoveryWeekSummary,
  setRecoveryEntry,
} from './recoveryNotes';

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

const formatDate = (d: Date) => d.toISOString().slice(0, 10);

describe('recoveryNotes', () => {
  it('writes and reads recovery entries', () => {
    setRecoveryEntry('2026-06-14', { sleepHours: 7.5, sleepQuality: 4, note: 'Felt rested' });
    const entry = getRecoveryEntry('2026-06-14');
    expect(entry?.sleepHours).toBe(7.5);
    expect(entry?.sleepQuality).toBe(4);
    expect(entry?.note).toBe('Felt rested');
  });

  it('removes empty entries', () => {
    setRecoveryEntry('2026-06-14', { note: 'temp' });
    setRecoveryEntry('2026-06-14', { note: '' });
    expect(getRecoveryEntry('2026-06-14')).toBeNull();
  });

  it('summarizes week sleep and trend', () => {
    setRecoveryEntry('2026-06-14', { sleepHours: 8, note: 'Good' });
    setRecoveryEntry('2026-06-13', { sleepHours: 7 });
    setRecoveryEntry('2026-06-07', { sleepHours: 5 });
    setRecoveryEntry('2026-06-06', { sleepHours: 5 });

    const summary = getRecoveryWeekSummary(new Date('2026-06-14T12:00:00'), formatDate);
    expect(summary.latestSleep).toBe(8);
    expect(summary.latestNote).toBe('Good');
    expect(summary.avgSleep).toBe(7.5);
    expect(summary.loggedDays).toBe(2);
    expect(summary.trend).toBe('up');
  });

  it('returns history rows', () => {
    setRecoveryEntry('2026-06-14', { sleepHours: 6 });
    const history = getRecoveryHistory(new Date('2026-06-14T12:00:00'), formatDate, 3);
    expect(history).toHaveLength(3);
    expect(history[0]?.entry?.sleepHours).toBe(6);
  });
});
