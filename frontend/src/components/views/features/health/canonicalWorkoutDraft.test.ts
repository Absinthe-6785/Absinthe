import 'fake-indexeddb/auto';
import { IDBDatabase, IDBFactory, IDBIndex, IDBObjectStore } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { localHealthDraftKey, readLocalHealthWorkoutDraft } from '../../../../lib/healthBackfillUiSafety';
import {
  closeLocalDatabase, createDormantLocalDatabaseCapability, LOCAL_DATABASE_NAME, LOCAL_DATABASE_STORES,
  openLocalDatabase, type LocalDatabaseRepository,
} from '../../../../lib/localDatabase';
import { createWorkoutRemoteControlClient } from '../../../../lib/workoutRemoteClient';
import { runWorkoutPullIteration } from '../../../../lib/workoutRemotePull';
import { runWorkoutPushIteration } from '../../../../lib/workoutRemotePush';
import { WorkoutSessionRepository, WORKOUT_SESSION_DOMAIN } from '../../../../lib/workoutSessionRepository';
import { WorkoutSelectedDayReader } from '../../../../lib/workoutSelectedDayReader';
import { HEALTH_ROUTINE_DEVICE_ID_KEY, HEALTH_ROUTINE_GENERATION_ID, HEALTH_ROUTINE_PROJECT_REF } from '../../../../lib/workoutLocalReaderAuthority';
import { canonicalWorkoutDraftKey, createCanonicalWorkoutDraftStore } from './canonicalWorkoutDraft';
import { projectCompositeWorkoutRead } from './compositeWorkoutReadProjection';
import { isolatedWorkoutPilotBackend, PILOT_ORIGIN, PILOT_OWNER, PILOT_PGLITE_PACKAGE } from './workoutPilotTestFixture';
import {
  createWorkoutEditorBodyweightSet, createWorkoutEditorCardioSet, createWorkoutEditorEntry,
  createWorkoutEditorStrengthSet, createWorkoutSessionEditor, hydrateWorkoutSessionEditor,
  projectWorkoutSessionEditor,
} from './workoutSessionEditorAdapter';

const day = '2026-11-26';
const namespace = {
  userId: '11111111-1111-4111-8111-111111111111', projectRef: 'workout-tests',
  deviceId: 'device-a', generationId: 'gen-a', schemaVersion: 1,
};
const capability = createDormantLocalDatabaseCapability('test');
const opened: LocalDatabaseRepository[] = [];
const uuid = (n: number) => `11111111-1111-4111-8111-${String(n).padStart(12, '0')}`;

function editorFixture() {
  let n = 0;
  const id = () => uuid(++n);
  const editor = createWorkoutSessionEditor(day, id);
  const bodyweight = createWorkoutEditorEntry({ id: null, name: 'Pull-up', type: 'bodyweight', tags: [], cardioMode: null }, id);
  bodyweight.sets.push(
    createWorkoutEditorBodyweightSet({ repsInput: 8, assistedRepsInput: 2, dropset: false, done: true }, 1, id),
    createWorkoutEditorBodyweightSet({ repsInput: 6, assistedRepsInput: null, dropset: true, done: false }, 2, id),
  );
  const strength = createWorkoutEditorEntry({ id: null, name: 'Curl', type: 'strength', tags: [], cardioMode: null }, id);
  strength.sets.push(createWorkoutEditorStrengthSet({
    weightInput: '20', weightUnit: 'lbs', repsInput: 10, assistedRepsInput: null, dropset: false, done: true,
  }, 1, id));
  const cardio = createWorkoutEditorEntry({ id: null, name: 'Run', type: 'cardio', tags: [], cardioMode: 'both' }, id);
  cardio.sets.push(createWorkoutEditorCardioSet({ durationInput: '10:30', distanceKilometersInput: '2.5', done: true }, 1, id));
  editor.entries.push(bodyweight, strength, cardio);
  return editor;
}

async function fixture(local = namespace) {
  const factory = new IDBFactory();
  const database = await openLocalDatabase(local, { capability, indexedDBFactory: factory });
  opened.push(database);
  await database.initializeNamespace();
  const sessions = new WorkoutSessionRepository(database);
  const scope = { accountId: local.userId, namespaceKey: database.namespaceKey, generationId: local.generationId, localDate: day };
  const data = new Map<string, string>();
  const storage = {
    getItem: vi.fn((key: string) => data.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { data.set(key, value); }),
    removeItem: vi.fn((key: string) => { data.delete(key); }),
  };
  let tail: Promise<unknown> = Promise.resolve();
  const locks = {
    request: ((_name: string, operation: () => unknown) => {
      const run = tail.then(operation);
      tail = run.catch(() => undefined);
      return run;
    }) as LockManager['request'],
  };
  let lifetime = 1;
  function mount(overrides: Partial<Parameters<typeof createCanonicalWorkoutDraftStore>[0]> = {}) {
    const captured = lifetime;
    return createCanonicalWorkoutDraftStore({ storage, locks, scope, isCurrent: () => captured === lifetime, ...overrides });
  }
  return { database, factory, sessions, scope, data, storage, mount, replaceLifetime: () => { lifetime += 1; } };
}

const observe = { observeDelivery: true };
const instant = (second: number) => new Date(Date.UTC(2026, 10, 26, 0, 0, second)).toISOString();

async function submit(f: Awaited<ReturnType<typeof fixture>>) {
  const editor = editorFixture();
  const draft = f.mount();
  const saved = await draft.saveEditor(editor, null);
  let receives = 0;
  await draft.submitNewSession(saved.token, async () => {}, async record => {
    receives += 1;
    return f.sessions.createWorkoutSession(record, { now: instant(0) });
  });
  expect(receives).toBe(1);
  return { editor, record: projectWorkoutSessionEditor(editor) };
}

function identity(db: LocalDatabaseRepository) {
  return { currentAccountId: () => db.namespace.userId, currentDeviceId: () => db.namespace.deviceId };
}

async function testAuthority(db: LocalDatabaseRepository, epoch: number) {
  const { currentAccountId, currentDeviceId } = identity(db);
  const discoverySequence = await db.reserveWorkoutRemoteDiscovery();
  const verificationId = uuid(100 + epoch);
  await db.persistWorkoutRemoteAuthority({
    accountId: currentAccountId(), deviceId: currentDeviceId(), namespaceKey: db.namespaceKey,
    generationId: db.namespace.generationId, domain: WORKOUT_SESSION_DOMAIN, protocolVersion: 2,
    capability: 'FOUNDATION_READY', authorityState: 'OPEN', bindingState: 'bound',
    projectScope: 'workout-draft-synthetic', authorityEpoch: epoch, generationBindingId: uuid(50 + epoch),
    serverEpoch: uuid(80 + epoch), verifiedAt: instant(0), verificationId, discoverySequence,
  }, currentAccountId, currentDeviceId);
  return verificationId;
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const database of opened.splice(0)) closeLocalDatabase(database);
});

describe('versioned canonical workout drafts (not product enabled)', () => {
  it('preserves IDs from empty draft through multiple exercises, reorder and re-entry without touching legacy', async () => {
    const f = await fixture();
    const legacyKey = localHealthDraftKey(f.scope.accountId, day);
    const legacy = [{ id: 'legacy-workout', block_id: 'block', sets: [] }];
    f.data.set(legacyKey, JSON.stringify(legacy));
    const editor = editorFixture();
    const empty = { ...editor, entries: [] };
    const first = await f.mount().saveEditor(empty, null);
    expect(await f.mount().resume()).toMatchObject({ kind: 'editing', editor: empty });
    await expect(f.mount().stageSubmission(first.token)).rejects.toThrow();
    const incomplete = { ...editor, entries: [{ ...editor.entries[0], sets: [] }] };
    const second = await f.mount().saveEditor(incomplete, first.token);
    expect(await f.mount().resume()).toMatchObject({ kind: 'editing', editor: incomplete });
    const complete = await f.mount().saveEditor(editor, second.token);
    editor.entries.reverse();
    editor.entries[2].sets.reverse();
    const reordered = await f.mount().saveEditor(editor, complete.token);
    const restored = await f.mount().resume();
    expect(restored).toEqual({ kind: 'editing', ...reordered });
    expect(reordered.editor.entries[2].sets.map(set => set.setId)).toEqual([uuid(4), uuid(3)]);
    expect(reordered.editor.entries[2].sets.map(set => set.ordinal)).toEqual([1, 2]);
    expect(readLocalHealthWorkoutDraft(f.storage, f.scope.accountId, day)).toEqual(legacy);
    expect(f.data.get(legacyKey)).toBe(JSON.stringify(legacy));
    expect(f.storage.removeItem).not.toHaveBeenCalled();
  });

  it('recovers an exact local receipt using one readonly transaction, without changing either store', async () => {
    const f = await fixture();
    const editor = editorFixture();
    const saved = await f.mount().saveEditor(editor, null);
    const submission = await f.mount().stageSubmission(saved.token);
    const committed = await f.sessions.createWorkoutSession(submission.record);
    expect(submission).toMatchObject({ status: 'uncertain', mutationId: committed.outbox.mutationId, payloadHash: committed.outbox.payloadHash });
    const raw = f.data.get(canonicalWorkoutDraftKey(f.scope));
    const transactions = vi.spyOn(IDBDatabase.prototype, 'transaction');
    const write = vi.spyOn(f.database, 'commitLocalMutation');
    expect(await f.mount().resume(f.database)).toMatchObject({ kind: 'committed_locally', localRevision: 1, editor,
      submission: { status: 'uncertain', mutationId: submission.mutationId, payloadHash: submission.payloadHash } });
    expect(transactions.mock.calls.map(call => call[1])).toEqual(['readonly']);
    expect(write).not.toHaveBeenCalled();
    expect(f.data.get(canonicalWorkoutDraftKey(f.scope))).toBe(raw);
    expect(await f.sessions.getWorkoutSession(editor.sessionId)).toEqual(committed.entity);
  });

  it('uses the exact base revision for edits and will not accept an older receipt for the same session', async () => {
    const f = await fixture();
    const created = await f.sessions.createWorkoutSession(projectWorkoutSessionEditor(editorFixture()));
    const editor = hydrateWorkoutSessionEditor(created.entity.record, created.entity.revision);
    editor.entries[0].sets[0].done = false;
    const saved = await f.mount().saveEditor(editor, null);
    await expect(f.mount().stageSubmission(saved.token)).rejects.toThrow('CANONICAL_DRAFT_EDIT_BASE_UNAVAILABLE');
    const staged = await f.mount().stageSubmission(saved.token, f.database);
    expect(await f.mount().resume(f.database)).toMatchObject({ kind: 'uncertain', editor: { expectedLocalRevision: 1 } });
    const updated = await f.sessions.updateWorkoutSession(editor.sessionId, 1, staged.record);
    expect(staged.mutationId).toBe(updated.outbox.mutationId);
    expect(await f.mount().resume(f.database)).toMatchObject({ kind: 'committed_locally', localRevision: 2, editor });
    await f.sessions.updateWorkoutSession(editor.sessionId, 2, staged.record);
    expect(await f.mount().resume(f.database)).toMatchObject({ kind: 'uncertain' });
  });

  it('stages and reads a mapped edit by its persisted local key, preserving the payload UUID spelling', async () => {
    const f = await fixture();
    const wireId = 'abcdefab-cdef-4abc-8def-abcdefabcdef';
    const localId = wireId.toUpperCase();
    const editor = { ...editorFixture(), sessionId: localId };
    const created = await f.sessions.createWorkoutSession(projectWorkoutSessionEditor(editor));
    // Seed only the existing local mapping format. No binding, adoption, or delivery occurs.
    const connection = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = f.factory.open(LOCAL_DATABASE_NAME);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const tx = connection.transaction(LOCAL_DATABASE_STORES.workoutRemoteIds, 'readwrite');
      tx.objectStore(LOCAL_DATABASE_STORES.workoutRemoteIds).add({
        accountId: f.scope.accountId, namespaceKey: f.scope.namespaceKey, generationId: f.scope.generationId,
        domain: created.entity.domain, localEntityId: localId, wireEntityId: wireId, mappedAt: created.entity.updatedAt,
      });
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onabort = () => reject(tx.error);
      });
    } finally {
      connection.close();
    }
    const edit = { ...hydrateWorkoutSessionEditor(created.entity.record, 1), sessionId: wireId };
    edit.entries[0].sets[0].done = false;
    const saved = await f.mount().saveEditor(edit, null);
    const staged = await f.mount().stageSubmission(saved.token, f.database);
    expect(staged).toMatchObject({ entityId: localId, record: { id: wireId } });
    const updated = await f.sessions.updateWorkoutSession(wireId, 1, staged.record);
    expect(updated.outbox.mutationId).toBe(staged.mutationId);
    expect(await f.mount().resume(f.database)).toMatchObject({
      kind: 'committed_locally', localRevision: 2, editor: edit, submission: { entityId: localId },
    });
  });

  it('never stages an edit once the lifetime changes during base resolution', async () => {
    const f = await fixture();
    const created = await f.sessions.createWorkoutSession(projectWorkoutSessionEditor(editorFixture()));
    const edit = hydrateWorkoutSessionEditor(created.entity.record, 1);
    const saved = await f.mount().saveEditor(edit, null);
    let release!: () => void;
    let announce!: () => void;
    const started = new Promise<void>(resolve => { announce = resolve; });
    vi.spyOn(f.database, 'readWorkoutDraftEvidence').mockImplementationOnce(
      () => new Promise(resolve => { release = () => resolve({ entity: created.entity, outbox: null }); announce(); }),
    );
    const pending = f.mount().stageSubmission(saved.token, f.database);
    await started;
    f.replaceLifetime();
    release();
    await expect(pending).rejects.toThrow('STALE_CANONICAL_DRAFT_SCOPE');
    expect(await f.mount().resume(f.database)).toEqual({ kind: 'editing', ...saved });
  });

  it('does not stage from a sealed generation even if account/date are still current', async () => {
    const f = await fixture();
    const created = await f.sessions.createWorkoutSession(projectWorkoutSessionEditor(editorFixture()));
    const edit = hydrateWorkoutSessionEditor(created.entity.record, 1);
    const saved = await f.mount().saveEditor(edit, null);
    const key = canonicalWorkoutDraftKey(f.scope);
    const original = f.data.get(key);
    await f.database.createGeneration('gen-b', 'test');
    await f.database.activateGeneration('gen-b');
    expect(await f.sessions.getWorkoutSession(edit.sessionId)).not.toBeNull();
    await expect(f.mount().stageSubmission(saved.token, f.database)).rejects.toMatchObject({ code: 'STALE_GENERATION' });
    expect(await f.mount().resume(f.database)).toEqual({ kind: 'editing', ...saved });
    expect(f.data.get(key)).toBe(original);
  });

  it('preserves unresolved evidence after confirmed abort and after unavailable read, without retry', async () => {
    const f = await fixture();
    const saved = await f.mount().saveEditor(editorFixture(), null);
    const staged = await f.mount().stageSubmission(saved.token);
    await expect(f.sessions.createWorkoutSession(staged.record, { testOnlyAbortAt: 'after_writes' }))
      .rejects.toMatchObject({ code: 'TRANSACTION_ABORTED' });
    const write = vi.spyOn(f.database, 'commitLocalMutation');
    const unknown = await f.mount().resume(f.database);
    expect(unknown.kind).toBe('uncertain');
    if (unknown.kind !== 'uncertain') throw new Error('expected unresolved draft');
    await expect(f.mount().stageSubmission(unknown.token)).rejects.toThrow('CANONICAL_DRAFT_SUBMISSION_UNCERTAIN');
    await expect(f.mount().saveEditor(unknown.editor, unknown.token)).rejects.toThrow('CANONICAL_DRAFT_SUBMISSION_UNCERTAIN');
    closeLocalDatabase(f.database);
    expect(await f.mount().resume(f.database)).toEqual(unknown);
    expect(write).not.toHaveBeenCalled();
  });

  it('does not accept a missing, mismatched or partial pair as a receipt', async () => {
    const f = await fixture();
    const saved = await f.mount().saveEditor(editorFixture(), null);
    const staged = await f.mount().stageSubmission(saved.token);
    const { entity, outbox } = await f.sessions.createWorkoutSession(staged.record);
    const read = vi.spyOn(f.database, 'readWorkoutDraftEvidence');
    for (const candidate of [
      { entity, outbox: null }, { entity: null, outbox },
      { entity, outbox: { ...outbox, accountId: 'account-b' } },
      { entity, outbox: { ...outbox, payloadHash: 'changed' } },
      { entity: { ...entity, entityId: uuid(99) }, outbox },
      { entity: { ...entity, record: { ...staged.record, localDate: '2026-11-27' } }, outbox },
    ]) {
      read.mockResolvedValueOnce(candidate);
      expect(await f.mount().resume(f.database)).toMatchObject({ kind: 'uncertain' });
    }
  });

  it.each(['account', 'date'])('discards a pending receipt across %s A→B→A without dropping draft bytes', async (scopeKind) => {
    const f = await fixture();
    const saved = await f.mount().saveEditor(editorFixture(), null);
    const staged = await f.mount().stageSubmission(saved.token);
    const { entity, outbox } = await f.sessions.createWorkoutSession(staged.record);
    let release!: () => void;
    const read = vi.spyOn(f.database, 'readWorkoutDraftEvidence').mockImplementationOnce(
      () => new Promise(resolve => { release = () => resolve({ entity, outbox }); }),
    );
    const pending = f.mount().resume(f.database, observe);
    const raw = f.data.get(canonicalWorkoutDraftKey(f.scope));
    f.replaceLifetime();
    const other = { ...f.scope, ...(scopeKind === 'account' ? { accountId: 'account-b' } : { localDate: '2026-11-27' }) };
    expect(await f.mount({ scope: other }).resume(f.database))
      .toEqual({ kind: 'missing' });
    f.replaceLifetime();
    release();
    expect(await pending).toEqual({ kind: 'unavailable' });
    expect(f.data.get(canonicalWorkoutDraftKey(f.scope))).toBe(raw);
    expect(read).toHaveBeenCalledTimes(1);
    expect(await f.mount().resume(f.database)).toMatchObject({ kind: 'committed_locally' });
  });

  it('does not inspect another account or generation, even with a staged draft', async () => {
    const f = await fixture();
    const saved = await f.mount().saveEditor(editorFixture(), null);
    await f.mount().stageSubmission(saved.token);
    const database = f.database;
    const wrongScope = (override: Partial<typeof namespace>) => {
      const read = vi.fn(database.readWorkoutDraftEvidence.bind(database));
      const wrong = { namespace: { ...database.namespace, ...override }, namespaceKey: database.namespaceKey,
        readWorkoutDraftEvidence: read } as unknown as LocalDatabaseRepository;
      return { wrong, read };
    };
    for (const { wrong, read } of [wrongScope({ userId: 'account-b' }), wrongScope({ generationId: 'gen-b' })]) {
      expect(await f.mount().resume(wrong)).toMatchObject({ kind: 'uncertain' });
      expect(read).not.toHaveBeenCalled();
    }
  });

  it('stages once across cooperating tabs and rejects queued work after replacement', async () => {
    const f = await fixture();
    const editor = editorFixture();
    const saved = await f.mount().saveEditor(editor, null);
    const tabA = f.mount();
    const tabB = f.mount();
    const submissions = await Promise.allSettled([tabA.stageSubmission(saved.token), tabB.stageSubmission(saved.token)]);
    expect(submissions.map(result => result.status)).toEqual(['fulfilled', 'rejected']);
    const pending = tabA.saveEditor(editor, saved.token);
    f.replaceLifetime();
    await expect(pending).rejects.toThrow('STALE_CANONICAL_DRAFT_SCOPE');
  });

  it('does not restore an older tab token when another tab edits and reverts the same content', async () => {
    const f = await fixture();
    const original = editorFixture();
    const tabA = f.mount();
    const tabB = f.mount();
    const first = await tabA.saveEditor(original, null);
    const changed = editorFixture();
    changed.entries[0].sets[0].done = false;
    const second = await tabB.saveEditor(changed, first.token);
    const reverted = await tabB.saveEditor(original, second.token);
    expect(reverted.editor).toEqual(first.editor);
    expect(reverted.token).not.toBe(first.token);
    await expect(tabA.stageSubmission(first.token)).rejects.toThrow('STALE_CANONICAL_DRAFT');
    expect(await tabB.resume()).toEqual({ kind: 'editing', ...reverted });
  });

  it('fails closed for unavailable storage/locks, malformed records, and incompatible versions', async () => {
    const f = await fixture();
    const editor = editorFixture();
    await expect(f.mount({ locks: undefined }).saveEditor(editor, null)).rejects.toThrow('CANONICAL_DRAFT_LOCK_UNAVAILABLE');
    const saved = await f.mount().saveEditor(editor, null);
    const key = canonicalWorkoutDraftKey(f.scope);
    const original = f.data.get(key);
    f.storage.setItem.mockImplementationOnce(() => { throw new Error('quota'); });
    await expect(f.mount().stageSubmission(saved.token)).rejects.toThrow('quota');
    expect(f.data.get(key)).toBe(original);
    for (const raw of ['{broken', JSON.stringify({ ...JSON.parse(original!), version: 2 }),
      JSON.stringify({ ...JSON.parse(original!), submission: { status: 'uncertain' } })]) {
      f.data.set(key, raw);
      expect(await f.mount().resume(f.database)).toEqual({ kind: 'unavailable' });
      await expect(f.mount().saveEditor(editor, null)).rejects.toThrow();
      expect(f.data.get(key)).toBe(raw);
    }
  });
});

describe('receipt-aware workout draft re-entry (synthetic delivery owner only)', () => {
  it.each(['acknowledged', 'conflicted'])('keeps exact local evidence through %s settlement', async outcome => {
    const f = await fixture();
    const { editor, record } = await submit(f);
    const resume = () => f.mount().resume(f.database, observe);
    const before = await resume();
    expect(before).toMatchObject({ kind: 'committed_locally', delivery: { kind: 'not_synchronized' } });
    if (before.kind !== 'committed_locally') throw new Error('missing local submission');
    const { mutationId } = before.submission;
    const raw = f.data.get(canonicalWorkoutDraftKey(f.scope));
    const expectedVerificationId = await testAuthority(f.database, 1);
    const current = identity(f.database);
    await f.database.bindWorkoutMutation({ mutationId, expectedVerificationId, ...current, currentAuthenticatedAccount: current.currentAccountId });
    expect(await resume()).toMatchObject({ kind: 'committed_locally', delivery: { kind: 'pending' } });
    expect(await f.mount().resume(f.database)).toMatchObject({ kind: 'uncertain' }); // #959 local-only caller
    const workerId = 'draft-synthetic';
    const [claimed] = await f.database.claimNextBoundWorkoutMutations({
      workerId, now: instant(1), leaseDurationMs: 30_000, limit: 1, ...current,
    });
    expect(await resume()).toMatchObject({ delivery: { kind: 'pending' } });
    const receipt = { remoteMutationRef: uuid(72), serverCommittedAt: instant(1) };
    await expect(f.database.acknowledgeMutationAndEntity({
      mutationId, workerId, now: instant(2), acknowledgedRevision: 1, ...receipt,
    })).rejects.toMatchObject({ code: 'INVALID_OUTBOX_TRANSITION' });
    const conflict = outcome === 'conflicted';
    await f.database.settleBoundWorkoutMutation({
      claimed, workerId, now: instant(2), ...current,
      settlement: conflict
        ? { kind: 'conflict', errorCode: 'ENTITY_ALREADY_EXISTS', remoteEvidence: { currentServerRevision: 1 } }
        : { kind: 'success', serverRevision: 1, ...receipt },
    });
    expect(await resume()).toMatchObject({ kind: 'committed_locally', localRevision: 1, editor,
      delivery: conflict ? { kind: 'conflict' } : { kind: 'acknowledged', serverRevision: 1 } });
    const durable = await f.sessions.getWorkoutSession(record.id);
    expect(durable).toMatchObject({ record, pendingMutationId: conflict ? mutationId : null });
    expect(await f.database.listConflicts(WORKOUT_SESSION_DOMAIN, record.id)).toHaveLength(conflict ? 1 : 0);

    if (!conflict) {
      const lookup = { kind: 'submission' as const, mutationId, ...observe };
      const evidence = await f.database.readWorkoutDraftEvidence(record.id, lookup);
      const outbox = evidence.outbox!;
      const read = vi.spyOn(f.database, 'readWorkoutDraftEvidence');
      for (const candidate of [
        { ...outbox, remoteMutationRef: 'invalid' }, { ...outbox, serverCommittedAt: null },
        { ...outbox, acknowledgedRevision: 9 },
      ]) {
        read.mockResolvedValueOnce({ ...evidence, outbox: candidate });
        expect(await resume()).toMatchObject({ kind: 'committed_locally', delivery: { kind: 'uncertain' } });
      }
      read.mockResolvedValueOnce({ ...evidence, outbox: { ...outbox, idempotencyKey: 'different' } });
      expect(await resume()).toMatchObject({ kind: 'uncertain' });
      await f.database.reserveWorkoutRemoteDiscovery();
      expect(await resume()).toMatchObject({ kind: 'committed_locally', delivery: { kind: 'uncertain' } });
      await testAuthority(f.database, 2);
      expect(await resume()).toMatchObject({ kind: 'committed_locally', delivery: { kind: 'uncertain' } });
      await f.database.createGeneration('gen-b', 'test');
      await f.database.activateGeneration('gen-b');
      expect(await resume()).toMatchObject({ kind: 'uncertain' });
    }
    expect(f.data.get(canonicalWorkoutDraftKey(f.scope))).toBe(raw);
    await expect(f.mount().submitNewSession(before.token, async () => {}, vi.fn()))
      .rejects.toThrow('CANONICAL_DRAFT_SUBMISSION_UNCERTAIN');
  });

  it('does not let the generic outbox supersede M1 or reorder the Workout lineage', async () => {
    const f = await fixture();
    const { record } = await submit(f);
    const m1 = (await f.sessions.getWorkoutSession(record.id))!.pendingMutationId!;
    const expectedVerificationId = await testAuthority(f.database, 1);
    const current = identity(f.database);
    const bound = await f.database.bindWorkoutMutation({ mutationId: m1, expectedVerificationId,
      ...current, currentAuthenticatedAccount: current.currentAccountId });
    const later = structuredClone(record);
    later.entries[0].exercise.name = 'Successor';
    const m2 = await f.sessions.updateWorkoutSession(record.id, 1, later, { now: instant(1) });
    await expect(f.database.supersedePendingMutation(m1, m2.outbox.mutationId, instant(2)))
      .rejects.toMatchObject({ code: 'INVALID_OUTBOX_TRANSITION' });
    expect(await f.database.getOutboxRecord(m1)).toEqual(bound);
    expect(await f.database.getOutboxRecord(m2.outbox.mutationId)).toEqual(m2.outbox);
  });

  it('keeps a historical create uncertain when a retained adoption manifest leaves its origin ambiguous', async () => {
    const f = await fixture();
    const editor = editorFixture();
    const saved = await f.mount().saveEditor(editor, null);
    const record = projectWorkoutSessionEditor(editor);
    // Existing fixtures model pre-correction adoption records whose first outbox
    // matches a normal create byte-for-byte. Seed that shape in synthetic IDB only.
    const simulated = await f.sessions.createWorkoutSession(record, { now: instant(0) });
    const raw = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = f.factory.open(LOCAL_DATABASE_NAME);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const manifestId = 'synthetic-adoption-manifest';
    try {
      const tx = raw.transaction([LOCAL_DATABASE_STORES.workoutAdoptionSessions, LOCAL_DATABASE_STORES.entities], 'readwrite');
      tx.objectStore(LOCAL_DATABASE_STORES.workoutAdoptionSessions).add({
        namespaceKey: f.scope.namespaceKey, generationId: f.scope.generationId, manifestId,
      }); // A possible manifest is enough to withhold historical origin; no adoption runs.
      tx.objectStore(LOCAL_DATABASE_STORES.entities).put({
        ...simulated.entity, source: { kind: 'legacy_migration', reference: manifestId },
      });
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error);
      });
    } finally { raw.close(); }
    await expect(f.mount().submitNewSession(saved.token, async () => {}, candidate =>
      f.sessions.createWorkoutSession(candidate, { now: instant(1) })))
      .rejects.toMatchObject({ code: 'ENTITY_ALREADY_EXISTS' });
    const before = await f.mount().resume(f.database, observe);
    expect(before).toMatchObject({ kind: 'uncertain', submission: { mutationId: simulated.outbox.mutationId } });
    const later = structuredClone(record);
    later.entries[0].exercise.name = 'Later edit over imported session';
    await f.sessions.updateWorkoutSession(record.id, 1, later, { now: instant(2) });
    expect(await f.mount().resume(f.database, observe)).toEqual(before);
    expect((await f.sessions.getWorkoutSession(record.id))?.record).toEqual(later);
  });

  it.skipIf(!PILOT_PGLITE_PACKAGE)('reconciles the same multi-exercise draft after SQL lost-reply replay and exact pull', async ({ onTestFinished }) => {
    const server = await isolatedWorkoutPilotBackend(PILOT_PGLITE_PACKAGE!);
    onTestFinished(() => server.db.close());
    // These are the existing #958 synthetic transport namespaces, never the #959 QA namespace.
    const local = { userId: PILOT_OWNER, projectRef: HEALTH_ROUTINE_PROJECT_REF,
      generationId: HEALTH_ROUTINE_GENERATION_ID, schemaVersion: 1 };
    const a = await fixture({ ...local, deviceId: uuid(110) });
    const b = await fixture({ ...local, deviceId: uuid(111) });
    const remote = (f: typeof a) => ({
      ...identity(f.database), baseUrl: PILOT_ORIGIN, fetchImpl: server.fetch,
      getSession: async () => ({ accountId: PILOT_OWNER, accessToken: 'synthetic-a' }),
    });
    const proof = await createWorkoutRemoteControlClient(remote(a)).discoverAndPersist(a.database);
    await createWorkoutRemoteControlClient(remote(b)).discoverAndPersist(b.database);
    expect(server.calls).toHaveLength(6);
    const { record, editor } = await submit(a);
    const before = await a.mount().resume(a.database, observe);
    if (before.kind !== 'committed_locally') throw new Error('missing local submission');
    const { mutationId } = before.submission;
    expect(before.delivery).toEqual({ kind: 'not_synchronized' });
    expect((await a.sessions.getWorkoutSession(record.id))?.record).toEqual(record);
    expect(server.calls).toHaveLength(6);
    const raw = a.data.get(canonicalWorkoutDraftKey(a.scope));
    await a.database.bindWorkoutMutation({ mutationId, expectedVerificationId: proof.verificationId,
      ...identity(a.database), currentAuthenticatedAccount: () => PILOT_OWNER });
    server.loseNextMutationResponse();
    let now = instant(1);
    const push = { ...remote(a), limit: 1, now: () => now, retryBaseDelayMs: 1, retryMaxDelayMs: 10 };
    expect(await runWorkoutPushIteration(a.database, push)).toMatchObject({ retryable: 1, success: 0 });
    expect(await a.mount().resume(a.database, observe)).toMatchObject({ delivery: { kind: 'pending' } });
    expect((await a.database.getOutboxRecord(mutationId))?.status).toBe('retry_wait');

    // M2 is intentionally unbound and differs from the historical M1 payload.
    const later = structuredClone(record);
    later.entries[0].exercise.name = 'Newer draft';
    const m2 = await a.sessions.updateWorkoutSession(record.id, 1, later, { now: instant(2) });
    now = instant(3);
    expect(await runWorkoutPushIteration(a.database, push)).toMatchObject({ exactReplay: 1, claimed: 1 });
    const [first, replay] = server.calls.slice(6);
    expect(first.result).toMatchObject({ outcome: 'success', mutationId, entityId: record.id, serverRevision: 1 });
    expect(replay.wire).toBe(first.wire);
    expect(replay.result).toEqual({ ...first.result, outcome: 'exact_replay' });

    const tx = vi.spyOn(IDBDatabase.prototype, 'transaction');
    const gets = vi.spyOn(IDBObjectStore.prototype, 'get');
    const indexKey = vi.spyOn(IDBIndex.prototype, 'getKey');
    const scan = vi.spyOn(IDBObjectStore.prototype, 'getAll');
    const indexScan = vi.spyOn(IDBIndex.prototype, 'getAll');
    const resumed = await a.mount().resume(a.database, observe);
    const operations = { transactions: tx.mock.calls.length, gets: gets.mock.calls.length + indexKey.mock.calls.length,
      scans: scan.mock.calls.length + indexScan.mock.calls.length, remoteRequests: server.calls.length - 8 };
    tx.mockRestore(); gets.mockRestore(); indexKey.mockRestore(); scan.mockRestore(); indexScan.mockRestore();
    expect(operations).toEqual({ transactions: 1, gets: 8, scans: 0, remoteRequests: 0 });
    expect(resumed).toMatchObject({ kind: 'committed_locally', editor, localRevision: 1,
      delivery: { kind: 'acknowledged', serverRevision: 1 } });
    expect((await a.sessions.getWorkoutSession(record.id))?.record).toEqual(later);
    expect(await a.database.getOutboxRecord(m2.outbox.mutationId)).toEqual(m2.outbox);
    expect(a.data.get(canonicalWorkoutDraftKey(a.scope))).toBe(raw);
    expect(await runWorkoutPushIteration(a.database, push)).toMatchObject({ claimed: 0 });

    expect(await runWorkoutPullIteration(b.database, remote(b))).toMatchObject({ kind: 'applied', applied: 1, conflicts: 0 });
    vi.stubGlobal('indexedDB', b.factory);
    try {
      const reader = await WorkoutSelectedDayReader.open(PILOT_OWNER, {
        getItem: (key: string) => key === HEALTH_ROUTINE_DEVICE_ID_KEY ? b.database.namespace.deviceId : null,
      } as Storage);
      try {
        const projected = projectCompositeWorkoutRead({
          context: reader.scope,
          canonical: { status: 'success', records: await reader.read(day) },
          legacy: { status: 'success', records: [] },
        });
        expect(projected.status).toBe('complete');
        expect(projected.records).toHaveLength(1);
        expect(projected.records[0]).toMatchObject({ source: 'canonical', capability: 'read_only_in_G5B2',
          canonical: { entityId: record.id, session: record } });
      } finally { reader.close(); }
    } finally { vi.unstubAllGlobals(); }
    expect(server.calls).toHaveLength(9); // six setup, two exact sends, one pull
    expect(await b.database.listOutboxMutations({ limit: 10 })).toEqual([]);
  }, 20_000);
});
