import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  K326_LEGACY_WRITE_FENCE_KEY,
  K326_LEGACY_WRITE_FENCE_PREFIX,
  K326_LEGACY_WRITE_FENCE_SETTLEMENT_PREFIX,
  RECOVERY_MODE_MESSAGE,
  LegacyCutoverFenceError,
  RecoveryModeBlockedError,
  activateRecoveryMode,
  assertCurrentOperationEpoch,
  beginLegacyNotesCutoverFence,
  captureOperationEpoch,
  clearLegacyNotesCutoverFenceForTest,
  createLegacyNotesCutoverFenceIdentity,
  createRecoveryCutoverAuthorization,
  deriveLegacyNotesCutoverFenceKey,
  deriveLegacyNotesCutoverFenceSettlementKey,
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
  settleLegacyNotesCutoverFence,
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
      kind: 'legacy_notes_cutover_fence_v4', version: 4,
      storageDigest: key.slice(K326_LEGACY_WRITE_FENCE_PREFIX.length),
      ...identity,
    },
  } as const;
}

function physicalSettlement(identity: ReturnType<typeof createLegacyNotesCutoverFenceIdentity>) {
  const key = deriveLegacyNotesCutoverFenceSettlementKey(identity);
  const fenceKey = deriveLegacyNotesCutoverFenceKey(identity);
  return {
    key,
    value: {
      kind: 'legacy_notes_cutover_fence_settlement_v4', version: 4,
      storageDigest: key.slice(K326_LEGACY_WRITE_FENCE_SETTLEMENT_PREFIX.length),
      fenceStorageDigest: fenceKey.slice(K326_LEGACY_WRITE_FENCE_PREFIX.length),
      ...identity, outcome: 'precommit_settled',
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
    expect(beginLegacyNotesCutoverFence(authorization, first)).toMatchObject({ ...first, version: 4 });
    expect(beginLegacyNotesCutoverFence(authorization, first)).toMatchObject({ ...first, version: 4 });
    expect(readLegacyNotesCutoverFence()).toMatchObject(first);
    expect(() => beginLegacyNotesCutoverFence(authorization, second)).toThrow(LegacyCutoverFenceError);
    expect(readLegacyNotesCutoverFence()).toMatchObject(first);
    const fenceKey = deriveLegacyNotesCutoverFenceKey(first);
    settleLegacyNotesCutoverFence(authorization, first);
    expect(readLegacyNotesCutoverFence()).toBeNull();
    expect(localStorage.getItem(fenceKey)).not.toBeNull();
    expect(localStorage.getItem(deriveLegacyNotesCutoverFenceSettlementKey(first))).not.toBeNull();
  });

  it('rejects changed epochs, unknown fields, malformed nonces, and inherited identity properties', () => {
    const authorization = createRecoveryCutoverAuthorization({
      namespaceKey: 'b'.repeat(64), cutoverSessionId: 'cutover-2', targetGenerationId: 'generation-2', purpose: 'test',
    });
    const identity = createLegacyNotesCutoverFenceIdentity(authorization);
    beginLegacyNotesCutoverFence(authorization, identity);
    expect(() => settleLegacyNotesCutoverFence(authorization, { ...identity, fenceEpoch: identity.fenceEpoch + 1 }))
      .toThrow(LegacyCutoverFenceError);
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
    expect(key).toMatch(/^absinthe:k326:legacy-fence:v4:[a-f0-9]{64}$/);
    expect(key).not.toContain(identity.cutoverSessionId);
    expect(() => deriveLegacyNotesCutoverFenceKey({ ...identity, cutoverSessionId: 'é' })).toThrow();
  });

  it('never deletes or settles a same-key fence value mutated to malformed evidence', () => {
    const authorization = createRecoveryCutoverAuthorization({
      namespaceKey: 'd'.repeat(64), cutoverSessionId: 'cutover-a', targetGenerationId: 'generation-a', purpose: 'test',
    });
    const a = createLegacyNotesCutoverFenceIdentity(authorization);
    beginLegacyNotesCutoverFence(authorization, a);
    const aKey = deriveLegacyNotesCutoverFenceKey(a);
    localStorage.setItem(aKey, '{malformed');
    const remove = vi.spyOn(localStorage, 'removeItem');
    expect(() => settleLegacyNotesCutoverFence(authorization, a)).toThrow(LegacyCutoverFenceError);
    expect(localStorage.getItem(aKey)).toBe('{malformed');
    expect(localStorage.getItem(deriveLegacyNotesCutoverFenceSettlementKey(a))).toBeNull();
    expect(remove).not.toHaveBeenCalled();
    expect(scanLegacyNotesCutoverFences()).toMatchObject({ status: 'malformed' });
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
    expect(scanLegacyNotesCutoverFences()).toMatchObject({ status: 'multiple_active' });
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
    expect(scanLegacyNotesCutoverFences()).toMatchObject({ status: 'multiple_active' });
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

  it('classifies append-only historical and multiple fence settlement pairs independently', () => {
    const authorization = createRecoveryCutoverAuthorization({
      namespaceKey: '6'.repeat(64), cutoverSessionId: 'cutover-a', targetGenerationId: 'generation-a', purpose: 'test',
    });
    const a = createLegacyNotesCutoverFenceIdentity(authorization);
    beginLegacyNotesCutoverFence(authorization, a);
    settleLegacyNotesCutoverFence(authorization, a);
    expect(scanLegacyNotesCutoverFences()).toMatchObject({ status: 'operationally_clear', settledFences: [expect.objectContaining(a)] });
    const b = { ...a, fenceNonce: '7'.repeat(32), fenceEpoch: a.fenceEpoch + 1 };
    beginLegacyNotesCutoverFence(authorization, b);
    expect(scanLegacyNotesCutoverFences()).toMatchObject({ status: 'active', activeFences: [expect.objectContaining(b)] });
    settleLegacyNotesCutoverFence(authorization, b);
    expect(scanLegacyNotesCutoverFences()).toMatchObject({ status: 'operationally_clear' });
    expect(localStorage.getItem(deriveLegacyNotesCutoverFenceKey(a))).not.toBeNull();
    expect(localStorage.getItem(deriveLegacyNotesCutoverFenceKey(b))).not.toBeNull();
  });

  it('fails closed for orphaned or mutated settlement evidence without repair', () => {
    const authorization = createRecoveryCutoverAuthorization({
      namespaceKey: '8'.repeat(64), cutoverSessionId: 'cutover-a', targetGenerationId: 'generation-a', purpose: 'test',
    });
    const identity = createLegacyNotesCutoverFenceIdentity(authorization);
    const settlement = physicalSettlement(identity);
    localStorage.setItem(settlement.key, JSON.stringify(settlement.value));
    expect(scanLegacyNotesCutoverFences()).toMatchObject({ status: 'orphaned' });
    expect(mayWriteLegacyNotes()).toBe(false);
    localStorage.setItem(deriveLegacyNotesCutoverFenceKey(identity), JSON.stringify(physicalFence(identity).value));
    localStorage.setItem(settlement.key, '{malformed');
    expect(scanLegacyNotesCutoverFences()).toMatchObject({ status: 'malformed' });
    expect(() => settleLegacyNotesCutoverFence(authorization, identity)).toThrow(LegacyCutoverFenceError);
    expect(localStorage.getItem(settlement.key)).toBe('{malformed');
  });

  it('rejects byte-changed fence and settlement values even when fields remain semantically equal', () => {
    const authorization = createRecoveryCutoverAuthorization({
      namespaceKey: 'c'.repeat(64), cutoverSessionId: 'cutover-canonical', targetGenerationId: 'generation-a', purpose: 'test',
    });
    const identity = createLegacyNotesCutoverFenceIdentity(authorization);
    const fence = physicalFence(identity);
    localStorage.setItem(fence.key, JSON.stringify({ ...identity, storageDigest: fence.value.storageDigest,
      version: 4, kind: 'legacy_notes_cutover_fence_v4' }));
    expect(scanLegacyNotesCutoverFences()).toMatchObject({ status: 'malformed' });
    localStorage.clear();
    localStorage.setItem(fence.key, JSON.stringify(fence.value));
    const settlement = physicalSettlement(identity);
    localStorage.setItem(settlement.key, JSON.stringify({ ...identity, outcome: 'precommit_settled',
      fenceStorageDigest: settlement.value.fenceStorageDigest, storageDigest: settlement.value.storageDigest,
      version: 4, kind: 'legacy_notes_cutover_fence_settlement_v4' }));
    expect(scanLegacyNotesCutoverFences()).toMatchObject({ status: 'malformed' });
  });

  it('never repairs a settlement mutated before read-back and keeps the vault blocked', () => {
    const authorization = createRecoveryCutoverAuthorization({
      namespaceKey: '9'.repeat(64), cutoverSessionId: 'cutover-a', targetGenerationId: 'generation-a', purpose: 'test',
    });
    const identity = createLegacyNotesCutoverFenceIdentity(authorization);
    beginLegacyNotesCutoverFence(authorization, identity);
    const settlementKey = deriveLegacyNotesCutoverFenceSettlementKey(identity);
    const set = localStorage.setItem.bind(localStorage);
    vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
      set(key, value);
      if (key === settlementKey) set(key, '{changed-after-write');
    });
    expect(() => settleLegacyNotesCutoverFence(authorization, identity)).toThrow(LegacyCutoverFenceError);
    expect(localStorage.getItem(settlementKey)).toBe('{changed-after-write');
    expect(scanLegacyNotesCutoverFences()).toMatchObject({ status: 'malformed' });
    expect(mayWriteLegacyNotes()).toBe(false);
  });

  it('makes one canonical settlement value idempotent without overwriting it', () => {
    const authorization = createRecoveryCutoverAuthorization({
      namespaceKey: 'a'.repeat(64), cutoverSessionId: 'cutover-idempotent', targetGenerationId: 'generation-a', purpose: 'test',
    });
    const identity = createLegacyNotesCutoverFenceIdentity(authorization);
    beginLegacyNotesCutoverFence(authorization, identity);
    settleLegacyNotesCutoverFence(authorization, identity);
    const settlementKey = deriveLegacyNotesCutoverFenceSettlementKey(identity);
    const raw = localStorage.getItem(settlementKey);
    const set = vi.spyOn(localStorage, 'setItem');
    expect(settleLegacyNotesCutoverFence(authorization, identity))
      .toMatchObject({ ownFenceSettled: true, vaultState: 'operationally_clear' });
    expect(set).not.toHaveBeenCalled();
    expect(localStorage.getItem(settlementKey)).toBe(raw);
  });

  it('rejects delete-based v3 evidence without deleting or converting it', () => {
    const key = `absinthe:k326:legacy-fence:v3:${'b'.repeat(64)}`;
    const raw = JSON.stringify({ kind: 'legacy_notes_cutover_fence_v3', version: 3 });
    localStorage.setItem(key, raw);
    expect(scanLegacyNotesCutoverFences()).toMatchObject({ status: 'unsupported' });
    expect(mayWriteLegacyNotes()).toBe(false);
    expect(localStorage.getItem(key)).toBe(raw);
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
