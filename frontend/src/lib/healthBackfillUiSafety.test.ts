import { beforeEach, describe, expect, it } from 'vitest';
import type { Workout } from '../types';
import {
  isCurrentHealthAccountGeneration,
  localHealthDraftKey,
  localHealthMemoKey,
  localHealthWriteFailureDisposition,
  readLocalHealthWorkoutDraft,
} from './healthBackfillUiSafety';
import { LocalHealthWriteConflictError } from './healthLocalRepository';

const storage = new Map<string, string>();
const localStorageLike: Pick<Storage, 'getItem' | 'removeItem'> = {
  getItem: key => storage.get(key) ?? null,
  removeItem: key => { storage.delete(key); },
};

function draft(id: string): Workout[] {
  return [{
    id,
    block_id: `block-${id}`,
    exercise_blocks: { id: `block-${id}`, name: id, type: 'strength' },
    sets: [{ type: 'strength', set: 1, kg: 60, reps: 8, done: false }],
    local_version: null,
  }];
}

beforeEach(() => storage.clear());

describe('local Health backfill UI account isolation', () => {
  it('namespaces workout drafts and memos by account and date without reading a legacy draft', () => {
    const date = '2026-08-12';
    storage.set(`healthDraft:${date}`, JSON.stringify(draft('legacy')));
    storage.set(localHealthDraftKey('account-a', date), JSON.stringify(draft('a')));

    expect(localHealthDraftKey('account-a', date)).not.toBe(localHealthDraftKey('account-b', date));
    expect(localHealthMemoKey('account-a', date)).not.toBe(localHealthMemoKey('account-b', date));
    expect(readLocalHealthWorkoutDraft(localStorageLike, 'account-a', date)?.[0].id).toBe('a');
    expect(readLocalHealthWorkoutDraft(localStorageLike, 'account-b', date)).toBeNull();
    expect(storage.has(`healthDraft:${date}`)).toBe(true);
  });

  it('hydrates only the active account draft and restores the first account after switching back', () => {
    const date = '2026-08-12';
    storage.set(localHealthDraftKey('account-a', date), JSON.stringify(draft('a')));
    storage.set(localHealthDraftKey('account-b', date), JSON.stringify(draft('b')));

    const activeA = readLocalHealthWorkoutDraft(localStorageLike, 'account-a', date);
    const activeB = readLocalHealthWorkoutDraft(localStorageLike, 'account-b', date);
    const restoredA = readLocalHealthWorkoutDraft(localStorageLike, 'account-a', date);
    expect(activeA?.[0].id).toBe('a');
    expect(activeB?.[0].id).toBe('b');
    expect(restoredA).toEqual(activeA);
  });

  it('rejects a stale account-generation completion without clearing the current draft or dirty state', () => {
    const accountAToken = { accountId: 'account-a', generation: 3 } as const;
    let activeDraft = draft('b');
    let dirty = true;
    const accountB = 'account-b';
    const generationB = 4;

    if (isCurrentHealthAccountGeneration(accountAToken, accountB, generationB)) {
      activeDraft = [];
      dirty = false;
    }

    expect(isCurrentHealthAccountGeneration(accountAToken, accountB, generationB)).toBe(false);
    expect(activeDraft[0].id).toBe('b');
    expect(dirty).toBe(true);
  });

  it('keeps draft and dirty truth for conflicts, validation failures, and storage failures', () => {
    const failures = [
      new LocalHealthWriteConflictError('workout'),
      new Error('health_local_workout_date_invalid'),
      new Error('health_indexeddb_transaction_aborted'),
    ];
    const dispositions = failures.map(localHealthWriteFailureDisposition);

    expect(dispositions.map(value => value.kind)).toEqual(['conflict', 'failure', 'failure']);
    for (const disposition of dispositions) {
      expect(disposition).toMatchObject({
        clearDraft: false,
        clearDirty: false,
        showSuccess: false,
      });
    }
  });
});
