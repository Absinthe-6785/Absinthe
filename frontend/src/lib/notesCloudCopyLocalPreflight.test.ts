import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NoteBase } from '../components/views/noteUtils';
import type { NotesAuthorityRequest } from './notesAccountAuthority';
import {
  preflightLocalNoteForCloudCopy,
  type NotesCloudCopyLocalPreflightDependencies,
} from './notesCloudCopyLocalPreflight';

const baseNote = (): NoteBase => ({
  id: 'local-note-1',
  title: 'Stable local title',
  body: 'A [[note-id:target|label]] stays authored Markdown.',
  createdAt: 10,
  updatedAt: 20,
  folderId: null,
  deletedAt: null,
  starred: false,
});

function harness(overrides: Partial<NoteBase> = {}) {
  const requestA: NotesAuthorityRequest = Object.freeze({ accountId: 'account-a', generation: 1 });
  let request: NotesAuthorityRequest | null = requestA;
  let accountId: string | null = 'account-a';
  const source = { ...baseNote(), ...overrides };
  let notes: NoteBase[] = [source];
  let state = {
    notes,
    activeAccountId: 'account-a',
    notesAuthorityState: 'LOADED_POPULATED',
    foldersAuthorityState: 'LOADED_EMPTY',
    vaultStructureVersion: 4,
    indexContentVersion: 9,
  };
  let metadata: { readonly status: 'COMPLETE' | 'INCOMPLETE'; readonly matchingRecords?: number } = {
    status: 'COMPLETE', matchingRecords: 0,
  };
  let persistedNotes: readonly NoteBase[] = [structuredClone(source)];
  let persistedStatus: 'CURRENT' | 'UNAVAILABLE' = 'CURRENT';
  let persistedReason: 'STALE_REQUEST' | 'MALFORMED' | 'READ_FAILED' = 'READ_FAILED';
  const metadataRead = vi.fn(async () => metadata);
  const persistedRead = vi.fn(async (readRequest: NotesAuthorityRequest, isCurrent: () => boolean) => {
    if (readRequest !== request || !isCurrent()) {
      return { status: 'UNAVAILABLE' as const, reason: 'STALE_REQUEST' as const };
    }
    if (persistedStatus === 'UNAVAILABLE') {
      return { status: 'UNAVAILABLE' as const, reason: persistedReason };
    }
    return { status: 'CURRENT' as const, notes: persistedNotes };
  });
  const deps: NotesCloudCopyLocalPreflightDependencies = {
    observePublication: () => request
      ? { status: 'CURRENT', request }
      : { status: 'UNAVAILABLE', reason: 'MISSING_AUTHORITY' },
    getActiveRequest: () => request,
    getActiveAccountId: () => accountId,
    getStoreState: () => state,
    observePersistedNotes: persistedRead,
    inspectAttachmentMetadata: metadataRead,
  };

  return {
    deps,
    source,
    get notes() { return notes; },
    get request() { return request; },
    get metadata() { return metadata; },
    set metadata(value) { metadata = value; },
    set persistedNotes(value) { persistedNotes = value; },
    set persistedStatus(value) { persistedStatus = value; },
    set persistedReason(value) { persistedReason = value; },
    set notes(value) { notes = value; state = { ...state, notes }; },
    set request(value) { request = value; },
    set accountId(value) { accountId = value; },
    set state(value) { state = value; notes = value.notes; },
    metadataRead,
    persistedRead,
  };
}

function reasons(result: Awaited<ReturnType<typeof preflightLocalNoteForCloudCopy>>) {
  return result.status === 'INELIGIBLE' ? result.reasons : [];
}

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('read-only local Note cloud-copy preflight', () => {
  it('returns only the exact safe snapshot for a current durable root Note and preserves the local ID/Markdown', async () => {
    const h = harness();
    const before = structuredClone(h.source);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await preflightLocalNoteForCloudCopy('local-note-1', h.deps);

    expect(result.status).toBe('ELIGIBLE_PREVIEW_ONLY');
    if (result.status !== 'ELIGIBLE_PREVIEW_ONLY') return;
    expect(result.authority).toBe('NONE');
    expect(result.localNoteId).toBe('local-note-1');
    expect(result.snapshot).toEqual({
      title: before.title, body: before.body, updated_at: before.updatedAt, starred: false,
    });
    expect(Object.keys(result.snapshot).sort()).toEqual(['body', 'starred', 'title', 'updated_at']);
    expect(result.sourceRevision).toMatchObject({ durableReadback: 'MATCHED', attachmentMetadata: 'COMPLETE_EMPTY' });
    expect(await result.isCurrent()).toBe(true);
    expect(h.source).toEqual(before);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(h.metadataRead).toHaveBeenCalledTimes(3);
  });

  it('fails closed for invalid, missing, duplicated, and malformed Note identities', async () => {
    const h = harness();
    expect(reasons(await preflightLocalNoteForCloudCopy('', h.deps))).toContain('INVALID_LOCAL_NOTE_ID');
    expect(reasons(await preflightLocalNoteForCloudCopy(' local-note-1 ', h.deps))).toContain('INVALID_LOCAL_NOTE_ID');
    expect(reasons(await preflightLocalNoteForCloudCopy('other', h.deps))).toContain('NOTE_NOT_FOUND');
    h.notes = [h.source, { ...h.source }];
    expect(reasons(await preflightLocalNoteForCloudCopy('local-note-1', h.deps))).toContain('NOTE_ID_AMBIGUOUS');
    h.notes = [{ ...h.source, title: null as unknown as string }];
    expect(reasons(await preflightLocalNoteForCloudCopy('local-note-1', h.deps))).toContain('NOTE_INCOMPLETE');
  });

  it('rejects folders, page properties, relations, trashed Notes, and unsupported body content', async () => {
    for (const [overrides, expected] of [
      [{ folderId: 'folder-1' }, 'FOLDER_UNSUPPORTED'],
      [{ properties: { tags: 'private' } }, 'PROPERTIES_UNSUPPORTED'],
      [{ relations: { related: ['target'] } }, 'RELATIONS_UNSUPPORTED'],
      [{ deletedAt: 30 }, 'NOTE_NOT_ACTIVE'],
      [{ body: 'image: data:image/png;base64,AAAA' }, 'ATTACHMENT_CONTENT_UNSUPPORTED'],
      [{ body: 'attachment://asset-1' }, 'ATTACHMENT_CONTENT_UNSUPPORTED'],
      [{ body: '![image](https://example.test/image.png)' }, 'ATTACHMENT_CONTENT_UNSUPPORTED'],
    ] as const) {
      const h = harness(overrides);
      expect(reasons(await preflightLocalNoteForCloudCopy('local-note-1', h.deps))).toContain(expected);
    }
    const restored = harness({ deletedAt: null });
    expect((await preflightLocalNoteForCloudCopy('local-note-1', restored.deps)).status).toBe('ELIGIBLE_PREVIEW_ONLY');
  });

  it('requires complete attachment ownership metadata and an empty exact-Note inventory', async () => {
    const attached = harness();
    attached.metadata = { status: 'COMPLETE', matchingRecords: 1 };
    expect(reasons(await preflightLocalNoteForCloudCopy('local-note-1', attached.deps))).toContain('ATTACHMENT_ORIGINALS_PRESENT');

    const unknown = harness();
    unknown.metadata = { status: 'INCOMPLETE' };
    expect(reasons(await preflightLocalNoteForCloudCopy('local-note-1', unknown.deps))).toContain('ATTACHMENT_METADATA_INCOMPLETE');

    const addedDuringCheck = harness();
    addedDuringCheck.metadataRead.mockImplementation(async () => (
      addedDuringCheck.metadataRead.mock.calls.length < 2
        ? { status: 'COMPLETE', matchingRecords: 0 }
        : { status: 'COMPLETE', matchingRecords: 1 }
    ));
    expect(reasons(await preflightLocalNoteForCloudCopy('local-note-1', addedDuringCheck.deps)))
      .toContain('ATTACHMENT_ORIGINALS_PRESENT');
  });

  it('fails closed when local durable readback is missing, malformed, failed, or mismatched', async () => {
    const unavailable = harness();
    unavailable.persistedStatus = 'UNAVAILABLE';
    expect(reasons(await preflightLocalNoteForCloudCopy('local-note-1', unavailable.deps)))
      .toContain('LOCAL_PERSISTENCE_UNVERIFIED');

    const mismatched = harness();
    mismatched.persistedNotes = [{ ...mismatched.source, body: 'newer durable body' }];
    expect(reasons(await preflightLocalNoteForCloudCopy('local-note-1', mismatched.deps)))
      .toContain('LOCAL_PERSISTENCE_UNVERIFIED');

    const duplicateDurableId = harness();
    duplicateDurableId.persistedNotes = [duplicateDurableId.source, { ...duplicateDurableId.source }];
    expect(reasons(await preflightLocalNoteForCloudCopy('local-note-1', duplicateDurableId.deps)))
      .toContain('LOCAL_PERSISTENCE_UNVERIFIED');

    const failed = harness();
    failed.persistedRead.mockRejectedValue(new Error('local read failed'));
    expect(reasons(await preflightLocalNoteForCloudCopy('local-note-1', failed.deps)))
      .toContain('LOCAL_PERSISTENCE_UNVERIFIED');
  });

  it('invalidates a pending result across A/B/A, note edits, and hydration replacement', async () => {
    let releaseMetadata!: (value: { readonly status: 'COMPLETE'; readonly matchingRecords: number }) => void;
    const gate = new Promise<{ readonly status: 'COMPLETE'; readonly matchingRecords: number }>(resolve => { releaseMetadata = resolve; });
    const h = harness();
    h.metadataRead.mockReturnValueOnce(gate);
    const pending = preflightLocalNoteForCloudCopy('local-note-1', h.deps);
    await vi.waitFor(() => expect(h.metadataRead).toHaveBeenCalledOnce());
    h.request = Object.freeze({ accountId: 'account-b', generation: 2 });
    h.accountId = 'account-b';
    h.state = { ...h.deps.getStoreState(), activeAccountId: 'account-b', notes: [] };
    h.request = Object.freeze({ accountId: 'account-a', generation: 3 });
    h.accountId = 'account-a';
    h.state = { ...h.deps.getStoreState(), activeAccountId: 'account-a', notes: [h.source] };
    releaseMetadata({ status: 'COMPLETE', matchingRecords: 0 });
    expect(reasons(await pending)).toContain('SOURCE_CHANGED');

    const edited = harness();
    let releaseEdit!: (value: { readonly status: 'COMPLETE'; readonly matchingRecords: number }) => void;
    edited.metadataRead.mockReturnValueOnce(new Promise(resolve => { releaseEdit = resolve; }));
    const pendingEdit = preflightLocalNoteForCloudCopy('local-note-1', edited.deps);
    await vi.waitFor(() => expect(edited.metadataRead).toHaveBeenCalledOnce());
    edited.source.body = 'edited while the preflight was pending';
    releaseEdit({ status: 'COMPLETE', matchingRecords: 0 });
    expect(reasons(await pendingEdit)).toContain('SOURCE_CHANGED');

    const replaced = harness();
    let releaseReplacement!: (value: { readonly status: 'COMPLETE'; readonly matchingRecords: number }) => void;
    replaced.metadataRead.mockReturnValueOnce(new Promise(resolve => { releaseReplacement = resolve; }));
    const pendingReplacement = preflightLocalNoteForCloudCopy('local-note-1', replaced.deps);
    await vi.waitFor(() => expect(replaced.metadataRead).toHaveBeenCalledOnce());
    replaced.notes = [{ ...replaced.source }];
    releaseReplacement({ status: 'COMPLETE', matchingRecords: 0 });
    expect(reasons(await pendingReplacement)).toContain('SOURCE_CHANGED');

    const versionChanged = harness();
    let releaseVersion!: (value: { readonly status: 'COMPLETE'; readonly matchingRecords: number }) => void;
    versionChanged.metadataRead.mockReturnValueOnce(new Promise(resolve => { releaseVersion = resolve; }));
    const pendingVersion = preflightLocalNoteForCloudCopy('local-note-1', versionChanged.deps);
    await vi.waitFor(() => expect(versionChanged.metadataRead).toHaveBeenCalledOnce());
    versionChanged.state = { ...versionChanged.deps.getStoreState(), indexContentVersion: 10 };
    releaseVersion({ status: 'COMPLETE', matchingRecords: 0 });
    expect(reasons(await pendingVersion)).toContain('SOURCE_CHANGED');
  });

  it('revalidates attachment metadata and durable Note state after producing the preview', async () => {
    const h = harness();
    const result = await preflightLocalNoteForCloudCopy('local-note-1', h.deps);
    expect(result.status).toBe('ELIGIBLE_PREVIEW_ONLY');
    if (result.status !== 'ELIGIBLE_PREVIEW_ONLY') return;

    h.metadata = { status: 'COMPLETE', matchingRecords: 1 };
    expect(await result.isCurrent()).toBe(false);
    h.metadata = { status: 'COMPLETE', matchingRecords: 0 };
    h.persistedNotes = [{ ...h.source, title: 'changed durably elsewhere' }];
    expect(await result.isCurrent()).toBe(false);
  });
});
