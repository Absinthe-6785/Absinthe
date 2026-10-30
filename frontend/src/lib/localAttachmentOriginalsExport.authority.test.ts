// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
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
afterEach(() => useNotesStore.getState().detachNotesStorage());
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
