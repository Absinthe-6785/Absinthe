import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildHomeFoundationProjection } from './buildHomeFoundationProjection';
import type { NoteBase } from '../../noteUtils';

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

describe('buildHomeFoundationProjection', () => {
  it('prioritizes resume workspace over last opened note', () => {
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

    const projection = buildHomeFoundationProjection({
      notes: [note('n1', { lastOpenedAt: Date.now() })],
      routines: [],
      workouts: [],
      plannerProjection: null,
      recentActivity: { groups: [], isEmpty: true, generatedAt: '' },
      accountId: 'account-a',
      todayKey: '2026-06-23',
    });

    expect(projection.continueItem?.kind).toBe('workspace');
    expect(projection.continueItem?.title).toBe('Recent notes');
  });

  it('summarizes saved workouts for today', () => {
    const projection = buildHomeFoundationProjection({
      notes: [],
      routines: [{ id: 'r1', text: 'Stretch', done: true, is_active: true }],
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
    expect(projection.completedRoutines).toBe(1);
  });
});
