import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  K326_LEGACY_WRITE_FENCE_KEY,
  K326_LEGACY_WRITE_FENCE_PREFIX,
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
  deriveLegacyNotesCutoverFenceKey,
  isLegacyCutoverFenceIdentity,
  isOperationEpochCurrent,
  isRecoveryModeActive,
  mayApplyCrossTabMutation,
  mayDeleteLegacyStorage,
  mayEmptyTrash,
  mayHydrateRemote,
  mayWriteLegacyNotes,
  mayReplacePersistedNotes,
  mayReset,
  mayRestore,
  mayUndoRestore,
  mayUploadRemote,
  recordRecoveryBlock,
  readLegacyNotesCutoverFence,
  scanLegacyNotesCutoverFences,
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

function physicalFence(identity: ReturnType<typeof createLegacyNotesCutoverFenceIdentity>) {
  const key = deriveLegacyNotesCutoverFenceKey(identity);
  return {
    key,
    value: {
      kind: 'legacy_notes_cutover_fence_v3', version: 3,
      storageDigest: key.slice(K326_LEGACY_WRITE_FENCE_PREFIX.length),
      ...identity, state: 'fenced',
    },
  } as const;
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
    expect(beginLegacyNotesCutoverFence(authorization, first)).toMatchObject({ ...first, version: 3, state: 'fenced' });
    expect(beginLegacyNotesCutoverFence(authorization, first)).toMatchObject({ ...first, version: 3, state: 'fenced' });
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
    expect(cancelLegacyNotesCutoverFence(authorization, { ...identity, fenceEpoch: identity.fenceEpoch + 1 }))
      .toMatchObject({ ownFenceReleased: true, vaultState: 'blocked_by_other' });
    expect(readLegacyNotesCutoverFence()).toMatchObject(identity);
    const artifact = physicalFence(identity);
    localStorage.setItem(artifact.key, JSON.stringify({ ...artifact.value, unknown: true }));
    expect(readLegacyNotesCutoverFence()).toBe('corrupt');
    localStorage.clear();
    localStorage.setItem(`${K326_LEGACY_WRITE_FENCE_PREFIX}${'0'.repeat(64)}`, JSON.stringify(artifact.value));
    expect(scanLegacyNotesCutoverFences()).toMatchObject({ status: 'malformed' });
    expect(isLegacyCutoverFenceIdentity({ ...identity, fenceNonce: 'not-a-nonce' })).toBe(false);
    const inherited = Object.create({ namespaceKey: identity.namespaceKey });
    Object.assign(inherited, {
      cutoverSessionId: identity.cutoverSessionId, targetGenerationId: identity.targetGenerationId,
      fenceNonce: identity.fenceNonce, fenceEpoch: identity.fenceEpoch,
    });
    expect(isLegacyCutoverFenceIdentity(inherited)).toBe(false);
  });

  it('derives opaque deterministic exact-instance keys without delimiter or case aliasing', () => {
    const authorization = createRecoveryCutoverAuthorization({
      namespaceKey: 'c'.repeat(64), cutoverSessionId: 'Case-ID', targetGenerationId: 'target:a', purpose: 'test',
    });
    const identity = createLegacyNotesCutoverFenceIdentity(authorization);
    const key = deriveLegacyNotesCutoverFenceKey(identity);
    expect(deriveLegacyNotesCutoverFenceKey({ ...identity })).toBe(key);
    expect(deriveLegacyNotesCutoverFenceKey({ ...identity, cutoverSessionId: 'case-ID' })).not.toBe(key);
    expect(deriveLegacyNotesCutoverFenceKey({ ...identity, fenceEpoch: identity.fenceEpoch + 1 })).not.toBe(key);
    expect(deriveLegacyNotesCutoverFenceKey({ ...identity, fenceNonce: 'f'.repeat(32) })).not.toBe(key);
    expect(key).toMatch(/^absinthe:k326:legacy-fence:v3:[a-f0-9]{64}$/);
    expect(key).not.toContain(identity.cutoverSessionId);
    expect(() => deriveLegacyNotesCutoverFenceKey({ ...identity, cutoverSessionId: 'é' })).toThrow();
  });

  it('preserves foreign B when B appears after A read but before exact-key removal', () => {
    const authorization = createRecoveryCutoverAuthorization({
      namespaceKey: 'd'.repeat(64), cutoverSessionId: 'cutover-a', targetGenerationId: 'generation-a', purpose: 'test',
    });
    const a = createLegacyNotesCutoverFenceIdentity(authorization);
    beginLegacyNotesCutoverFence(authorization, a);
    const b = physicalFence({ ...a, namespaceKey: 'e'.repeat(64), fenceNonce: 'e'.repeat(32), fenceEpoch: a.fenceEpoch + 1 });
    const aKey = deriveLegacyNotesCutoverFenceKey(a);
    const remove = localStorage.removeItem.bind(localStorage);
    vi.spyOn(localStorage, 'removeItem').mockImplementation(key => {
      if (key === aKey) localStorage.setItem(b.key, JSON.stringify(b.value));
      remove(key);
    });
    expect(cancelLegacyNotesCutoverFence(authorization, a)).toMatchObject({
      ownFenceReleased: true, vaultState: 'blocked_by_other', scanStatus: 'valid',
    });
    expect(localStorage.getItem(aKey)).toBeNull();
    expect(localStorage.getItem(b.key)).toBe(JSON.stringify(b.value));
    expect(mayWriteLegacyNotes()).toBe(false);
  });

  it('cannot overwrite B when B appears between A scan and exact-key write', () => {
    const authorization = createRecoveryCutoverAuthorization({
      namespaceKey: 'f'.repeat(64), cutoverSessionId: 'cutover-a', targetGenerationId: 'generation-a', purpose: 'test',
    });
    const a = createLegacyNotesCutoverFenceIdentity(authorization);
    const b = physicalFence({ ...a, namespaceKey: '1'.repeat(64), fenceNonce: '1'.repeat(32), fenceEpoch: a.fenceEpoch + 1 });
    const aKey = deriveLegacyNotesCutoverFenceKey(a);
    const set = localStorage.setItem.bind(localStorage);
    vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
      if (key === aKey && localStorage.getItem(b.key) === null) set(b.key, JSON.stringify(b.value));
      set(key, value);
    });
    expect(() => beginLegacyNotesCutoverFence(authorization, a)).toThrow(LegacyCutoverFenceError);
    expect(localStorage.getItem(aKey)).not.toBeNull();
    expect(localStorage.getItem(b.key)).toBe(JSON.stringify(b.value));
    expect(scanLegacyNotesCutoverFences()).toMatchObject({ status: 'multiple' });
  });

  it('fails closed for multiple, malformed, unsupported, and changing fence sets', () => {
    const authorization = createRecoveryCutoverAuthorization({
      namespaceKey: '2'.repeat(64), cutoverSessionId: 'cutover-a', targetGenerationId: 'generation-a', purpose: 'test',
    });
    const a = createLegacyNotesCutoverFenceIdentity(authorization);
    const first = physicalFence(a);
    const second = physicalFence({ ...a, fenceNonce: '3'.repeat(32), fenceEpoch: a.fenceEpoch + 1 });
    localStorage.setItem(first.key, JSON.stringify(first.value));
    localStorage.setItem(second.key, JSON.stringify(second.value));
    expect(scanLegacyNotesCutoverFences()).toMatchObject({ status: 'multiple' });
    expect(mayWriteLegacyNotes()).toBe(false);
    localStorage.clear();
    localStorage.setItem(`${K326_LEGACY_WRITE_FENCE_PREFIX}bad`, '{}');
    expect(scanLegacyNotesCutoverFences()).toMatchObject({ status: 'malformed' });
    localStorage.clear();
    localStorage.setItem(first.key, JSON.stringify(first.value));
    localStorage.setItem(K326_LEGACY_WRITE_FENCE_KEY, '{"version":2}');
    expect(scanLegacyNotesCutoverFences()).toMatchObject({ status: 'unsupported' });
    expect(localStorage.getItem(first.key)).toBe(JSON.stringify(first.value));
    expect(mayWriteLegacyNotes()).toBe(false);
    localStorage.clear();
    localStorage.setItem(first.key, JSON.stringify(first.value));
    const get = localStorage.getItem.bind(localStorage); let reads = 0;
    vi.spyOn(localStorage, 'getItem').mockImplementation(key => {
      const value = get(key); reads += 1;
      if (reads === 1) localStorage.setItem(second.key, JSON.stringify(second.value));
      return value;
    });
    expect(scanLegacyNotesCutoverFences()).toMatchObject({ status: 'changed' });
    expect(mayWriteLegacyNotes()).toBe(false);
  });

  it('fails closed when storage enumeration is unreadable', () => {
    localStorage.setItem('unrelated', 'value');
    vi.spyOn(localStorage, 'key').mockImplementation(() => { throw new Error('synthetic enumeration failure'); });
    expect(scanLegacyNotesCutoverFences()).toMatchObject({ status: 'unreadable' });
    expect(mayWriteLegacyNotes()).toBe(false);
    vi.stubGlobal('localStorage', undefined);
    expect(scanLegacyNotesCutoverFences()).toMatchObject({ status: 'unreadable' });
    expect(mayWriteLegacyNotes()).toBe(false);
  });
});
