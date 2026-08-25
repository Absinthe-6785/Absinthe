import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { HealthRoutine, WorkoutSet } from '@/types';
import type { HealthAccountGenerationToken } from '../../../../lib/healthBackfillUiSafety';
import {
  DEFAULT_ROUTINE_PRESET_ID,
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

export type RoutinePresetProjectionIntent = {
  accountId: string;
  accountOperation: HealthAccountGenerationToken;
  dayName: string;
  blocks: string[];
  existingRoutineId?: string;
};

export type RoutinePresetMutationResult = {
  ok: boolean;
  changed: boolean;
  state: RoutinePresetState;
  accountOperation: HealthAccountGenerationToken;
  projection?: RoutinePresetProjectionIntent;
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
};

export type RoutinePresetController = {
  routinePresetState: RoutinePresetState;
  activePreset: ReturnType<typeof routinePresetById>;
  selectedHealthRoutines: HealthRoutine[];
  accountReady: boolean;
  splitCount: number;
  presetConfirmAccountId: string | null;
  createPreset: (name: string) => RoutinePresetMutationResult;
  duplicatePreset: (name: string) => RoutinePresetMutationResult;
  renamePreset: (presetId: string, name: string) => RoutinePresetMutationResult;
  deletePreset: (presetId: string) => RoutinePresetMutationResult;
  selectPreset: (presetId: string) => RoutinePresetMutationResult;
  setPresetSplit: (presetId: string, splitCount: number) => RoutinePresetMutationResult;
  setPresetDay: (input: {
    presetId: string;
    dayName: string;
    blocks: string[];
    plannedSets: Record<string, number>;
  }) => RoutinePresetMutationResult;
  getPlannedSetCount: (
    dayName: string,
    blockId: string,
    blockType: string,
    prevSets?: readonly WorkoutSet[],
  ) => number;
  beginPresetConfirmation: () => RoutinePresetConfirmation | null;
  clearPresetConfirmationMarker: () => void;
  rehydrateForAccount: () => RoutinePresetState | null;
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
}: RoutinePresetControllerInput): RoutinePresetController {
  const [routinePresetBinding, setRoutinePresetBinding] = useState<{
    accountId: string;
    state: RoutinePresetState;
  }>(() => ({
    accountId,
    state: initialRoutinePresetState(accountId, healthRoutines),
  }));
  const routinePresetState = routinePresetBinding.accountId === accountId
    ? routinePresetBinding.state
    : initialRoutinePresetState(accountId, healthRoutines);
  const accountReady = routinePresetBinding.accountId === accountId;
  const routinePresetStateRef = useRef(routinePresetState);
  routinePresetStateRef.current = routinePresetState;

  const [presetConfirmAccountId, setPresetConfirmAccountId] = useState<string | null>(null);
  const presetConfirmAccountIdRef = useRef<string | null>(null);

  const clearPresetConfirmationMarker = useCallback(() => {
    presetConfirmAccountIdRef.current = null;
    setPresetConfirmAccountId(null);
  }, []);

  const rehydrateForAccount = useCallback((): RoutinePresetState | null => {
    if (!isCurrentAccountOperation(accountOperation)) return null;
    const next = initialRoutinePresetState(accountId, healthRoutines);
    routinePresetStateRef.current = next;
    setRoutinePresetBinding({ accountId, state: next });
    if (!readRoutinePresetState(localStorage, accountId)) writeRoutinePresetState(localStorage, accountId, next);
    return next;
  }, [accountId, accountOperation, healthRoutines, isCurrentAccountOperation]);

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
    rehydrateForAccount();
  // The account identity is the reset boundary; row reconciliation is below.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  useEffect(() => {
    if (!accountReady) return;
    const next = syncLegacyDefaultRoutinePreset(routinePresetState, {
      routines: healthRoutines,
      splitCount: routinePresetById(routinePresetState).splitCount,
    });
    if (next !== routinePresetState) {
      if (writeRoutinePresetState(localStorage, accountId, next)) {
        setRoutinePresetBinding({ accountId, state: next });
      }
    }
  }, [accountId, accountReady, healthRoutines, routinePresetState]);

  const currentOperation = useCallback(() => (
    accountReady && isCurrentAccountOperation(accountOperation)
  ), [accountOperation, accountReady, isCurrentAccountOperation]);

  const mutationFailure = useCallback((): RoutinePresetMutationResult => ({
    ok: false,
    changed: false,
    state: routinePresetStateRef.current,
    accountOperation,
  }), [accountOperation]);

  const commitState = useCallback((next: RoutinePresetState): RoutinePresetMutationResult => {
    if (!currentOperation()) return mutationFailure();
    if (next === routinePresetStateRef.current) {
      return {
        ok: true,
        changed: false,
        state: next,
        accountOperation,
      };
    }
    if (!writeRoutinePresetState(localStorage, accountId, next)) return mutationFailure();
    routinePresetStateRef.current = next;
    setRoutinePresetBinding({ accountId, state: next });
    return {
      ok: true,
      changed: true,
      state: next,
      accountOperation,
    };
  }, [accountId, accountOperation, currentOperation, mutationFailure]);

  const applyAction = useCallback((action: Parameters<typeof updateRoutinePresetState>[1]) => (
    commitState(updateRoutinePresetState(routinePresetStateRef.current, action))
  ), [commitState]);

  const createPreset = useCallback((name: string) => applyAction({
    type: 'create',
    preset: createEmptyRoutinePreset(createRoutinePresetId(), sanitizeRoutinePresetName(name)),
  }), [applyAction]);

  const duplicatePreset = useCallback((name: string) => {
    const activePreset = routinePresetById(routinePresetStateRef.current);
    const duplicate = {
      ...activePreset,
      id: createRoutinePresetId(),
      name: sanitizeRoutinePresetName(name),
      days: activePreset.days.map(day => ({
        ...day,
        blocks: [...day.blocks],
        plannedSets: { ...day.plannedSets },
        legacyRoutineId: undefined,
      })),
    };
    return applyAction({
      type: 'duplicate',
      sourcePresetId: activePreset.id,
      preset: duplicate,
    });
  }, [applyAction]);

  const renamePreset = useCallback((presetId: string, name: string) => applyAction({
    type: 'rename',
    presetId,
    name: sanitizeRoutinePresetName(name, routinePresetById(routinePresetStateRef.current, presetId).name),
  }), [applyAction]);

  const deletePreset = useCallback((presetId: string) => applyAction({ type: 'delete', presetId }), [applyAction]);
  const selectPreset = useCallback((presetId: string) => applyAction({ type: 'switch', presetId }), [applyAction]);
  const setPresetSplit = useCallback((presetId: string, splitCount: number) => applyAction({
    type: 'set-split',
    presetId,
    splitCount,
  }), [applyAction]);

  const setPresetDay = useCallback((input: {
    presetId: string;
    dayName: string;
    blocks: string[];
    plannedSets: Record<string, number>;
  }): RoutinePresetMutationResult => {
    if (!currentOperation()) return mutationFailure();
    const current = routinePresetStateRef.current;
    const target = routinePresetById(current, input.presetId);
    const existingRoutineId = target.days.find(day => day.dayName === input.dayName)?.legacyRoutineId;
    const next = updateRoutinePresetState(current, {
      type: 'set-day',
      presetId: input.presetId,
      dayName: input.dayName,
      blocks: input.blocks,
      plannedSets: input.plannedSets,
    });
    const result = commitState(next);
    if (!result.ok || target.id !== DEFAULT_ROUTINE_PRESET_ID) return result;
    return {
      ...result,
      projection: {
        accountId,
        accountOperation,
        dayName: input.dayName,
        blocks: [...input.blocks],
        ...(existingRoutineId ? { existingRoutineId } : {}),
      },
    };
  }, [accountId, accountOperation, commitState, currentOperation, mutationFailure]);

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
