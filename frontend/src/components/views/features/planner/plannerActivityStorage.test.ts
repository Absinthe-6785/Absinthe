// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildRecentActivityProjection } from '../../buildRecentActivityProjection';
import {
  PLANNER_ACTIVITY_KEY,
  clearPlannerActivityForTest,
  readPlannerActivityRecents,
  recordPlannerActivity,
  validPlannerEventDate,
} from './plannerActivityStorage';

describe('account-scoped Planner activity', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('keeps A/B/A and same-account revisits separate without attributing or deleting legacy history', () => {
    const legacy = JSON.stringify([{ kind: 'schedule', itemId: 'old', title: 'Unattributed title', at: 100 }]);
    localStorage.setItem(PLANNER_ACTIVITY_KEY, legacy);
    recordPlannerActivity('account-a', 'schedule', 'same-id', 'A private title', 200);
    recordPlannerActivity('account-b', 'schedule', 'same-id', 'B private title', 300);

    const a = [{ kind: 'schedule', itemId: 'same-id', title: 'A private title', at: 200 }];
    const b = [{ kind: 'schedule', itemId: 'same-id', title: 'B private title', at: 300 }];
    expect(readPlannerActivityRecents('account-a')).toEqual(a);
    expect(readPlannerActivityRecents('account-b')).toEqual(b);
    expect(readPlannerActivityRecents('account-a')).toEqual(a);
    expect(localStorage.getItem(PLANNER_ACTIVITY_KEY)).toBe(legacy);

    clearPlannerActivityForTest('account-a');
    expect(readPlannerActivityRecents('account-a')).toEqual([]);
    expect(readPlannerActivityRecents('account-b')).toEqual(b);
    expect(localStorage.getItem(PLANNER_ACTIVITY_KEY)).toBe(legacy);
  });

  it.each([undefined, null, '', '   ', ' account-a '])('fails closed without storage access for invalid account %s', account => {
    const legacy = JSON.stringify([{ kind: 'schedule', itemId: 'old', title: 'Legacy private title', at: 100 }]);
    localStorage.setItem(PLANNER_ACTIVITY_KEY, legacy);
    const read = vi.spyOn(Storage.prototype, 'getItem');
    const write = vi.spyOn(Storage.prototype, 'setItem');
    const remove = vi.spyOn(Storage.prototype, 'removeItem');

    expect(readPlannerActivityRecents(account)).toEqual([]);
    recordPlannerActivity(account, 'schedule', 'id', 'Must not be recorded', 200);
    clearPlannerActivityForTest(account);
    expect(read).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(1);
  });

  it('preserves recency, kind/item identity, updated titles, and the existing 32-entry bound', () => {
    for (let index = 0; index < 35; index += 1) {
      recordPlannerActivity('account-a', 'schedule', `item-${index}`, `Title ${index}`, index);
    }
    recordPlannerActivity('account-a', 'schedule', 'item-20', 'Updated title', 100);
    const entries = readPlannerActivityRecents('account-a');
    expect(entries).toHaveLength(32);
    expect(entries[0]).toEqual({ kind: 'schedule', itemId: 'item-20', title: 'Updated title', at: 100 });
    expect(entries.filter(entry => entry.itemId === 'item-20')).toHaveLength(1);
    expect(entries[1].itemId).toBe('item-34');
    expect(entries.at(-1)?.itemId).toBe('item-3');
  });

  it('keeps distinct encoded account identities separate', () => {
    recordPlannerActivity('owner/a', 'schedule', 'id', 'Slash account', 100);
    recordPlannerActivity('owner%2Fa', 'schedule', 'id', 'Literal percent account', 200);
    expect(readPlannerActivityRecents('owner/a')[0].title).toBe('Slash account');
    expect(readPlannerActivityRecents('owner%2Fa')[0].title).toBe('Literal percent account');
  });

  it.each(['2024-02-29', '2000-02-29', '0099-01-01', '2026-12-31'])('accepts real calendar date %s', date => {
    expect(validPlannerEventDate(date)).toBe(date);
  });

  it.each([undefined, null, 20260612, '', '2026-6-12', '2026-02-29', '1900-02-29',
    '2026-02-30', '2026-04-31', '2026-00-10', '2026-13-01', '2026-01-00', '0000-01-01',
    '2026-06-12T12:00:00Z', ' 2026-06-12'])('rejects unverifiable event date %s', date => {
    expect(validPlannerEventDate(date)).toBeUndefined();
  });

  it('keeps optional dates account-bound, updates only the matching identity, and never invents a missing date', () => {
    recordPlannerActivity('account-a', 'schedule', 'id', 'A', 100, '2026-06-11');
    recordPlannerActivity('account-b', 'schedule', 'id', 'B', 200, '2026-07-12');
    expect(readPlannerActivityRecents('account-a')[0].eventDate).toBe('2026-06-11');
    expect(readPlannerActivityRecents('account-b')[0].eventDate).toBe('2026-07-12');
    recordPlannerActivity('account-a', 'schedule', 'id', 'A updated', 300, '2026-06-13');
    expect(readPlannerActivityRecents('account-a')).toEqual([
      { kind: 'schedule', itemId: 'id', title: 'A updated', at: 300, eventDate: '2026-06-13' },
    ]);
    recordPlannerActivity('account-a', 'schedule', 'id', 'A undated revisit', 400);
    expect(readPlannerActivityRecents('account-a')[0]).not.toHaveProperty('eventDate');
    expect(readPlannerActivityRecents('account-b')[0].eventDate).toBe('2026-07-12');
  });

  it('keeps undated and malformed-date records readable without rewriting stored bytes or unrelated entries', () => {
    const key = `${PLANNER_ACTIVITY_KEY}:account:account-a`;
    const entries = [
      { kind: 'schedule', itemId: 'old', title: 'Undated', at: 100 },
      { kind: 'schedule', itemId: 'bad', title: 'Invalid date', at: 200, eventDate: '2026-02-30' },
      { kind: 'schedule', itemId: 'wrong-type', title: 'Wrong type', at: 300, eventDate: 123 },
    ];
    const raw = JSON.stringify(entries);
    localStorage.setItem(key, raw);
    const read = readPlannerActivityRecents('account-a');
    expect(read.map(entry => entry.itemId)).toEqual(['old', 'bad', 'wrong-type']);
    expect(read.every(entry => !('eventDate' in entry))).toBe(true);
    expect(localStorage.getItem(key)).toBe(raw);
    recordPlannerActivity('account-a', 'schedule', 'new', 'New invalid date', 400, '2026-04-31');
    const stored = JSON.parse(localStorage.getItem(key)!);
    expect(stored.slice(1)).toEqual(entries);
    expect(stored[0]).not.toHaveProperty('eventDate');
  });

  it('projects only valid Schedule dates without changing activity buckets, navigation or frozen input', () => {
    const at = new Date(2026, 5, 12, 10).getTime();
    const entries = Object.freeze([
      Object.freeze({ kind: 'schedule', itemId: 'dated', title: 'Dated', at, eventDate: '2020-01-02' }),
      Object.freeze({ kind: 'schedule', itemId: 'bad', title: 'Bad', at, eventDate: '2026-02-30' }),
      Object.freeze({ kind: 'schedule', itemId: 'old', title: 'Undated', at }),
      Object.freeze({ kind: 'other', itemId: 'other', title: 'Other', at, eventDate: '2020-01-02' }),
    ]);
    const before = JSON.stringify(entries);
    const projection = buildRecentActivityProjection({ notes: [], recipeRecents: [], archiveRestoreRecents: [],
      plannerRecents: entries, labels: { today: 'Today', yesterday: 'Yesterday', daysAgo: days => `${days}d` },
      locale: 'en', now: new Date(2026, 5, 12, 12) });
    const items = projection.groups[0].items;
    expect(items[0]).toMatchObject({ plannerItemId: 'dated', timestamp: at, eventDate: '2020-01-02' });
    expect(items[0].relativeLabel).toContain('Today');
    expect(items.slice(1).every(item => !('eventDate' in item))).toBe(true);
    expect(JSON.stringify(entries)).toBe(before);
  });

  it('preserves real projection date buckets and navigation identity without network requests', () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const now = new Date(2026, 9, 26, 12);
    const today = now.getTime() - 60_000;
    const yesterday = new Date(2026, 9, 25, 12).getTime();
    const earlier = new Date(2026, 9, 22, 12).getTime();
    recordPlannerActivity('account-a', 'schedule', 'earlier', 'Earlier event', earlier);
    recordPlannerActivity('account-a', 'schedule', 'yesterday', 'Yesterday event', yesterday);
    recordPlannerActivity('account-a', 'schedule', 'today', 'Today event', today);
    recordPlannerActivity('account-b', 'schedule', 'private', 'Other account', today);

    const projection = buildRecentActivityProjection({
      notes: [], recipeRecents: [], archiveRestoreRecents: [],
      plannerRecents: readPlannerActivityRecents('account-a'),
      labels: { today: 'Today', yesterday: 'Yesterday', daysAgo: days => `${days}d` },
      locale: 'en', now,
    });
    expect(projection.groups.map(group => [group.bucket, group.items.map(item => item.title)])).toEqual([
      ['today', ['Today event']], ['yesterday', ['Yesterday event']], ['earlier', ['Earlier event']],
    ]);
    expect(projection.groups[0].items[0]).toMatchObject({
      id: 'planner:schedule:today', domain: 'planner', kind: 'schedule', plannerItemId: 'today', timestamp: today,
    });
    expect(fetch).not.toHaveBeenCalled();
  });
});
