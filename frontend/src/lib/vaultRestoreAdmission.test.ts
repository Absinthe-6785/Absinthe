import { describe, expect, it } from 'vitest';
import { fingerprintPortableVaultContent } from './vaultSnapshotFingerprint';
import {
  createVaultRestoreAdmissionOwner,
  type RestoreIntent,
  type RestoreOperationContext,
  type RestorePreviewHandle,
  type RestoreAdmission,
} from './vaultRestoreAdmission';
import {
  makeCurrentSnapshot,
  makeDirectManifest,
  MemorySnapshotSourceStorage,
  persistSnapshotFixture,
} from './__fixtures__/vaultRestoreAdmissionFixtures';
import { serializeVaultSnapshot } from './vaultSnapshotBuild';

const context: RestoreOperationContext = { accountId: 'account-a', generation: 7, operationEpoch: 12 };

function intent(overrides: Partial<RestoreIntent> = {}): RestoreIntent {
  return {
    noteIds: ['source-admission-note'],
    folderIds: [],
    strategy: 'replace',
    restoreCore: true,
    restoreExtensions: false,
    restoreCloud: false,
    backupBeforeRestore: true,
    ...overrides,
  };
}

function setup() {
  const storage = new MemorySnapshotSourceStorage();
  const snapshot = makeCurrentSnapshot();
  persistSnapshotFixture(storage, snapshot);
  return { storage, snapshot, owner: createVaultRestoreAdmissionOwner(storage) };
}

async function prepared(owner: ReturnType<typeof createVaultRestoreAdmissionOwner>, restoreIntent = intent()) {
  const result = await owner.openSnapshot('snapshot-admission-1', restoreIntent, context);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(`open failed: ${result.code}`);
  return result.value;
}

async function admitted(owner: ReturnType<typeof createVaultRestoreAdmissionOwner>, handle: RestorePreviewHandle) {
  const result = await owner.confirm(handle, context);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(`confirm failed: ${result.code}`);
  return result.value;
}

describe('vault restore operation-local admission owner', () => {
  it('A12 rejects forged, cloned, and serialized preview handles', async () => {
    const { owner } = setup();
    const opened = await prepared(owner);
    const forged = Object.freeze({}) as RestorePreviewHandle;
    const clone = structuredClone(opened.handle) as RestorePreviewHandle;
    expect((await owner.confirm(forged, context)).ok).toBe(false);
    expect((await owner.confirm(clone, context)).ok).toBe(false);
    const serialized = JSON.parse(JSON.stringify(opened.handle)) as RestorePreviewHandle;
    expect((await owner.confirm(serialized, context)).ok).toBe(false);
  });

  it('A13 rejects a handle and admission used with another owner', async () => {
    const { storage, owner } = setup();
    const otherOwner = createVaultRestoreAdmissionOwner(storage);
    const opened = await prepared(owner);
    expect(await otherOwner.confirm(opened.handle, context)).toEqual({ ok: false, code: 'INVALID_ADMISSION' });
    const token = await admitted(owner, opened.handle);
    expect(await otherOwner.consume(token, context)).toEqual({ ok: false, code: 'INVALID_ADMISSION' });
  });

  it('A14 consumes an admission only once and invalidates on failure', async () => {
    const { owner } = setup();
    const opened = await prepared(owner);
    const token = await admitted(owner, opened.handle);
    const first = owner.consume(token, context);
    expect(await owner.consume(token, context)).toEqual({ ok: false, code: 'INVALID_ADMISSION' });
    expect((await first).ok).toBe(true);
    expect(owner.fail(token)).toBe(true);
    expect(owner.complete(token)).toBe(false);
  });

  it('A15 synchronously blocks duplicate concurrent confirmation', async () => {
    const { owner } = setup();
    const opened = await prepared(owner);
    const first = owner.confirm(opened.handle, context);
    const second = await owner.confirm(opened.handle, context);
    expect(second).toEqual({ ok: false, code: 'INVALID_ADMISSION' });
    const firstResult = await first;
    expect(firstResult.ok).toBe(true);
  });

  it('A16 revising options or selection invalidates the old preview and increments revision', async () => {
    const { owner } = setup();
    const opened = await prepared(owner);
    const priorAdmission = await admitted(owner, opened.handle);
    const revised = owner.revise(opened.handle, intent({ noteIds: [], strategy: 'skip' }), context);
    expect(revised.ok).toBe(true);
    if (!revised.ok) return;
    expect(revised.value.previewRevision).toBe(opened.previewRevision + 1);
    expect(await owner.confirm(opened.handle, context)).toEqual({ ok: false, code: 'INVALID_ADMISSION' });
    const token = await admitted(owner, revised.value.handle);
    expect(await owner.consume(priorAdmission, context)).toEqual({ ok: false, code: 'INVALID_ADMISSION' });
    const consumed = await owner.consume(token, context);
    expect(consumed.ok).toBe(true);
    if (consumed.ok) {
      expect(consumed.value.intent.noteIds).toEqual([]);
      expect(consumed.value.intent.strategy).toBe('skip');
    }
  });

  it('A17 detects source changes between preview and confirmation', async () => {
    const { owner, storage, snapshot } = setup();
    const opened = await prepared(owner);
    snapshot.vault.notes[0]!.markdown += '\nchanged after preview';
    snapshot.contentFingerprint = fingerprintPortableVaultContent({
      notes: snapshot.vault.notes,
      folders: snapshot.vault.folders,
      extensions: snapshot.extensions,
    });
    persistSnapshotFixture(storage, snapshot);
    expect(await owner.confirm(opened.handle, context)).toEqual({ ok: false, code: 'SOURCE_CHANGED' });
  });

  it('A17 detects source changes after confirmation and before admission consumption', async () => {
    const { owner, storage, snapshot } = setup();
    const opened = await prepared(owner);
    const token = await admitted(owner, opened.handle);
    snapshot.vault.notes[0]!.markdown += '\nchanged after confirmation';
    snapshot.contentFingerprint = fingerprintPortableVaultContent({
      notes: snapshot.vault.notes,
      folders: snapshot.vault.folders,
      extensions: snapshot.extensions,
    });
    persistSnapshotFixture(storage, snapshot);
    expect(await owner.consume(token, context)).toEqual({ ok: false, code: 'SOURCE_CHANGED' });
  });

  it.each([
    ['account', { ...context, accountId: 'account-b' }],
    ['generation', { ...context, generation: context.generation + 1 }],
    ['epoch', { ...context, operationEpoch: context.operationEpoch + 1 }],
  ] as const)('A18 invalidates after %s changes', async (_label, changed) => {
    const { owner } = setup();
    const opened = await prepared(owner);
    expect(await owner.confirm(opened.handle, changed)).toEqual({ ok: false, code: 'INVALID_ADMISSION' });
  });

  it('A18 rechecks account and epoch context after an asynchronous source reread', async () => {
    const storage = new MemorySnapshotSourceStorage();
    const owner = createVaultRestoreAdmissionOwner(storage);
    const file = new Blob([JSON.stringify(makeDirectManifest(3))]);
    const originalArrayBuffer = file.arrayBuffer.bind(file);
    let reads = 0;
    let releaseReread!: (bytes: ArrayBuffer) => void;
    Object.defineProperty(file, 'arrayBuffer', {
      value: () => {
        reads += 1;
        if (reads === 1) return originalArrayBuffer();
        return new Promise<ArrayBuffer>(resolve => { releaseReread = resolve; });
      },
    });
    const liveContext = { ...context };
    const opened = await owner.openDirectJson(file, intent({ restoreExtensions: true }), liveContext);
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    const pending = owner.confirm(opened.value.handle, liveContext);
    releaseReread(await originalArrayBuffer());
    const confirmed = await pending;
    expect(confirmed.ok).toBe(true);
    if (!confirmed.ok) return;
    const consuming = owner.consume(confirmed.value, liveContext);
    liveContext.operationEpoch += 1;
    releaseReread(await originalArrayBuffer());
    expect(await consuming).toEqual({ ok: false, code: 'INVALID_ADMISSION' });
  });

  it('A19 changing the returned preview copy cannot change the canonical target', async () => {
    const { owner } = setup();
    const opened = await prepared(owner);
    opened.preview.manifest!.notes[0]!.title = 'tampered preview';
    opened.preview.noteOptions[0]!.title = 'tampered option';
    const token = await admitted(owner, opened.handle);
    const consumed = await owner.consume(token, context);
    expect(consumed.ok).toBe(true);
    if (consumed.ok) {
      expect(consumed.value.manifest.notes[0]?.title).toBe('Admission fixture');
      expect(consumed.value.manifest.notes[0]?.title).not.toBe('tampered preview');
    }
  });

  it('A20 cancel invalidates preview and completion is accepted only after one consumption', async () => {
    const { owner } = setup();
    const opened = await prepared(owner);
    expect(owner.cancel(opened.handle)).toBe(true);
    expect(await owner.confirm(opened.handle, context)).toEqual({ ok: false, code: 'INVALID_ADMISSION' });

    const another = await prepared(owner);
    const token = await admitted(owner, another.handle);
    expect(owner.complete(token)).toBe(false);
    expect((await owner.consume(token, context)).ok).toBe(true);
    expect(owner.complete(token)).toBe(true);
    expect(owner.fail(token)).toBe(false);
  });

  it('A21 does not launder a snapshot envelope through the direct JSON origin', async () => {
    const { owner, snapshot } = setup();
    const result = await owner.openDirectJson(
      new Blob([serializeVaultSnapshot(snapshot)]),
      intent(),
      context,
    );
    expect(result.ok).toBe(false);
  });

  it('A22 performs no writes or cleanup and returns no Notes-store writer capability', async () => {
    const { owner, storage, snapshot } = setup();
    const before = new Map(storage.values);
    const opened = await prepared(owner);
    const token = await admitted(owner, opened.handle);
    const consumed = await owner.consume(token, context);
    expect(consumed.ok).toBe(true);
    expect(owner.fail(token)).toBe(true);
    expect([...storage.values]).toEqual([...before]);
    expect(Object.keys(owner).sort()).toEqual([
      'cancel', 'complete', 'confirm', 'consume', 'fail', 'openDirectJson',
      'openDirectZip', 'openSnapshot', 'revise',
    ]);
    expect(snapshot.snapshotId).toBe('snapshot-admission-1');
  });

  it('binds direct origins independently and binds the explicit intent values', async () => {
    const { owner, storage } = setup();
    const json = new Blob([JSON.stringify(makeDirectManifest(3))]);
    const opened = await owner.openDirectJson(json, intent({ restoreExtensions: true }), context);
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    expect(opened.value.origin).toBe('direct-json');
    const token = await admitted(owner, opened.value.handle);
    const consumed = await owner.consume(token, context);
    expect(consumed.ok).toBe(true);
    if (consumed.ok) expect(consumed.value.intent.restoreExtensions).toBe(true);
    expect(storage.values.size).toBe(2);
  });

  it('does not accept arbitrary manifest plus origin as an owner input', () => {
    const owner = createVaultRestoreAdmissionOwner(new MemorySnapshotSourceStorage());
    expect(owner).not.toHaveProperty('admitManifest');
    expect(owner).not.toHaveProperty('issueLease');
  });

  it('snapshot admission remains local/core-only', async () => {
    const { owner } = setup();
    const bad = await owner.openSnapshot(
      'snapshot-admission-1',
      intent({ restoreExtensions: true }),
      context,
    );
    expect(bad).toEqual({ ok: false, code: 'INVALID_INTENT' });
  });

  it('does not treat a typed object cast as a WeakMap-registered admission', async () => {
    const { owner } = setup();
    const forged = Object.freeze(Object.create(null)) as RestoreAdmission;
    expect(await owner.consume(forged, context)).toEqual({ ok: false, code: 'INVALID_ADMISSION' });
  });
});
