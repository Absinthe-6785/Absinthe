import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildHomeFoundationProjection } from './buildHomeFoundationProjection';
import type { NoteBase } from '../../noteUtils';
import type { RecentActivityGroup, RecentActivityItem } from '../../buildRecentActivityProjection';
import { buildHomeWorkoutCompositeProjection } from './homeWorkoutCompositeProjection';

const storage = new Map<string, string>();

beforeEach(() => {
  storage.clear();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => { storage.set(key, value); },
    removeItem: (key: string) => { storage.delete(key); },
    clear: () => { storage.clear(); },
    key: () => null,
    length: 0,
  });
});

const note = (id: string, overrides: Partial<NoteBase> = {}): NoteBase => ({
  id,
  title: `Note ${id}`,
  body: '',
  updatedAt: 0,
  folderId: null,
  deletedAt: null,
  ...overrides,
});

const recentItem = (id: string, timestamp: number, metadata: Partial<RecentActivityItem> = {}): RecentActivityItem => ({
  id,
  domain: 'notes' as const,
  kind: 'opened',
  title: `Trace ${id}`,
  timestamp,
  relativeLabel: 'recent',
  ...metadata,
});

function buildTraces(groups: RecentActivityGroup[], traceLimit?: number) {
  const projection = buildHomeFoundationProjection({
    notes: [],
    workouts: [],
    plannerProjection: null,
    recentActivity: { groups, isEmpty: groups.every(group => group.items.length === 0), generatedAt: '' },
    accountId: 'account-a',
    todayKey: '2026-06-23',
    traceLimit,
  });
  return projection.traces;
}

describe('buildHomeFoundationProjection', () => {
  it('preserves the Today agenda and weekly timetable preview without routine progress', () => {
    const agenda = [{ key: 'event-1', title: 'Study', time: '09:00', kind: 'schedule' }];
    const timetable = [{ id: 'slot-1', title: 'Reading', startTime: '10:00', endTime: '11:00' }];
    const projection = buildHomeFoundationProjection({
      notes: [],
      workouts: [],
      plannerProjection: { todayItems: agenda, timetableToday: timetable } as any,
      recentActivity: { groups: [], isEmpty: true, generatedAt: '' },
      accountId: 'account-a',
      todayKey: '2026-06-23',
    });

    expect(projection.todayAgenda).toBe(agenda);
    expect(projection.timetableSlots).toBe(timetable);
    expect(projection).not.toHaveProperty('activeRoutines');
    expect(projection).not.toHaveProperty('completedRoutines');
  });

  it('includes today activity in the traces list', () => {
    const today = recentItem('today-note', 300);

    expect(buildTraces([{ bucket: 'today', items: [today] }])).toEqual([today]);
  });

  it('shows yesterday-only and earlier-only activity when today is empty', () => {
    const yesterday = recentItem('yesterday-note', 200);
    const earlier = recentItem('earlier-note', 100);

    expect(buildTraces([
      { bucket: 'today', items: [] },
      { bucket: 'yesterday', items: [yesterday] },
      { bucket: 'earlier', items: [] },
    ])).toEqual([yesterday]);
    expect(buildTraces([
      { bucket: 'today', items: [] },
      { bucket: 'yesterday', items: [] },
      { bucket: 'earlier', items: [earlier] },
    ])).toEqual([earlier]);
  });

  it('merges available buckets by descending timestamp without changing navigation metadata', () => {
    const note = recentItem('note', 150, { noteId: 'note-1' });
    const planner = recentItem('planner', 250, { domain: 'planner', kind: 'schedule', plannerItemId: 'schedule-1' });
    const recipe = recentItem('recipe', 200, { domain: 'recipe', kind: 'viewed', recipeId: 'recipe-1' });
    const traces = buildTraces([
      { bucket: 'today', items: [note] },
      { bucket: 'yesterday', items: [recipe] },
      { bucket: 'earlier', items: [planner] },
    ]);

    expect(traces.map(item => item.id)).toEqual(['planner', 'recipe', 'note']);
    expect(traces[0]).toMatchObject({ plannerItemId: 'schedule-1', domain: 'planner' });
    expect(traces[1]).toMatchObject({ recipeId: 'recipe-1', domain: 'recipe' });
    expect(traces[2]).toMatchObject({ noteId: 'note-1', domain: 'notes' });
  });

  it('keeps the default six-item display limit across buckets', () => {
    const groups = [
      { bucket: 'today' as const, items: [recentItem('a', 700), recentItem('b', 600), recentItem('c', 500)] },
      { bucket: 'yesterday' as const, items: [recentItem('d', 400), recentItem('e', 300)] },
      { bucket: 'earlier' as const, items: [recentItem('f', 200), recentItem('g', 100)] },
    ];

    expect(buildTraces(groups).map(item => item.id)).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
  });

  it('preserves the empty list when all activity buckets are empty', () => {
    expect(buildTraces([
      { bucket: 'today', items: [] },
      { bucket: 'yesterday', items: [] },
      { bucket: 'earlier', items: [] },
    ])).toEqual([]);
  });

  it('does not mutate source group item arrays while sorting the combined traces', () => {
    const todayItems = [recentItem('older-today', 100), recentItem('newer-today', 300)];
    const yesterdayItems = [recentItem('yesterday', 200)];
    const beforeToday = [...todayItems];
    const beforeYesterday = [...yesterdayItems];

    const traces = buildTraces([
      { bucket: 'today', items: todayItems },
      { bucket: 'yesterday', items: yesterdayItems },
    ]);

    expect(traces.map(item => item.id)).toEqual(['newer-today', 'yesterday', 'older-today']);
    expect(todayItems).toEqual(beforeToday);
    expect(yesterdayItems).toEqual(beforeYesterday);
  });

  it('selects a recent Note instead of a global resume workspace without changing workspace bytes', () => {
    localStorage.setItem('note-workspace-session-v1', JSON.stringify({
      activation: { kind: 'none' },
      updatedAt: Date.now(),
      resumeActivation: { kind: 'smart-collection', id: 'recent' },
    }));
    localStorage.setItem('workspace-prefs-v1', JSON.stringify({
      pinned: [],
      recent: [{
        workspace: { kind: 'smart-collection', id: 'recent', name: 'Recent notes' },
        lastOpenedAt: Date.now(),
      }],
    }));

    const workspaceBytes = [...storage];
    const projection = buildHomeFoundationProjection({
      notes: [note('n1', { lastOpenedAt: Date.now() })],
      workouts: [],
      plannerProjection: null,
      recentActivity: { groups: [], isEmpty: true, generatedAt: '' },
      accountId: 'account-a',
      todayKey: '2026-06-23',
    });

    expect(projection.continueItem).toMatchObject({ kind: 'note', noteId: 'n1', title: 'Note n1' });
    expect([...storage]).toEqual(workspaceBytes);
  });

  it('selects the most recently opened non-deleted Note without sorting the input', () => {
    const notes = Object.freeze([
      note('older', { lastOpenedAt: 10 }),
      note('deleted', { lastOpenedAt: 50, deletedAt: 60 }),
      note('newest', { lastOpenedAt: 30 }),
      note('edited-only', { updatedAt: 100 }),
    ]);
    const projection = buildHomeFoundationProjection({ notes, workouts: [], plannerProjection: null,
      recentActivity: { groups: [], isEmpty: true, generatedAt: '' }, accountId: 'account-a', todayKey: '2026-06-23' });
    expect(projection.continueItem).toMatchObject({ kind: 'note', noteId: 'newest' });
    expect(notes.map(item => item.id)).toEqual(['older', 'deleted', 'newest', 'edited-only']);
  });

  it.each([undefined, 0, -1, NaN, Infinity])('does not offer a Note with invalid/missing lastOpenedAt %s', lastOpenedAt => {
    const projection = buildHomeFoundationProjection({ notes: [note('unopened', { lastOpenedAt })], workouts: [],
      plannerProjection: null, recentActivity: { groups: [], isEmpty: true, generatedAt: '' },
      accountId: 'account-a', todayKey: '2026-06-23' });
    expect(projection.continueItem).toBeNull();
  });

  it('does not use global recent workspace preferences as an empty-Notes fallback', () => {
    const raw = JSON.stringify({ pinned: [], recent: [{ workspace: {
      kind: 'saved-view', id: 'legacy-private', name: 'Legacy workspace',
    }, lastOpenedAt: 100 }] });
    localStorage.setItem('workspace-prefs-v1', raw);
    const projection = buildHomeFoundationProjection({ notes: [], workouts: [], plannerProjection: null,
      recentActivity: { groups: [], isEmpty: true, generatedAt: '' }, accountId: 'account-b', todayKey: '2026-06-23' });
    expect(projection.continueItem).toBeNull();
    expect(localStorage.getItem('workspace-prefs-v1')).toBe(raw);
  });

  it('summarizes saved workouts for today without routine progress fields', () => {
    const projection = buildHomeFoundationProjection({
      notes: [],
      workouts: [{
        id: 'w1',
        block_id: 'b1',
        exercise_blocks: { id: 'b1', name: 'Bench', type: 'strength' },
        sets: [{ type: 'strength', set: 1, kg: 60, reps: 8, done: true }],
      }],
      plannerProjection: null,
      recentActivity: { groups: [], isEmpty: true, generatedAt: '' },
      accountId: 'account-a',
      todayKey: '2026-06-23',
    });

    expect(projection.workout.hasSession).toBe(true);
    expect(projection.workout.isLocked).toBe(true);
    expect(projection.workout.exerciseCount).toBe(1);
    expect(projection).not.toHaveProperty('activeRoutines');
    expect(projection).not.toHaveProperty('completedRoutines');
  });

  it('bypasses the mutating legacy draft helper in the explicit composite branch', () => {
    const accountId = 'account-a', todayKey = '2026-10-01';
    localStorage.setItem(`healthDraft:${accountId}:${todayKey}`, '{broken');
    const workoutComposite = buildHomeWorkoutCompositeProjection({ accountId, localDate: todayKey,
      read: { phase: 'loading', accountId, localDate: todayKey, cacheKey: null, result: null,
        legacyDaily: null, isolationError: false, retry: vi.fn() },
      draft: { accountId, localDate: todayKey, status: 'unavailable' } });
    const projection = buildHomeFoundationProjection({ notes: [], workouts: [],
      plannerProjection: null, recentActivity: { groups: [], isEmpty: true, generatedAt: '' },
      accountId, todayKey, workoutComposite });
    expect(projection.workout).toBe(workoutComposite);
    expect(localStorage.getItem(`healthDraft:${accountId}:${todayKey}`)).toBe('{broken');
  });
});
