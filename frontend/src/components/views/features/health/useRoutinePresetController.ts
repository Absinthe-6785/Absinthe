import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { HealthRoutine, WorkoutSet } from '@/types';
import type { HealthAccountGenerationToken } from '../../../../lib/healthBackfillUiSafety';
import type { HealthRoutinePersistence } from '../../../../lib/healthRoutineSync';
import {
  createEmptyRoutinePreset,
  createRoutinePresetId,
  createRoutinePresetState,
  readRoutinePresetState,
  routinePresetById,
  routinePresetPlannedSetCount,
  routinePresetToHealthRoutines,
  sanitizeRoutinePresetName,
  syncLegacyDefaultRoutinePreset,
  updateRoutinePresetState,
  writeRoutinePresetState,
  type RoutinePresetState,
} from './routinePresets';

export type RoutinePresetMutationResult = {
  ok: boolean;
  changed: boolean;
  state: RoutinePresetState;
  accountOperation: HealthAccountGenerationToken;
};

export type RoutinePresetConfirmation = {
  accountOperation: HealthAccountGenerationToken;
  clear: () => void;
};

export type RoutinePresetControllerInput = {
  accountId: string;
  healthRoutines: readonly HealthRoutine[];
  accountOperation: HealthAccountGenerationToken;
  isCurrentAccountOperation: (token: HealthAccountGenerationToken) => boolean;
  onPresetConfirmationInvalidated?: () => void;
  persistence?: HealthRoutinePersistence;
};

export type RoutinePresetController = {
  routinePresetState: RoutinePresetState;
  activePreset: ReturnType<typeof routinePresetById>;
  selectedHealthRoutines: HealthRoutine[];
  accountReady: boolean;
  splitCount: number;
  presetConfirmAccountId: string | null;
  createPreset: (name: string) => Promise<RoutinePresetMutationResult>;
  duplicatePreset: (name: string) => Promise<RoutinePresetMutationResult>;
  renamePreset: (presetId: string, name: string) => Promise<RoutinePresetMutationResult>;
  deletePreset: (presetId: string) => Promise<RoutinePresetMutationResult>;
  selectPreset: (presetId: string) => Promise<RoutinePresetMutationResult>;
  setPresetSplit: (presetId: string, splitCount: number) => Promise<RoutinePresetMutationResult>;
  setPresetDay: (input: {
    presetId: string;
    dayName: string;
    blocks: string[];
    plannedSets: Record<string, number>;
  }) => Promise<RoutinePresetMutationResult>;
  getPlannedSetCount: (
    dayName: string,
    blockId: string,
    blockType: string,
    prevSets?: readonly WorkoutSet[],
  ) => number;
  beginPresetConfirmation: () => RoutinePresetConfirmation | null;
  clearPresetConfirmationMarker: () => void;
  rehydrateForAccount: () => Promise<RoutinePresetState | null>;
};

function initialRoutinePresetState(
  accountId: string,
  routines: readonly HealthRoutine[],
): RoutinePresetState {
  return readRoutinePresetState(localStorage, accountId)
    ?? createRoutinePresetState({ routines, splitCount: 3 });
}

export function useRoutinePresetController({
  accountId,
  healthRoutines,
  accountOperation,
  isCurrentAccountOperation,
  onPresetConfirmationInvalidated,
  persistence,
}: RoutinePresetControllerInput): RoutinePresetController {
  const [routinePresetBinding, setRoutinePresetBinding] = useState<{
    accountId: string | null;
    state: RoutinePresetState;
  }>(() => ({
    accountId: persistence ? null : accountId,
    state: initialRoutinePresetState(accountId, healthRoutines),
  }));
  const routinePresetState = routinePresetBinding.accountId === accountId
    ? routinePresetBinding.state
    : initialRoutinePresetState(accountId, healthRoutines);
  const accountReady = routinePresetBinding.accountId === accountId;
  const routinePresetStateRef = useRef(routinePresetState);
  routinePresetStateRef.current = routinePresetState;
  const mutationQueueRef = useRef<Promise<unknown>>(Promise.resolve());

  const [presetConfirmAccountId, setPresetConfirmAccountId] = useState<string | null>(null);
  const presetConfirmAccountIdRef = useRef<string | null>(null);

  const clearPresetConfirmationMarker = useCallback(() => {
    presetConfirmAccountIdRef.current = null;
    setPresetConfirmAccountId(null);
  }, []);

  const rehydrateForAccount = useCallback(async (): Promise<RoutinePresetState | null> => {
    if (!isCurrentAccountOperation(accountOperation)) return null;
    const existing = readRoutinePresetState(localStorage, accountId);
    const legacyState = existing ?? createRoutinePresetState({ routines: healthRoutines, splitCount: 3 });
    let next = legacyState;
    try {
      if (persistence) {
        next = await persistence.bootstrap({
          accountId,
          legacyState,
          hasAccountScopedState: existing !== null,
        });
      }
    } catch {
      return null;
    }
    if (!isCurrentAccountOperation(accountOperation)) return null;
    routinePresetStateRef.current = next;
    setRoutinePresetBinding({ accountId, state: next });
    // This account-scoped key remains a compatibility/recovery cache. The
    // durable local database is authoritative whenever persistence is active.
    if (!existing || persistence) writeRoutinePresetState(localStorage, accountId, next);
    return next;
  }, [accountId, accountOperation, healthRoutines, isCurrentAccountOperation, persistence]);

  // Account identity is the synchronous reset boundary. The render-time
  // accountReady gate above prevents the previous account's state from being
  // displayed while this effect persists the new account binding.
  useEffect(() => {
    const previousPresetConfirmAccountId = presetConfirmAccountIdRef.current;
    if (previousPresetConfirmAccountId && previousPresetConfirmAccountId !== accountId
      && presetConfirmAccountIdRef.current === previousPresetConfirmAccountId) {
      clearPresetConfirmationMarker();
      onPresetConfirmationInvalidated?.();
    }
    void rehydrateForAccount();
  // The account identity is the reset boundary; row reconciliation is below.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  useEffect(() => {
    if (!accountReady || persistence) return;
    const next = syncLegacyDefaultRoutinePreset(routinePresetState, {
      routines: healthRoutines,
      splitCount: routinePresetById(routinePresetState).splitCount,
    });
    if (next !== routinePresetState) {
      if (writeRoutinePresetState(localStorage, accountId, next)) {
        setRoutinePresetBinding({ accountId, state: next });
      }
    }
  }, [accountId, accountReady, healthRoutines, persistence, routinePresetState]);

  useEffect(() => {
    if (!persistence || !accountReady) return;
    const handleOnline = () => {
      void persistence.sync(accountId).then(next => {
        if (!next || !isCurrentAccountOperation(accountOperation)) return;
        routinePresetStateRef.current = next;
        writeRoutinePresetState(localStorage, accountId, next);
        setRoutinePresetBinding({ accountId, state: next });
      }).catch(() => undefined);
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [accountId, accountOperation, accountReady, isCurrentAccountOperation, persistence]);

  const currentOperation = useCallback(() => (
    accountReady && isCurrentAccountOperation(accountOperation)
  ), [accountOperation, accountReady, isCurrentAccountOperation]);

  const mutationFailure = useCallback((): RoutinePresetMutationResult => ({
    ok: false,
    changed: false,
    state: routinePresetStateRef.current,
    accountOperation,
  }), [accountOperation]);

  const startBackgroundSync = useCallback(() => {
    if (!persistence) return;
    void persistence.sync(accountId).then(next => {
      if (!next || !currentOperation()) return;
      routinePresetStateRef.current = next;
      writeRoutinePresetState(localStorage, accountId, next);
      setRoutinePresetBinding({ accountId, state: next });
    }).catch(() => undefined);
  }, [accountId, currentOperation, persistence]);

  const commitState = useCallback(async (next: RoutinePresetState): Promise<RoutinePresetMutationResult> => {
    if (!currentOperation()) return mutationFailure();
    if (next === routinePresetStateRef.current) {
      return {
        ok: true,
        changed: false,
        state: next,
        accountOperation,
      };
    }
    const previous = routinePresetStateRef.current;
    let committed = next;
    try {
      if (persistence) committed = await persistence.commitState(accountId, previous, next);
      else if (!writeRoutinePresetState(localStorage, accountId, next)) return mutationFailure();
    } catch {
      return mutationFailure();
    }
    if (!currentOperation()) return mutationFailure();
    if (persistence) writeRoutinePresetState(localStorage, accountId, committed);
    routinePresetStateRef.current = committed;
    setRoutinePresetBinding({ accountId, state: committed });
    startBackgroundSync();
    return {
      ok: true,
      changed: true,
      state: committed,
      accountOperation,
    };
  }, [accountId, accountOperation, currentOperation, mutationFailure, persistence, startBackgroundSync]);

  const runMutation = useCallback((
    buildNext: (current: RoutinePresetState) => RoutinePresetState,
  ): Promise<RoutinePresetMutationResult> => {
    const operation = mutationQueueRef.current.then(() => (
      commitState(buildNext(routinePresetStateRef.current))
    ));
    mutationQueueRef.current = operation.then(() => undefined, () => undefined);
    return operation;
  }, [commitState]);

  const applyAction = useCallback((action: Parameters<typeof updateRoutinePresetState>[1]) => (
    runMutation(current => updateRoutinePresetState(current, action))
  ), [runMutation]);

  const createPreset = useCallback((name: string) => applyAction({
    type: 'create',
    preset: createEmptyRoutinePreset(createRoutinePresetId(), sanitizeRoutinePresetName(name)),
  }), [applyAction]);

  const duplicatePreset = useCallback((name: string) => runMutation(current => {
    const activePreset = routinePresetById(current);
    return updateRoutinePresetState(current, {
      type: 'duplicate',
      sourcePresetId: activePreset.id,
      preset: {
        ...activePreset,
        id: createRoutinePresetId(),
        name: sanitizeRoutinePresetName(name),
        days: activePreset.days.map(day => ({
          ...day,
          blocks: [...day.blocks],
          plannedSets: { ...day.plannedSets },
          legacyRoutineId: undefined,
        })),
      },
    });
  }), [runMutation]);

  const renamePreset = useCallback((presetId: string, name: string) => runMutation(current => (
    updateRoutinePresetState(current, {
      type: 'rename',
      presetId,
      name: sanitizeRoutinePresetName(name, routinePresetById(current, presetId).name),
    })
  )), [runMutation]);

  const deletePreset = useCallback((presetId: string) => applyAction({ type: 'delete', presetId }), [applyAction]);
  const selectPreset = useCallback((presetId: string) => applyAction({ type: 'switch', presetId }), [applyAction]);
  const setPresetSplit = useCallback((presetId: string, splitCount: number) => applyAction({
    type: 'set-split',
    presetId,
    splitCount,
  }), [applyAction]);

  const setPresetDay = useCallback(async (input: {
    presetId: string;
    dayName: string;
    blocks: string[];
    plannedSets: Record<string, number>;
  }): Promise<RoutinePresetMutationResult> => {
    if (!currentOperation()) return mutationFailure();
    return runMutation(current => updateRoutinePresetState(current, {
      type: 'set-day',
      presetId: input.presetId,
      dayName: input.dayName,
      blocks: input.blocks,
      plannedSets: input.plannedSets,
    }));
  }, [currentOperation, mutationFailure, runMutation]);

  const activePreset = routinePresetById(routinePresetState);
  const selectedHealthRoutines = useMemo(
    () => routinePresetToHealthRoutines(activePreset),
    [activePreset],
  );
  const getPlannedSetCount = useCallback((
    dayName: string,
    blockId: string,
    blockType: string,
    prevSets?: readonly WorkoutSet[],
  ) => routinePresetPlannedSetCount(activePreset, dayName, blockId, blockType, prevSets), [activePreset]);

  const beginPresetConfirmation = useCallback((): RoutinePresetConfirmation | null => {
    if (!currentOperation()) return null;
    presetConfirmAccountIdRef.current = accountId;
    setPresetConfirmAccountId(accountId);
    return {
      accountOperation,
      clear: () => {
        if (presetConfirmAccountIdRef.current === accountId) clearPresetConfirmationMarker();
      },
    };
  }, [accountId, accountOperation, clearPresetConfirmationMarker, currentOperation]);

  return {
    routinePresetState,
    activePreset,
    selectedHealthRoutines,
    accountReady,
    splitCount: activePreset.splitCount,
    presetConfirmAccountId,
    createPreset,
    duplicatePreset,
    renamePreset,
    deletePreset,
    selectPreset,
    setPresetSplit,
    setPresetDay,
    getPlannedSetCount,
    beginPresetConfirmation,
    clearPresetConfirmationMarker,
    rehydrateForAccount,
  };
}
