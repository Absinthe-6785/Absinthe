// @vitest-environment happy-dom
import { webcrypto } from 'node:crypto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('./supabase', () => ({ authFetch: vi.fn(), authReadFetch: vi.fn() }));
vi.mock('./vaultSnapshotAuto', () => ({ scheduleAutoSnapshot: vi.fn() }));
import { authFetch } from './supabase';
import { useNotesStore, observePublishedNotesHydration } from '../store/useNotesStore';
import * as authority from './notesAccountAuthority';
import { resetNotesPersistenceForTests } from './notePersistence';
import { setRecoveryModeActiveForTest } from './recoverySafetyPolicy';
import { NOTES_RUNTIME_SYNC_MODE_KEY } from './notesSyncClient';
import { LocalAttachmentBlobAdapter } from './attachmentBlobIndexedDb';
import { LocalAttachmentMetadataRepository } from './attachmentMetadataIndexedDb';
import { listPublishedLocalDocumentOriginals, stageLocalDocumentOriginal } from './localDocumentAttachments';
import { createInactiveSingleOriginalBackupCoordinator } from './singleOriginalBackupCoordinator';
import { createGoogleDriveSessionRuntime } from './googleDriveSessionRuntime';
import { GoogleDriveBlobAdapter } from './googleDriveBlobAdapter';
import { isReturnToUseAttachmentIsolationEnabled } from './returnToUseAttachmentIsolation';

const isolation = 'VITE_ABSINTHE_RETURN_TO_USE_ATTACHMENT_ISOLATION';
const bytes = new Uint8Array([0, 255, 13, 10, 128]);
const note = { id: 'note', title: 'Same title', body: 'authored', updatedAt: 1, folderId: null, deletedAt: null };
const repo = new LocalAttachmentMetadataRepository(), blobs = new LocalAttachmentBlobAdapter();
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
}
async function seed(account: string) {
  await useNotesStore.getState().initNotesStorage(account);
  expect(await authority.saveAccountScopedNotes(account, [note])).toBe(true);
  await useNotesStore.getState().initNotesStorage(account);
  useNotesStore.getState().setActiveNoteId('note');
  await authority.runAccountScopedNotesMutation(account, async () => {});
}
async function publish(account = 'A', id = 'original', format: 'pdf' | 'docx' = 'pdf') {
  const currentNote = useNotesStore.getState().notes[0]!;
  const staged = await stageLocalDocumentOriginal({ accountId: account, noteId: 'note', currentBody: currentNote.body,
    file: new File([bytes], ` 원본.${format}`, { type: format === 'pdf' ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }),
    repository: repo, blobAdapter: blobs, idFactory: () => id });
  const observation = observePublishedNotesHydration();
  if (observation.status !== 'CURRENT') throw new Error('fixture authority');
  expect(await useNotesStore.getState().persistAttachmentReferences(observation.request, currentNote, [staged]))
    .toMatchObject({ status: 'REFERENCE_PERSISTED', write: 'COMMITTED', readback: 'MATCHED' });
  const listed = await listPublishedLocalDocumentOriginals({ accountId: account, noteId: 'note', repository: repo });
  if (listed.status !== 'VERIFIED') throw new Error('fixture listing');
  return listed.documents.find(item => item.attachmentId === id)!;
}
function harness() {
  let connected = true;
  const remote = { bytes, missingId: false, getStatus: 200, putStatus: 200, gate: null as null | (() => Promise<void>), loseResponse: false };
  const fetcher = vi.fn<typeof fetch>(async (url, init) => {
    if (init?.method === 'POST') return new Response(null, { status: 200, headers: { Location: 'https://test.invalid/upload' } });
    if (init?.method === 'PUT') {
      await remote.gate?.();
      if (remote.loseResponse) throw new Error('lost completion response');
      return new Response(JSON.stringify({ ...(remote.missingId ? {} : { id: 'drive-original' }), size: bytes.length }), { status: remote.putStatus });
    }
    if (String(url).endsWith('?alt=media')) return new Response(remote.bytes, { status: remote.getStatus });
    throw new Error('unexpected remote request');
  });
  const token = vi.fn(async () => { if (!connected) throw new Error('expired test token'); return 'test-only-token'; });
  const runtime = createGoogleDriveSessionRuntime(null, vi.fn()); runtime.replaceAccount('A');
  const upload = vi.spyOn(GoogleDriveBlobAdapter.prototype, 'uploadBlob'), download = vi.spyOn(GoogleDriveBlobAdapter.prototype, 'downloadBlob');
  let tick = 0;
  const coordinator = createInactiveSingleOriginalBackupCoordinator({ repository: repo, blobAdapter: blobs,
    testDriver: { accessTokenProvider: { getAccessToken: token }, fetcher, runtime, isCurrent: () => connected }, now: () => new Date(Date.UTC(2030, 0, 1, 0, 0, tick++)) });
  return { coordinator, runtime, remote, upload, download, fetcher, token,
    disconnect: () => { connected = false; } };
}
async function setup(format: 'pdf' | 'docx' = 'pdf') {
  const candidate = await publish('A', 'original', format), h = harness();
  const confirmation = h.coordinator.confirmSelection({ accountId: 'A', noteId: 'note', candidate, confirmed: true });
  if (!confirmation) throw new Error('fixture confirmation');
  return { ...h, candidate, confirmation };
}
beforeEach(async () => {
  useNotesStore.getState().detachNotesStorage(); resetNotesPersistenceForTests(); setRecoveryModeActiveForTest(false);
  localStorage.clear(); localStorage.setItem(NOTES_RUNTIME_SYNC_MODE_KEY, 'local');
  vi.stubGlobal('indexedDB', new IDBFactory()); vi.stubGlobal('crypto', webcrypto);
  vi.stubEnv(isolation, 'false'); // Test-only: never changes the product default.
  await seed('B'); await publish('B', 'b-original'); await seed('A'); vi.mocked(authFetch).mockClear();
});
afterEach(() => {
  vi.useRealTimers(); vi.restoreAllMocks(); useNotesStore.getState().detachNotesStorage(); resetNotesPersistenceForTests();
  vi.unstubAllEnvs(); vi.unstubAllGlobals();
});

it.each(['pdf', 'docx'] as const)('integrates real local readback, CAS, Drive adapter and SHA-256 receipt for one %s', async format => {
  const h = await setup(format), initial = await repo.getAttachment('original'), b = await repo.getAttachment('b-original');
  const originalNote = useNotesStore.getState().notes[0];
  const cas = vi.spyOn(repo, 'transitionBackupForAccountNote'), put = vi.spyOn(repo, 'putAttachment'), update = vi.spyOn(repo, 'updateAttachment');
  const localWrite = vi.spyOn(blobs, 'putBlob'), localDelete = vi.spyOn(blobs, 'deleteBlob');
  expect(await h.coordinator.execute(h.confirmation)).toEqual({ status: 'VERIFIED_AND_RECORDED', outcome: 'verified_remote_content',
    reservation: 'COMMITTED', receipt: 'COMMITTED', remoteEffect: 'KNOWN_FILE' });
  expect(cas).toHaveBeenCalledTimes(2);
  const reserved = cas.mock.calls[1][0].expected;
  expect(reserved).toEqual({ ...initial, remoteProvider: 'googleDrive', remoteSyncStatus: 'uploading', remoteSyncAttemptCount: 1,
    lastRemoteSyncAttemptAt: '2030-01-01T00:00:00.000Z', updatedAt: '2030-01-01T00:00:00.000Z' });
  expect(reserved).not.toEqual(cas.mock.calls[0][0].expected);
  expect(await repo.getAttachment('original')).toMatchObject({ remoteSyncStatus: 'synced', remoteFileId: 'drive-original',
    remoteChecksum: initial?.checksum, remoteVerification: { checksumAlgorithm: 'sha256', checksumVerified: true, sizeVerified: true } });
  expect(h.fetcher.mock.calls.map(([, init]) => init?.method)).toEqual(['POST', 'PUT', 'GET']);
  expect(h.upload).toHaveBeenCalledTimes(1); expect(h.download).toHaveBeenCalledTimes(1);
  expect(new Uint8Array(await h.upload.mock.calls[0][0].blob.arrayBuffer())).toEqual(bytes);
  expect(put).not.toHaveBeenCalled(); expect(update).not.toHaveBeenCalled(); expect(localWrite).not.toHaveBeenCalled(); expect(localDelete).not.toHaveBeenCalled();
  expect(useNotesStore.getState().notes[0]).toBe(originalNote); expect(await repo.getAttachment('b-original')).toEqual(b);
  expect(new Uint8Array((await (await blobs.getBlob(initial!.localBlobKey!))!.blob.arrayBuffer()))).toEqual(bytes);
  expect(authFetch).not.toHaveBeenCalled();
});

it.each([undefined, 'true', '1'])('leaves default isolation %s closed before reservation or remote calls', async setting => {
  const h = await setup(); vi.stubEnv(isolation, setting);
  const cas = vi.spyOn(repo, 'transitionBackupForAccountNote');
  expect(isReturnToUseAttachmentIsolationEnabled()).toBe(true);
  expect(await h.coordinator.execute(h.confirmation)).toEqual({ status: 'DENIED', remoteEffect: 'NOT_STARTED' });
  expect(cas).not.toHaveBeenCalled(); expect(h.fetcher).not.toHaveBeenCalled();
});

it('is inactive outside test mode even with an explicit isolation opt-out', async () => {
  const h = await setup(); vi.stubEnv('MODE', 'production');
  expect(await h.coordinator.execute(h.confirmation)).toMatchObject({ status: 'DENIED', remoteEffect: 'NOT_STARTED' });
  expect(h.fetcher).not.toHaveBeenCalled();
});

it.each(['unconfirmed', 'other-account', 'other-note', 'missing-reference', 'forged-token'] as const)('rejects %s before any reservation', async kind => {
  const h = await setup();
  if (kind === 'missing-reference') useNotesStore.setState({ notes: [{ ...useNotesStore.getState().notes[0]!, body: 'no attachment' }] });
  const token = kind === 'forged-token' ? { kind: 'single-original-backup-confirmation' as const }
    : h.coordinator.confirmSelection({ accountId: kind === 'other-account' ? 'B' : 'A', noteId: kind === 'other-note' ? 'absent' : 'note',
      candidate: h.candidate, confirmed: (kind !== 'unconfirmed') as true });
  const cas = vi.spyOn(repo, 'transitionBackupForAccountNote');
  if (kind === 'forged-token') expect(await h.coordinator.execute(token!)).toMatchObject({ status: 'DENIED' }); else expect(token).toBeNull();
  expect(cas).not.toHaveBeenCalled(); expect(h.fetcher).not.toHaveBeenCalled();
});

it.each(['missing', 'corrupt', 'metadata-changed'] as const)('fails %s local preflight without reservation or upload', async kind => {
  const h = await setup(), before = await repo.getAttachment('original');
  if (kind === 'missing') await blobs.deleteBlob(before!.localBlobKey!);
  if (kind === 'corrupt') await blobs.putBlob({ key: before!.localBlobKey!, blob: new Blob([new Uint8Array(5)], { type: before!.mimeType }),
    mimeType: before!.mimeType, checksum: before!.checksum });
  if (kind === 'metadata-changed') await repo.putAttachment({ ...before!, fileName: 'changed.pdf' });
  const cas = vi.spyOn(repo, 'transitionBackupForAccountNote');
  expect(await h.coordinator.execute(h.confirmation)).toMatchObject({ status: 'NOT_STARTED', remoteEffect: 'NOT_STARTED' });
  expect(cas).not.toHaveBeenCalled(); expect(h.fetcher).not.toHaveBeenCalled();
});

it.each(['DENIED', 'ABORTED', 'INDETERMINATE', 'NOT_STARTED'] as const)('never uploads after reservation %s', async status => {
  const h = await setup(); vi.spyOn(repo, 'transitionBackupForAccountNote').mockResolvedValue({ status });
  expect(await h.coordinator.execute(h.confirmation)).toMatchObject({ status: status === 'INDETERMINATE' ? 'INDETERMINATE' : 'NOT_STARTED',
    reservation: status, remoteEffect: 'NOT_STARTED' });
  expect(h.fetcher).not.toHaveBeenCalled();
});

it('denies a local metadata change between readback and reservation using the real CAS', async () => {
  const h = await setup(), cas = repo.transitionBackupForAccountNote.bind(repo);
  vi.spyOn(repo, 'transitionBackupForAccountNote').mockImplementationOnce(async input => {
    await repo.putAttachment({ ...input.expected, fileName: 'newer.pdf' }); return cas(input);
  });
  expect(await h.coordinator.execute(h.confirmation)).toMatchObject({ reservation: 'DENIED', remoteEffect: 'NOT_STARTED' });
  expect(h.upload).not.toHaveBeenCalled(); expect((await repo.getAttachment('original'))?.fileName).toBe('newer.pdf');
});

it('rechecks actual reserved state instead of assuming a committed reservation is unchanged', async () => {
  const h = await setup(), cas = repo.transitionBackupForAccountNote.bind(repo);
  vi.spyOn(repo, 'transitionBackupForAccountNote').mockImplementationOnce(async input => {
    const result = await cas(input); await repo.updateAttachment('original', { caption: 'newer metadata' }); return result;
  });
  expect(await h.coordinator.execute(h.confirmation)).toMatchObject({ status: 'NOT_COMPLETED', reservation: 'COMMITTED', remoteEffect: 'NOT_STARTED' });
  expect(h.upload).not.toHaveBeenCalled();
});

it('rechecks original bytes after reservation before uploading and durably blocks a changed source', async () => {
  const h = await setup(), cas = repo.transitionBackupForAccountNote.bind(repo);
  vi.spyOn(repo, 'transitionBackupForAccountNote').mockImplementationOnce(async input => {
    const result = await cas(input);
    await blobs.putBlob({ key: input.expected.localBlobKey!, blob: new Blob([new Uint8Array(5)], { type: input.expected.mimeType }),
      mimeType: input.expected.mimeType, checksum: input.expected.checksum }); return result;
  });
  expect(await h.coordinator.execute(h.confirmation)).toMatchObject({ status: 'NOT_COMPLETED', outcome: 'definitive_failure', receipt: 'COMMITTED', remoteEffect: 'NOT_STARTED' });
  expect(h.upload).not.toHaveBeenCalled(); expect((await repo.getAttachment('original'))?.remoteSyncStatus).toBe('failed');
});

it('consumes a confirmation once and lets competing confirmations/CAS instances upload only once', async () => {
  const h = await setup(), other = h.coordinator.confirmSelection({ accountId: 'A', noteId: 'note', candidate: h.candidate, confirmed: true })!;
  const results = await Promise.all([h.coordinator.execute(h.confirmation), h.coordinator.execute(h.confirmation), h.coordinator.execute(other)]);
  expect(results.filter(result => result.status === 'VERIFIED_AND_RECORDED')).toHaveLength(1);
  expect(results.some(result => result.status === 'DENIED')).toBe(true); expect(h.upload).toHaveBeenCalledTimes(1);
  const latest = await listPublishedLocalDocumentOriginals({ accountId: 'A', noteId: 'note', repository: repo });
  if (latest.status !== 'VERIFIED') throw new Error('fixture');
  const again = h.coordinator.confirmSelection({ accountId: 'A', noteId: 'note', candidate: latest.documents[0]!, confirmed: true })!;
  expect(await h.coordinator.execute(again)).toMatchObject({ reservation: 'DENIED', remoteEffect: 'NOT_STARTED' });
  expect(h.upload).toHaveBeenCalledTimes(1);
});

it.each(['session-replacement', 'session-ABA', 'logout', 'expired', 'note-edit', 'note-delete', 'account-ABA'] as const)(
  'does not publish a late upload after %s and does not pretend cancellation undid the write', async kind => {
    const h = await setup(), started = deferred<void>(), release = deferred<void>();
    h.remote.gate = () => { started.resolve(); return release.promise; };
    const pending = h.coordinator.execute(h.confirmation); await started.promise;
    if (kind === 'session-replacement') h.runtime.replaceAccount('A');
    if (kind === 'session-ABA') { h.runtime.replaceAccount('B'); h.runtime.replaceAccount('A'); }
    if (kind === 'logout') h.runtime.replaceAccount(null);
    if (kind === 'expired') h.disconnect();
    if (kind === 'note-edit' || kind === 'note-delete') useNotesStore.setState({ notes: useNotesStore.getState().notes.map(n =>
      ({ ...n, ...(kind === 'note-edit' ? { body: n.body + '\nnew content' } : { deletedAt: 5 }) })) });
    if (kind === 'account-ABA') { await seed('B'); await seed('A'); }
    release.resolve();
    expect(await pending).toMatchObject({ status: 'INDETERMINATE', outcome: 'indeterminate', remoteEffect: 'POSSIBLE' });
    expect(h.upload).toHaveBeenCalledTimes(1); expect(h.download).not.toHaveBeenCalled();
    expect((await repo.getAttachment('original'))?.remoteSyncStatus).toBe('uploading');
    expect(await h.coordinator.execute(h.confirmation)).toMatchObject({ status: 'DENIED' });
    expect(h.upload).toHaveBeenCalledTimes(1);
  });

it.each(['mismatch', 'lost-response', 'missing-id', 'readback-auth', 'readback-network', 'expired-token'] as const)(
  'records truthful %s failure without automatic retry or an unverified receipt', async kind => {
    const h = await setup();
    if (kind === 'mismatch') h.remote.bytes = new Uint8Array(5);
    if (kind === 'lost-response') h.remote.loseResponse = true;
    if (kind === 'missing-id') h.remote.missingId = true;
    if (kind === 'readback-auth') h.remote.getStatus = 403;
    if (kind === 'readback-network') h.download.mockRejectedValue(new Error('network failure'));
    if (kind === 'expired-token') h.token.mockRejectedValue(new Error('expired test token'));
    const outcome = kind === 'mismatch' || kind === 'expired-token' ? 'definitive_failure'
      : kind === 'lost-response' || kind === 'missing-id' ? 'indeterminate' : 'verification_unavailable';
    expect(await h.coordinator.execute(h.confirmation)).toMatchObject({ status: 'NOT_COMPLETED', outcome, receipt: 'COMMITTED' });
    const final = await repo.getAttachment('original');
    expect(final).toMatchObject({ remoteSyncStatus: 'failed', remoteError: outcome, remoteSyncAttemptCount: 1 });
    expect(final?.remoteVerification).toBeUndefined(); expect(final?.remoteChecksum).toBeUndefined();
    expect(await h.coordinator.execute(h.confirmation)).toMatchObject({ status: 'DENIED' });
    expect(h.upload).toHaveBeenCalledTimes(1);
    expect(new Uint8Array(await (await blobs.getBlob(final!.localBlobKey!))!.blob.arrayBuffer())).toEqual(bytes);
  });

it('times out readback without accepting a late completion or uploading again', async () => {
  const h = await setup(), started = deferred<void>(), late = deferred<Blob>();
  const schedule = globalThis.setTimeout;
  let timeout!: () => void;
  vi.spyOn(globalThis, 'setTimeout').mockImplementation(((...args: Parameters<typeof setTimeout>) => {
    if (args[1] === 30_000) timeout = () => (args[0] as () => void)();
    return schedule(...args);
  }) as typeof setTimeout);
  h.download.mockImplementation(() => { started.resolve(); return late.promise; });
  const pending = h.coordinator.execute(h.confirmation); await started.promise;
  timeout();
  expect(await pending).toMatchObject({ status: 'NOT_COMPLETED', outcome: 'verification_unavailable', receipt: 'COMMITTED' });
  late.resolve(new Blob([bytes]));
  await Promise.resolve();
  expect((await repo.getAttachment('original'))?.remoteSyncStatus).toBe('failed');
  expect(h.upload).toHaveBeenCalledTimes(1);
});

it.each(['DENIED', 'ABORTED', 'INDETERMINATE', 'throw'] as const)('never reports completion when verified remote bytes have receipt %s', async state => {
  const h = await setup(), cas = repo.transitionBackupForAccountNote.bind(repo);
  const spy = vi.spyOn(repo, 'transitionBackupForAccountNote');
  spy.mockImplementation(async input => {
    if (input.transition.kind === 'reserve') return cas(input);
    if (state === 'throw') throw new Error('receipt response lost');
    return { status: state };
  });
  expect(await h.coordinator.execute(h.confirmation)).toMatchObject({ status: 'NOT_COMPLETED', outcome: 'verified_remote_content',
    receipt: state === 'throw' ? 'INDETERMINATE' : state, remoteEffect: 'KNOWN_FILE' });
  expect((await repo.getAttachment('original'))?.remoteSyncStatus).toBe('uploading');
  expect(h.upload).toHaveBeenCalledTimes(1);
});

it('blocks a first HTTP request if the same-account session changes while awaiting a token', async () => {
  const h = await setup(), started = deferred<void>(), token = deferred<string>();
  h.token.mockImplementationOnce(() => { started.resolve(); return token.promise; });
  const pending = h.coordinator.execute(h.confirmation); await started.promise;
  h.runtime.replaceAccount('A'); token.resolve('late-test-token');
  expect(await pending).toMatchObject({ status: 'INDETERMINATE' });
  expect(h.fetcher).not.toHaveBeenCalled(); expect((await repo.getAttachment('original'))?.remoteSyncStatus).toBe('uploading');
});

it.each(['session', 'metadata'] as const)('blocks content PUT after %s changes during upload-session creation', async kind => {
  const h = await setup();
  h.fetcher.mockImplementationOnce(async () => {
    if (kind === 'session') h.runtime.replaceAccount('A');
    else await repo.updateAttachment('original', { deletedAt: '2030-01-01T00:00:01.000Z', syncStatus: 'deleted' });
    return new Response(null, { status: 200, headers: { Location: 'https://test.invalid/upload' } });
  });
  expect(await h.coordinator.execute(h.confirmation)).not.toMatchObject({ status: 'VERIFIED_AND_RECORDED' });
  expect(h.fetcher.mock.calls.map(([, init]) => init?.method)).toEqual(['POST']);
});

it('revalidates the second token await before remote readback GET', async () => {
  const h = await setup(), started = deferred<void>(), token = deferred<string>();
  h.token.mockResolvedValueOnce('test-upload-token').mockImplementationOnce(() => { started.resolve(); return token.promise; });
  const pending = h.coordinator.execute(h.confirmation); await started.promise;
  h.runtime.replaceAccount('B'); h.runtime.replaceAccount('A'); token.resolve('stale-read-token');
  expect(await pending).toMatchObject({ status: 'INDETERMINATE', remoteEffect: 'KNOWN_FILE' });
  expect(h.fetcher.mock.calls.map(([, init]) => init?.method)).toEqual(['POST', 'PUT']);
  expect((await repo.getAttachment('original'))?.remoteSyncStatus).toBe('uploading');
});

it('does not overwrite changed attachment ownership after remote upload completion', async () => {
  const h = await setup(), started = deferred<void>(), release = deferred<void>();
  h.remote.gate = () => { started.resolve(); return release.promise; };
  const pending = h.coordinator.execute(h.confirmation); await started.promise;
  await repo.updateAttachment('original', { accountId: 'B', noteId: 'other' } as never);
  const changed = await repo.getAttachment('original'); release.resolve();
  expect(await pending).toMatchObject({ status: 'NOT_COMPLETED', outcome: 'verification_unavailable', receipt: 'DENIED' });
  expect(await repo.getAttachment('original')).toEqual(changed);
  expect(h.fetcher.mock.calls.map(([, init]) => init?.method)).toEqual(['POST', 'PUT']);
});

it.each(['logout', 'note-edit'] as const)('ignores a readback completing after %s without writing a receipt', async kind => {
  const h = await setup(), started = deferred<void>(), remote = deferred<Blob>();
  h.download.mockImplementationOnce(() => { started.resolve(); return remote.promise; });
  const cas = vi.spyOn(repo, 'transitionBackupForAccountNote');
  const pending = h.coordinator.execute(h.confirmation); await started.promise;
  if (kind === 'logout') h.runtime.replaceAccount(null);
  else useNotesStore.setState({ notes: useNotesStore.getState().notes.map(n => ({ ...n, title: 'renamed' })) });
  remote.resolve(new Blob([bytes]));
  expect(await pending).toMatchObject({ status: 'INDETERMINATE', remoteEffect: 'KNOWN_FILE' });
  expect(cas).toHaveBeenCalledTimes(1); expect((await repo.getAttachment('original'))?.remoteSyncStatus).toBe('uploading');
});

it('denies a stale Note at the real terminal CAS boundary', async () => {
  const h = await setup(), cas = repo.transitionBackupForAccountNote.bind(repo);
  vi.spyOn(repo, 'transitionBackupForAccountNote').mockImplementation(async input => {
    if (input.transition.kind === 'finish') useNotesStore.setState({ notes: useNotesStore.getState().notes.map(n => ({ ...n, deletedAt: 5 })) });
    return cas(input);
  });
  expect(await h.coordinator.execute(h.confirmation)).toMatchObject({ status: 'INDETERMINATE', receipt: 'DENIED', outcome: 'verified_remote_content' });
  expect((await repo.getAttachment('original'))?.remoteSyncStatus).toBe('uploading');
});

it('does not claim completion after a committed receipt response is lost or retry from a new instance', async () => {
  const h = await setup(), cas = repo.transitionBackupForAccountNote.bind(repo);
  vi.spyOn(repo, 'transitionBackupForAccountNote').mockImplementation(async input => {
    const result = await cas(input);
    if (input.transition.kind === 'finish') throw new Error('local acknowledgement lost');
    return result;
  });
  expect(await h.coordinator.execute(h.confirmation)).toMatchObject({ status: 'NOT_COMPLETED', receipt: 'INDETERMINATE', outcome: 'verified_remote_content' });
  expect((await new LocalAttachmentMetadataRepository().getAttachment('original'))?.remoteSyncStatus).toBe('synced');
  const h2 = harness();
  const listed = await listPublishedLocalDocumentOriginals({ accountId: 'A', noteId: 'note', repository: repo });
  if (listed.status !== 'VERIFIED') throw new Error('fixture');
  const again = h2.coordinator.confirmSelection({ accountId: 'A', noteId: 'note', candidate: listed.documents[0]!, confirmed: true })!;
  expect(await h2.coordinator.execute(again)).toMatchObject({ reservation: 'DENIED', remoteEffect: 'NOT_STARTED' });
  // h2's prototype spy also sees h's earlier call, but no further upload was dispatched.
  expect(h.upload).toHaveBeenCalledTimes(1);
});

it('does not replace remote SHA-256 with size/metadata if hashing becomes unavailable', async () => {
  const h = await setup(), digest = crypto.subtle.digest.bind(crypto.subtle);
  let calls = 0;
  vi.spyOn(crypto.subtle, 'digest').mockImplementation((algorithm, data) => {
    if (++calls === 3) return Promise.reject(new Error('SHA-256 unavailable at readback'));
    return digest(algorithm, data);
  });
  expect(await h.coordinator.execute(h.confirmation)).toMatchObject({ status: 'NOT_COMPLETED', outcome: 'verification_unavailable', receipt: 'COMMITTED' });
  expect((await repo.getAttachment('original'))?.remoteVerification).toBeUndefined();
});
