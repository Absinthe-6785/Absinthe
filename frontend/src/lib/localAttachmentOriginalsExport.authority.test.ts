// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createHash, webcrypto } from 'node:crypto';
import { NOTES_CORE_DOMAIN, NOTES_FOLDERS_DOMAIN, type NotesAuthorityRequest } from './notesAccountAuthority';
import type { NotesPersistenceInitResult } from './notePersistence';
const persistence = vi.hoisted(() => ({ initialize: vi.fn() }));
vi.mock('./notePersistence', async original => ({ ...await original<typeof import('./notePersistence')>(), initNotesPersistence: persistence.initialize }));
vi.mock('./supabase', () => ({ authFetch: vi.fn(), authReadFetch: vi.fn() }));
vi.mock('./vaultSnapshotAuto', () => ({ scheduleAutoSnapshot: vi.fn() }));
import { useNotesStore, observePublishedNotesHydration } from '../store/useNotesStore';
import { resetNotesPersistenceForTests } from './notePersistence';
import { setRecoveryModeActiveForTest } from './recoverySafetyPolicy';
import { NOTES_RUNTIME_SYNC_MODE_KEY } from './notesSyncClient';
import { createLocalOriginalsExport } from './localAttachmentOriginalsExport';
import { authFetch, authReadFetch } from './supabase';
function hydrated(accountId: string, request: NotesAuthorityRequest): NotesPersistenceInitResult {
  const notes = [{ id: `note-${accountId}`, title: 'Note', body: '', updatedAt: 1, folderId: null, deletedAt: null }];
  const domain = (domainId: typeof NOTES_CORE_DOMAIN | typeof NOTES_FOLDERS_DOMAIN, count: number) => ({
    accountId, domainId, schemaVersion: 1, state: count ? 'LOADED_POPULATED' as const : 'LOADED_EMPTY' as const,
    recordCount: count, verifiedAt: 1, legacyGlobalDataPresent: false,
  });
  return { notes, mode: 'accountScoped', accountId, requestGeneration: request.generation, migrated: false, migrationMs: 0, loadMs: 0,
    notesAuthorityState: domain(NOTES_CORE_DOMAIN, 1), foldersAuthorityState: domain(NOTES_FOLDERS_DOMAIN, 0) };
}
beforeEach(() => {
  useNotesStore.getState().detachNotesStorage(); resetNotesPersistenceForTests(); setRecoveryModeActiveForTest(false);
  localStorage.clear(); localStorage.setItem(NOTES_RUNTIME_SYNC_MODE_KEY, 'local');
  persistence.initialize.mockImplementation(async (account: string, request: NotesAuthorityRequest) => hydrated(account, request));
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); useNotesStore.getState().detachNotesStorage(); });
async function publish(account: string) { await useNotesStore.getState().initNotesStorage(account); expect(observePublishedNotesHydration().status).toBe('CURRENT'); }
it('revokes the exact real publication across A/B/A during metadata reads', async () => {
  await publish('A'); const download = vi.fn(); let resolve!: (value: []) => void;
  const owner = createLocalOriginalsExport('A', () => true, { repository: { listAttachmentsForAccount: () => new Promise(yes => { resolve = yes; }) }, blobs: { getBlob: vi.fn() }, download });
  const work = owner.preflight(); await publish('B'); await publish('A'); resolve([]);
  await expect(work).rejects.toThrow('cancelled'); await expect(owner.download(true)).rejects.toThrow('cancelled'); expect(download).not.toHaveBeenCalled();
});
it('rejects an unproven replacement array and a mismatched requesting account', async () => {
  await publish('A'); expect(() => createLocalOriginalsExport('B', () => true)).toThrow('authority_unavailable');
  const owner = createLocalOriginalsExport('A', () => true, { repository: { listAttachmentsForAccount: async () => [] }, blobs: { getBlob: vi.fn() } });
  await owner.preflight(); useNotesStore.setState({ notes: [...useNotesStore.getState().notes] });
  expect(owner.isCurrent()).toBe(false); await expect(owner.download(true)).rejects.toThrow('cancelled');
});

it.each(['current', 'blob-aba', 'checksum-aba', 'zip-aba'])('exports documents through real publication authority, %s, without requiring/activating an editor', async stage => {
  vi.stubGlobal('crypto', webcrypto);
  persistence.initialize.mockImplementation(async (account: string, request: NotesAuthorityRequest) => {
    const result = hydrated(account, request); result.notes[0].body = 'attachment://doc'; return result;
  });
  await publish('A'); useNotesStore.getState().setActiveNoteId(null);
  const bytes = new Uint8Array([0, 255, 1]);
  const checksum = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
  const metadata = { id: 'doc', accountId: 'A', noteId: 'note-A', fileName: '원본.pdf', mimeType: 'application/pdf',
    source: 'local' as const, size: bytes.length, checksum, localBlobKey: 'local-document/A/doc', deletedAt: null,
    createdAt: '2026-10-01', updatedAt: '2026-10-01' };
  const aba = async () => { await publish('B'); await publish('A'); };
  const download = vi.fn(), write = vi.fn();
  vi.mocked(authFetch).mockClear(); vi.mocked(authReadFetch).mockClear();
  if (stage === 'checksum-aba') {
    const digest = crypto.subtle.digest.bind(crypto.subtle);
    vi.spyOn(crypto.subtle, 'digest').mockImplementation(async (...args) => { const result = await digest(...args); await aba(); return result; });
  }
  const owner = createLocalOriginalsExport('A', () => true, {
    repository: { listAttachmentsForAccount: async () => [metadata], ...{ putAttachment: write, deleteAttachmentMetadata: write } },
    blobs: { getBlob: async () => { if (stage === 'blob-aba') await aba();
      return { key: metadata.localBlobKey, mimeType: metadata.mimeType, size: bytes.length, checksum, blob: new Blob([bytes], { type: metadata.mimeType }) };
    }, ...{ putBlob: write, deleteBlob: write } },
    buildZip: async () => { if (stage === 'zip-aba') await aba(); return new Blob(); }, download,
  });
  if (stage === 'blob-aba' || stage === 'checksum-aba') await expect(owner.preflight()).rejects.toThrow('cancelled');
  else {
    expect((await owner.preflight()).entries[0]).toMatchObject({ reason: 'included', integrity: 'sha256' });
    if (stage === 'zip-aba') await expect(owner.download()).rejects.toThrow('cancelled');
    else { await owner.download(); expect(download).toHaveBeenCalledOnce(); expect(useNotesStore.getState().activeNoteId).toBeNull(); }
  }
  if (stage !== 'current') expect(download).not.toHaveBeenCalled();
  expect(authFetch).not.toHaveBeenCalled(); expect(authReadFetch).not.toHaveBeenCalled(); expect(write).not.toHaveBeenCalled();
});
