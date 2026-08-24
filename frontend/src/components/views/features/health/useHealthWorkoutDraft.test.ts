// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Workout } from '../../../../types';
import { localHealthDraftKey } from '../../../../lib/healthBackfillUiSafety';
import {
  useHealthWorkoutDraft,
  type HealthWorkoutDraftState,
} from './useHealthWorkoutDraft';

const workout = (id = 'workout-1'): Workout => ({
  id,
  block_id: 'block-1',
  exercise_blocks: { id: 'block-1', name: 'Bench Press', type: 'strength' },
  sets: [{ type: 'strength', set: 1, kg: '', reps: '', done: false }],
});

describe('useHealthWorkoutDraft', () => {
  let root: Root;
  let host: HTMLDivElement;
  let latest: HealthWorkoutDraftState;

  function Probe({ accountId, dateKey, onDraftRestored }: {
    accountId: string;
    dateKey: string;
    onDraftRestored?: () => void;
  }) {
    latest = useHealthWorkoutDraft({ accountId, dateKey, onDraftRestored });
    return null;
  }

  async function renderScope(accountId: string, dateKey: string, onDraftRestored?: () => void) {
    await act(async () => {
      root.render(createElement(Probe, { accountId, dateKey, onDraftRestored }));
    });
    await act(async () => {});
  }

  beforeEach(() => {
    localStorage.clear();
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    localStorage.clear();
  });

  it('starts clean, accepts loaded workouts, and keeps hydration clean', async () => {
    await renderScope('account-a', '2026-08-24');

    expect(latest.localWorkouts).toEqual([]);
    expect(latest.isDirty).toBe(false);
    expect(latest.rawKgInput).toEqual({});

    await act(async () => latest.replaceFromHydration([workout()]));

    expect(latest.localWorkouts).toHaveLength(1);
    expect(latest.isDirty).toBe(false);
  });

  it('marks canonical edits dirty while raw input remains a separate UI buffer', async () => {
    await renderScope('account-a', '2026-08-24');
    const edited = workout();
    edited.sets[0] = {
      ...edited.sets[0],
      kg: 102.34567,
      weight_input_raw: '102.34567',
      weight_input_unit: 'kg',
    };

    await act(async () => {
      latest.setLocalWorkouts([edited]);
      latest.setIsDirty(true);
      latest.setRawKgInput({ '0-0': '102.34567' });
    });

    expect(latest.isDirty).toBe(true);
    expect(latest.localWorkouts[0].sets[0]).toMatchObject({ kg: 102.34567 });
    expect(latest.rawKgInput).toEqual({ '0-0': '102.34567' });
    expect(JSON.parse(localStorage.getItem(localHealthDraftKey('account-a', '2026-08-24'))!)).toEqual([edited]);
  });

  it('restores only the valid account/date draft and reports the restoration', async () => {
    const stored = [workout('stored-a')];
    localStorage.setItem(localHealthDraftKey('account-a', '2026-08-24'), JSON.stringify(stored));
    const onDraftRestored = vi.fn();

    await renderScope('account-a', '2026-08-24', onDraftRestored);

    expect(latest.localWorkouts).toEqual(stored);
    expect(latest.isDirty).toBe(true);
    expect(onDraftRestored).toHaveBeenCalledTimes(1);
  });

  it('uses the clean no-draft fallback when only server hydration is available', async () => {
    await renderScope('account-a', '2026-08-24');
    const hydrated = [workout('server-a')];

    await act(async () => latest.replaceFromHydration(hydrated));

    expect(latest.localWorkouts).toEqual(hydrated);
    expect(latest.isDirty).toBe(false);
    expect(localStorage.getItem(localHealthDraftKey('account-a', '2026-08-24'))).toBeNull();
  });

  it('clears prior-date draft/input state before entering a new date scope', async () => {
    await renderScope('account-a', '2026-08-24');
    await act(async () => {
      latest.setLocalWorkouts([workout('draft-a')]);
      latest.setIsDirty(true);
      latest.setRawKgInput({ '0-0': '225.678' });
    });

    await renderScope('account-a', '2026-08-25');

    expect(latest.localWorkouts).toEqual([]);
    expect(latest.isDirty).toBe(false);
    expect(latest.rawKgInput).toEqual({});
    expect(localStorage.getItem(localHealthDraftKey('account-a', '2026-08-25'))).toBeNull();
    expect(localStorage.getItem(localHealthDraftKey('account-a', '2026-08-24'))).not.toBeNull();
  });

  it('does not expose one account draft when switching account scope', async () => {
    localStorage.setItem(
      localHealthDraftKey('account-b', '2026-08-24'),
      JSON.stringify([workout('stored-b')]),
    );
    await renderScope('account-a', '2026-08-24');
    await act(async () => {
      latest.setLocalWorkouts([workout('draft-a')]);
      latest.setIsDirty(true);
      latest.setRawKgInput({ '0-0': '100' });
    });

    await renderScope('account-b', '2026-08-24');

    expect(latest.localWorkouts.map(item => item.id)).toEqual(['stored-b']);
    expect(latest.isDirty).toBe(true);
    expect(latest.rawKgInput).toEqual({});
  });

  it('clears dirty state and the transient draft only after save acknowledgement', async () => {
    await renderScope('account-a', '2026-08-24');
    await act(async () => {
      latest.setLocalWorkouts([workout('draft-a')]);
      latest.setIsDirty(true);
    });
    const key = localHealthDraftKey('account-a', '2026-08-24');
    expect(localStorage.getItem(key)).not.toBeNull();

    await act(async () => latest.clearDirtyAfterSave());

    expect(latest.isDirty).toBe(false);
    expect(latest.isDirtyRef.current).toBe(false);
    expect(localStorage.getItem(key)).toBeNull();
  });

  it('leaves dirty state and the draft intact when save acknowledgement is absent', async () => {
    await renderScope('account-a', '2026-08-24');
    await act(async () => {
      latest.setLocalWorkouts([workout('draft-a')]);
      latest.setIsDirty(true);
    });

    expect(latest.isDirty).toBe(true);
    expect(latest.isDirtyRef.current).toBe(true);
    expect(localStorage.getItem(localHealthDraftKey('account-a', '2026-08-24'))).not.toBeNull();
  });
});
