// @vitest-environment happy-dom
import { act, createElement, Fragment } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NoteBase } from '../noteUtils';
import {
  getActiveNotesAuthorityRequest,
  NOTES_CORE_DOMAIN,
  NOTES_FOLDERS_DOMAIN,
  type NotesAuthorityDomainState,
  type NotesAuthorityRequest,
} from '../../../lib/notesAccountAuthority';
import type { NotesPersistenceInitResult } from '../../../lib/notePersistence';
import type { AccountScopedAttachmentMetadata } from '../../../lib/attachmentRepository';

const persistence = vi.hoisted(() => ({ initialize: vi.fn() }));
const attachments = vi.hoisted(() => ({
  list: vi.fn(),
  blobUrl: vi.fn(),
  revoke: vi.fn(),
}));

vi.mock('../../../lib/notePersistence', async importOriginal => ({
  ...await importOriginal<typeof import('../../../lib/notePersistence')>(),
  initNotesPersistence: persistence.initialize,
}));
vi.mock('../../../lib/supabase', () => ({ authFetch: vi.fn(), authReadFetch: vi.fn() }));
vi.mock('../../../lib/vaultSnapshotAuto', () => ({ scheduleAutoSnapshot: vi.fn() }));
vi.mock('../../../lib/attachmentMetadataIndexedDb', () => ({
  createLocalAttachmentMetadataRepository: () => ({
    listAttachmentsForAccountNote: attachments.list,
    tombstoneAttachmentForAccountNote: vi.fn(),
  }),
}));
vi.mock('../../../lib/attachmentBlobIndexedDb', () => ({
  createLocalAttachmentBlobAdapter: () => ({ getObjectUrl: attachments.blobUrl, revokeObjectUrl: attachments.revoke }),
}));

const { useNotesStore, observePublishedNotesHydration } = await import('../../../store/useNotesStore');
const { resetNotesPersistenceForTests } = await import('../../../lib/notePersistence');
const { setRecoveryModeActiveForTest } = await import('../../../lib/recoverySafetyPolicy');
const { NoteImageAttachments } = await import('./NoteImageAttachments');

const colors = {
  sideBdr: '#ddd', card: '#fff', editor: '#fff', input: '#fff', inputBdr: '#ddd',
  text: '#111', textMuted: '#555', textFaint: '#888', danger: '#dc2626',
} as never;

function note(id: string): NoteBase {
  return { id, title: id, body: `attachment://${id}-image`, updatedAt: 1, createdAt: 1, folderId: null, deletedAt: null };
}

function domainState(
  request: NotesAuthorityRequest,
  domainId: NotesAuthorityDomainState['domainId'],
  count: number,
): NotesAuthorityDomainState {
  return {
    accountId: request.accountId, domainId, schemaVersion: 1,
    state: count ? 'LOADED_POPULATED' : 'LOADED_EMPTY', recordCount: count,
    verifiedAt: 1, legacyGlobalDataPresent: false,
  };
}

function hydrated(request: NotesAuthorityRequest, notes: NoteBase[]): NotesPersistenceInitResult {
  return {
    notes, mode: 'accountScoped', accountId: request.accountId,
    requestGeneration: request.generation, migrated: false, migrationMs: 0, loadMs: 0,
    notesAuthorityState: domainState(request, NOTES_CORE_DOMAIN, notes.length),
    foldersAuthorityState: domainState(request, NOTES_FOLDERS_DOMAIN, 0),
  };
}

function metadata(accountId: string, noteId: string, id: string): AccountScopedAttachmentMetadata {
  return {
    id, accountId, noteId, fileName: `${id}.png`, mimeType: 'image/png', size: 5,
    localBlobKey: `local-image/${accountId}/${id}`, source: 'local',
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', deletedAt: null,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(yes => { resolve = yes; });
  return { promise, resolve };
}

async function flushAsync() {
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
}

let root: Root | null = null;
let host: HTMLElement | null = null;
let unsubscribeStore: (() => void) | null = null;

beforeEach(() => {
  useNotesStore.getState().detachNotesStorage();
  resetNotesPersistenceForTests();
  setRecoveryModeActiveForTest(false);
  localStorage.clear();
  persistence.initialize.mockReset();
  attachments.list.mockReset();
  attachments.blobUrl.mockReset().mockImplementation(async (key: string) => `blob:${key}`);
  attachments.revoke.mockReset();
});

afterEach(() => {
  unsubscribeStore?.();
  unsubscribeStore = null;
  if (root) act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
  useNotesStore.getState().detachNotesStorage();
  resetNotesPersistenceForTests();
});

describe('NoteImageAttachments actual Notes Store hydration transition', () => {
  it('retires old previews at replacement start and never publishes a late old attachment result', async () => {
    const initialNote = note('note-a');
    persistence.initialize.mockImplementationOnce(async (_account: string, request: NotesAuthorityRequest) =>
      hydrated(request, [initialNote]));
    await useNotesStore.getState().initNotesStorage('account-a');
    const initialPublication = observePublishedNotesHydration();
    expect(initialPublication.status).toBe('CURRENT');

    const lateMetadata = deferred<AccountScopedAttachmentMetadata[]>();
    attachments.list
      .mockImplementationOnce(async () => [metadata('account-a', initialNote.id, 'image-ready')])
      .mockImplementationOnce(() => lateMetadata.promise)
      .mockImplementation(async (accountId: string, noteId: string) => [metadata(accountId, noteId, 'image-new')]);

    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    const render = (displayed: NoteBase) => act(() => root?.render(createElement(Fragment, null,
      createElement(NoteImageAttachments, { note: displayed, colors, readOnly: false }),
      createElement(NoteImageAttachments, { note: displayed, colors, readOnly: false }),
    )));
    render(initialNote);
    await flushAsync();
    expect(host.querySelectorAll('img')).toHaveLength(1);
    expect((host.querySelector('img') as HTMLImageElement).src).toContain('image-ready');
    expect(attachments.list).toHaveBeenCalledTimes(2);

    const replacement = deferred<NotesPersistenceInitResult>();
    persistence.initialize.mockReturnValueOnce(replacement.promise);
    const replacementObservations: ReturnType<typeof observePublishedNotesHydration>[] = [];
    unsubscribeStore = useNotesStore.subscribe(() => replacementObservations.push(observePublishedNotesHydration()));
    const previousNotes = useNotesStore.getState().notes;
    let replacementRun!: Promise<void>;
    act(() => { replacementRun = useNotesStore.getState().initNotesStorage('account-a'); });

    expect(replacementObservations).toHaveLength(1);
    expect(replacementObservations[0]).toMatchObject({
      status: 'UNAVAILABLE', reason: 'PENDING_REPLACEMENT_HYDRATION',
    });
    expect(observePublishedNotesHydration()).toMatchObject({
      status: 'UNAVAILABLE', reason: 'PENDING_REPLACEMENT_HYDRATION',
    });
    expect(useNotesStore.getState().notes).toBe(previousNotes);
    expect(host.querySelector('img')).toBeNull();
    expect(attachments.revoke).toHaveBeenCalledWith('blob:local-image/account-a/image-ready');

    await act(async () => {
      lateMetadata.resolve([metadata('account-a', initialNote.id, 'image-late')]);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(host.querySelector('img')).toBeNull();
    expect(attachments.blobUrl).toHaveBeenCalledTimes(1);

    const replacementRequest = getActiveNotesAuthorityRequest();
    if (!replacementRequest) throw new Error('replacement authority request missing');
    expect(initialPublication.status).toBe('CURRENT');
    if (initialPublication.status === 'CURRENT') expect(replacementRequest).not.toBe(initialPublication.request);
    const replacementNote = note('note-a2');
    replacement.resolve(hydrated(replacementRequest, [replacementNote]));
    await replacementRun;

    const publication = observePublishedNotesHydration();
    expect(publication.status).toBe('CURRENT');
    render(replacementNote);
    await flushAsync();
    expect(host.querySelector('img')).not.toBeNull();
    expect((host.querySelector('img') as HTMLImageElement).src).toContain('image-new');
  });
});
