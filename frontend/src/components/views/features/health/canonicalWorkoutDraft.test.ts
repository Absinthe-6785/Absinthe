import 'fake-indexeddb/auto';
import { IDBDatabase, IDBFactory } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { localHealthDraftKey, readLocalHealthWorkoutDraft } from '../../../../lib/healthBackfillUiSafety';
import {
  closeLocalDatabase, createDormantLocalDatabaseCapability, LOCAL_DATABASE_NAME, LOCAL_DATABASE_STORES,
  openLocalDatabase, type LocalDatabaseRepository,
} from '../../../../lib/localDatabase';
import { WorkoutSessionRepository } from '../../../../lib/workoutSessionRepository';
import { canonicalWorkoutDraftKey, createCanonicalWorkoutDraftStore } from './canonicalWorkoutDraft';
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

async function fixture() {
  const factory = new IDBFactory();
  const database = await openLocalDatabase(namespace, { capability, indexedDBFactory: factory });
  opened.push(database);
  await database.initializeNamespace();
  const sessions = new WorkoutSessionRepository(database);
  const scope = { accountId: namespace.userId, namespaceKey: database.namespaceKey, generationId: namespace.generationId, localDate: day };
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
    const pending = f.mount().resume(f.database);
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
