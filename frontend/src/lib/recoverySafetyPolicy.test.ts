import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  K326_LEGACY_WRITE_FENCE_KEY,
  RECOVERY_MODE_MESSAGE,
  LegacyCutoverFenceError,
  RecoveryModeBlockedError,
  activateRecoveryMode,
  assertCurrentOperationEpoch,
  beginLegacyNotesCutoverFence,
  cancelLegacyNotesCutoverFence,
  captureOperationEpoch,
  clearLegacyNotesCutoverFenceForTest,
  createLegacyNotesCutoverFenceIdentity,
  createRecoveryCutoverAuthorization,
  isLegacyCutoverFenceIdentity,
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
  readLegacyNotesCutoverFence,
  resetRecoverySafetyDiagnosticsForTest,
  setRecoveryModeActiveForTest,
} from './recoverySafetyPolicy';

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; }, clear: () => values.clear(),
    getItem: key => values.get(key) ?? null, key: index => [...values.keys()][index] ?? null,
    removeItem: key => { values.delete(key); }, setItem: (key, value) => { values.set(key, String(value)); },
  };
}

describe('K-319 recovery safety policy', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage());
    setRecoveryModeActiveForTest(true);
    clearLegacyNotesCutoverFenceForTest();
  });

  afterEach(() => vi.unstubAllGlobals());

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

  it('binds each physical fence to a unique nonce and monotonic epoch with exact read-back', () => {
    const authorization = createRecoveryCutoverAuthorization({
      namespaceKey: 'a'.repeat(64), cutoverSessionId: 'cutover-1', targetGenerationId: 'generation-1', purpose: 'test',
    });
    const first = createLegacyNotesCutoverFenceIdentity(authorization);
    const second = createLegacyNotesCutoverFenceIdentity(authorization);
    expect(first.fenceNonce).toMatch(/^[a-f0-9]{32}$/);
    expect(second.fenceNonce).not.toBe(first.fenceNonce);
    expect(second.fenceEpoch).toBeGreaterThan(first.fenceEpoch);
    expect(beginLegacyNotesCutoverFence(authorization, first)).toMatchObject({ ...first, version: 2, phase: 'activating' });
    expect(readLegacyNotesCutoverFence()).toMatchObject(first);
    expect(() => beginLegacyNotesCutoverFence(authorization, second)).toThrow(LegacyCutoverFenceError);
    expect(readLegacyNotesCutoverFence()).toMatchObject(first);
    cancelLegacyNotesCutoverFence(authorization, first);
    expect(readLegacyNotesCutoverFence()).toBeNull();
  });

  it('rejects changed epochs, unknown fields, malformed nonces, and inherited identity properties', () => {
    const authorization = createRecoveryCutoverAuthorization({
      namespaceKey: 'b'.repeat(64), cutoverSessionId: 'cutover-2', targetGenerationId: 'generation-2', purpose: 'test',
    });
    const identity = createLegacyNotesCutoverFenceIdentity(authorization);
    beginLegacyNotesCutoverFence(authorization, identity);
    expect(() => cancelLegacyNotesCutoverFence(authorization, { ...identity, fenceEpoch: identity.fenceEpoch + 1 }))
      .toThrow(LegacyCutoverFenceError);
    localStorage.setItem(K326_LEGACY_WRITE_FENCE_KEY, JSON.stringify({
      version: 2, ...identity, phase: 'activating', unknown: true,
    }));
    expect(readLegacyNotesCutoverFence()).toBe('corrupt');
    expect(isLegacyCutoverFenceIdentity({ ...identity, fenceNonce: 'not-a-nonce' })).toBe(false);
    const inherited = Object.create({ namespaceKey: identity.namespaceKey });
    Object.assign(inherited, {
      cutoverSessionId: identity.cutoverSessionId, targetGenerationId: identity.targetGenerationId,
      fenceNonce: identity.fenceNonce, fenceEpoch: identity.fenceEpoch,
    });
    expect(isLegacyCutoverFenceIdentity(inherited)).toBe(false);
  });
});
