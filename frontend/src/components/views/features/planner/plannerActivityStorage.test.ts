// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildRecentActivityProjection } from '../../buildRecentActivityProjection';
import {
  PLANNER_ACTIVITY_KEY,
  clearPlannerActivityForTest,
  readPlannerActivityRecents,
  recordPlannerActivity,
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
