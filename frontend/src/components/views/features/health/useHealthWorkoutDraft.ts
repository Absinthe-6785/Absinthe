import { useCallback, useEffect, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { Workout } from '../../../../types';
import { localHealthDraftKey, readLocalHealthWorkoutDraft } from '../../../../lib/healthBackfillUiSafety';

export type HealthWorkoutDraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export interface UseHealthWorkoutDraftOptions {
  accountId: string;
  dateKey: string;
  onDraftRestored?: () => void;
  storage?: HealthWorkoutDraftStorage;
}

export interface HealthWorkoutDraftState {
  localWorkouts: Workout[];
  setLocalWorkouts: Dispatch<SetStateAction<Workout[]>>;
  isDirty: boolean;
  setIsDirty: Dispatch<SetStateAction<boolean>>;
  isDirtyRef: MutableRefObject<boolean>;
  rawKgInput: Record<string, string>;
  setRawKgInput: Dispatch<SetStateAction<Record<string, string>>>;
  replaceFromHydration: (workouts: Workout[]) => void;
  clearStoredDraft: () => void;
  clearDirtyAfterSave: () => void;
}

/**
 * The single editable Today-workout draft authority.
 *
 * This boundary deliberately stops at transient draft/input state. Canonical
 * workout save/delete, lock policy, SWR hydration ownership, and account
 * generation safety remain in HealthView until a later extraction phase.
 */
export function useHealthWorkoutDraft({
  accountId,
  dateKey,
  onDraftRestored,
  storage: storageOverride,
}: UseHealthWorkoutDraftOptions): HealthWorkoutDraftState {
  const storage = storageOverride ?? localStorage;
  const draftKey = localHealthDraftKey(accountId, dateKey);
  const onDraftRestoredRef = useRef(onDraftRestored);
  onDraftRestoredRef.current = onDraftRestored;

  const [localWorkouts, setLocalWorkouts] = useState<Workout[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const isDirtyRef = useRef(false);
  const scopeTransitionRef = useRef(false);
  const [rawKgInput, setRawKgInput] = useState<Record<string, string>>({});

  // Keep the ref synchronized for the SWR hydration guard. The ref is also
  // reset synchronously by the scope transition below to avoid stale writes.
  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  // Account/date is the draft scope boundary. Reset first, then restore only
  // the draft belonging to the new scope; no previous scope is reused.
  useEffect(() => {
    // The persistence effect below observes the previous render snapshot. Skip
    // that one pass so an old account/date draft cannot be written under the
    // new scope key during this transition.
    scopeTransitionRef.current = true;
    setLocalWorkouts([]);
    setIsDirty(false);
    isDirtyRef.current = false;
    setRawKgInput({});

    const draft = readLocalHealthWorkoutDraft(storage, accountId, dateKey);
    if (draft && draft.length > 0) {
      setLocalWorkouts(draft);
      setIsDirty(true);
      isDirtyRef.current = true;
      onDraftRestoredRef.current?.();
    }
  }, [accountId, dateKey, draftKey, storage]);

  // Preserve the existing timing and condition for transient draft writes.
  useEffect(() => {
    if (scopeTransitionRef.current) {
      scopeTransitionRef.current = false;
      return;
    }
    if (isDirty && localWorkouts.length > 0) {
      storage.setItem(draftKey, JSON.stringify(localWorkouts));
    }
  }, [localWorkouts, isDirty, draftKey, storage]);

  const clearStoredDraft = useCallback(() => {
    storage.removeItem(draftKey);
  }, [draftKey, storage]);

  const clearDirtyAfterSave = useCallback(() => {
    isDirtyRef.current = false;
    setIsDirty(false);
    storage.removeItem(draftKey);
  }, [draftKey, storage]);

  const replaceFromHydration = useCallback((workouts: Workout[]) => {
    setLocalWorkouts(workouts);
  }, []);

  return {
    localWorkouts,
    setLocalWorkouts,
    isDirty,
    setIsDirty,
    isDirtyRef,
    rawKgInput,
    setRawKgInput,
    replaceFromHydration,
    clearStoredDraft,
    clearDirtyAfterSave,
  };
}
