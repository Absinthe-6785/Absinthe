import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  RECOVERY_MODE_MESSAGE,
  RecoveryModeBlockedError,
  activateRecoveryMode,
  assertCurrentOperationEpoch,
  captureOperationEpoch,
  isOperationEpochCurrent,
  isRecoveryModeActive,
  mayApplyCrossTabMutation,
  mayDeleteLegacyStorage,
  mayEmptyTrash,
  mayHydrateRemote,
  mayReplacePersistedNotes,
  mayReset,
  mayRestore,
  mayUndoRestore,
  mayUploadRemote,
  recordRecoveryBlock,
  resetRecoverySafetyDiagnosticsForTest,
  setRecoveryModeActiveForTest,
} from './recoverySafetyPolicy';

describe('K-319 recovery safety policy', () => {
  beforeEach(() => setRecoveryModeActiveForTest(true));

  it('is fail-closed and exposes no unsafe operation', () => {
    expect(isRecoveryModeActive()).toBe(true);
    expect([
      mayHydrateRemote(), mayUploadRemote(), mayRestore(), mayUndoRestore(),
      mayEmptyTrash(), mayReset(), mayApplyCrossTabMutation(), mayDeleteLegacyStorage(),
    ]).toEqual([false, false, false, false, false, false, false, false]);
    expect(RECOVERY_MODE_MESSAGE).toContain('recovery mode');
  });

  it('rejects empty, malformed, and partial replacement snapshots', () => {
    const note = (id: string) => ({
      id,
      title: id,
      body: '',
      updatedAt: 1,
      folderId: null,
      deletedAt: null,
    });
    const current = [{ id: 'a' }, { id: 'b' }];
    expect(mayReplacePersistedNotes(current, [])).toBe(false);
    expect(mayReplacePersistedNotes(current, null)).toBe(false);
    expect(mayReplacePersistedNotes(current, [note('a')])).toBe(false);
    expect(mayReplacePersistedNotes(current, [note('a'), note('b')])).toBe(true);
    expect(mayReplacePersistedNotes(current, [note('a'), note('b'), note('c')])).toBe(true);
    expect(mayReplacePersistedNotes(current, [note('a'), note('a'), note('b')])).toBe(false);
    expect(mayReplacePersistedNotes(current, [{ id: 'a' }, { id: 'b' }])).toBe(false);
    expect(mayReplacePersistedNotes(null, [note('a')])).toBe(false);
  });

  it('invalidates an operation captured before a safety transition', () => {
    const epoch = captureOperationEpoch();
    expect(isOperationEpochCurrent(epoch)).toBe(true);
    activateRecoveryMode();
    expect(isOperationEpochCurrent(epoch)).toBe(false);
    expect(() => assertCurrentOperationEpoch(epoch, 'hydrate_remote'))
      .toThrow(RecoveryModeBlockedError);
  });

  it('deduplicates structured diagnostics without private payloads', () => {
    resetRecoverySafetyDiagnosticsForTest();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const first = recordRecoveryBlock('reset');
    recordRecoveryBlock('reset');
    expect(first).toMatchObject({ operation: 'reset', recoveryMode: true, reason: 'recovery_mode_active' });
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
