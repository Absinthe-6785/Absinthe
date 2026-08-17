import type { Workout } from '../types';
import { isLocalHealthWriteConflict } from './healthLocalRepository';

export type HealthAccountGenerationToken = Readonly<{
  accountId: string;
  generation: number;
}>;

export function localHealthDraftKey(accountId: string, date: string): string {
  return `healthDraft:${accountId}:${date}`;
}
export function localHealthMemoKey(accountId: string, date: string): string {
  return `healthMemo:${accountId}:${date}`;
}

export function readLocalHealthWorkoutDraft(
  storage: Pick<Storage, 'getItem' | 'removeItem'>,
  accountId: string,
  date: string,
): Workout[] | null {
  const key = localHealthDraftKey(accountId, date);
  const raw = storage.getItem(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed as Workout[] : null;
  } catch {
    storage.removeItem(key);
    return null;
  }
}

export function isCurrentHealthAccountGeneration(
  token: HealthAccountGenerationToken,
  accountId: string,
  generation: number,
): boolean {
  return token.accountId === accountId && token.generation === generation;
}

export type LocalHealthWriteFailureDisposition = Readonly<{
  kind: 'conflict' | 'failure';
  clearDraft: false;
  clearDirty: false;
  showSuccess: false;
}>;

export function localHealthWriteFailureDisposition(
  error: unknown,
): LocalHealthWriteFailureDisposition {
  return {
    kind: isLocalHealthWriteConflict(error) ? 'conflict' : 'failure',
    clearDraft: false,
    clearDirty: false,
    showSuccess: false,
  };
}
