import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NoteBase, NoteFolderBase } from '../components/views/noteUtils';
import type { NotesAuthorityRequest } from './notesAccountAuthority';
import { requestInitialLaptopPublication, INITIAL_PUBLICATION_POLICY } from './notesLaptopPublication';
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

function harness(overrides: Partial<NoteBase> = {}, folderOverrides?: readonly NoteFolderBase[]) {
  const requestA: NotesAuthorityRequest = Object.freeze({ accountId: 'account-a', generation: 1 });
  let request: NotesAuthorityRequest | null = requestA;
  let accountId: string | null = 'account-a';
  const source = { ...baseNote(), ...overrides };
  let notes: NoteBase[] = [source];
  let folders: NoteFolderBase[] = folderOverrides ? [...folderOverrides] : source.folderId === null ? [] : [
    { id: source.folderId, name: 'Original local folder', createdAt: 5 },
  ];
  let state = {
    notes,
    folders,
    activeAccountId: 'account-a',
    notesAuthorityState: 'LOADED_POPULATED',
    foldersAuthorityState: folders.length > 0 ? 'LOADED_POPULATED' : 'LOADED_EMPTY',
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
    get folders() { return folders; },
    get request() { return request; },
    get metadata() { return metadata; },
    set metadata(value) { metadata = value; },
    set persistedNotes(value) { persistedNotes = value; },
    set persistedStatus(value) { persistedStatus = value; },
    set persistedReason(value) { persistedReason = value; },
    set notes(value) { notes = value; state = { ...state, notes }; },
    set folders(value) {
      folders = value;
      state = { ...state, folders, foldersAuthorityState: folders.length > 0 ? 'LOADED_POPULATED' : 'LOADED_EMPTY' };
    },
    set request(value) { request = value; },
    set accountId(value) { accountId = value; },
    set state(value) { state = value; notes = value.notes; folders = value.folders; },
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
    expect(await result.checkCurrent()).toBeNull();
    expect(h.source).toEqual(before);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(h.metadataRead).toHaveBeenCalledTimes(4);
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

  it('omits a verified local folder only with explicit folder disposition and preserves the Note and folder', async () => {
    const folder = { id: 'folder-1', name: 'Original local folder', createdAt: 5 };
    const h = harness({ folderId: folder.id }, [folder]);
    const noteBefore = structuredClone(h.source);
    const foldersBefore = structuredClone(h.folders);

    expect(reasons(await preflightLocalNoteForCloudCopy('local-note-1', h.deps))).toContain('FOLDER_UNSUPPORTED');
    const result = await preflightLocalNoteForCloudCopy('local-note-1', h.deps, {
      folderDisposition: 'omit-from-cloud-text',
    });

    expect(result.status).toBe('ELIGIBLE_PREVIEW_ONLY');
    if (result.status !== 'ELIGIBLE_PREVIEW_ONLY') return;
    expect(result.localNoteId).toBe(noteBefore.id);
    expect(result.folderExcludedFromSnapshot).toBe(true);
    expect(result.snapshot).toEqual({
      title: noteBefore.title, body: noteBefore.body, updated_at: noteBefore.updatedAt, starred: noteBefore.starred,
    });
    expect(result.snapshot).not.toHaveProperty('folderId');
    expect(h.source).toEqual(noteBefore);
    expect(h.folders).toEqual(foldersBefore);
    expect(await result.checkCurrent()).toBeNull();

    folder.name = 'Changed while prepared';
    expect(await result.checkCurrent()).toBe('SOURCE_CHANGED');
    expect(h.source.folderId).toBe(noteBefore.folderId);
  });

  it('fails closed for omitted folders that are missing, duplicated, or not under loaded folder authority', async () => {
    const option = { folderDisposition: 'omit-from-cloud-text' } as const;
    const missing = harness({ folderId: 'folder-1' }, []);
    expect(reasons(await preflightLocalNoteForCloudCopy('local-note-1', missing.deps, option)))
      .toContain('FOLDER_UNSUPPORTED');

    const duplicate = harness({ folderId: 'folder-1' }, [
      { id: 'folder-1', name: 'First', createdAt: 1 },
      { id: 'folder-1', name: 'Second', createdAt: 2 },
    ]);
    expect(reasons(await preflightLocalNoteForCloudCopy('local-note-1', duplicate.deps, option)))
      .toContain('FOLDER_UNSUPPORTED');

    const unavailable = harness({ folderId: 'folder-1' });
    unavailable.state = { ...unavailable.deps.getStoreState(), foldersAuthorityState: 'UNAVAILABLE' };
    expect(reasons(await preflightLocalNoteForCloudCopy('local-note-1', unavailable.deps, option)))
      .toContain('NOTES_AUTHORITY_UNAVAILABLE');
  });

  it('allows only explicitly opted-in empty properties and preserves the entire original', async () => {
    const folder = { id: 'folder-1', name: 'Original folder', createdAt: 1 };
    const h = harness({ folderId: folder.id, properties: {} }, [folder]);
    const before = structuredClone(h.source);
    const options = { folderDisposition: 'omit-from-cloud-text', omitEmptyProperties: true } as const;
    const result = await preflightLocalNoteForCloudCopy(h.source.id, h.deps, options);
    expect(result.status).toBe('ELIGIBLE_PREVIEW_ONLY');
    if (result.status !== 'ELIGIBLE_PREVIEW_ONLY') return;
    expect(result.snapshot).toEqual({ title: before.title, body: before.body, updated_at: before.updatedAt, starred: false });
    expect(h.source).toEqual(before);
    expect(h.source.properties).toBeDefined();
    expect(await result.checkCurrent()).toBeNull(); // cloned durable {} must match by shape
    h.source.properties!.newKey = '';
    expect(result.isCurrentInMemory()).toBe(false);
    expect(await result.checkCurrent()).toBe('SOURCE_CHANGED');
  });

  it('keeps default Cloud Copy strict, and rejects nonempty or malformed properties under the opt-in', async () => {
    const empty = harness({ properties: {} });
    expect(reasons(await preflightLocalNoteForCloudCopy(empty.source.id, empty.deps))).toContain('PROPERTIES_UNSUPPORTED');
    for (const properties of [{ tags: 'private' }, { tags: '' }, null, [], '', Object.create({ inherited: 'value' }),
      Object.defineProperty({}, 'hidden', { value: '' }), { [Symbol('hidden')]: '' }]) {
      const h = harness();
      Object.assign(h.source, { properties });
      const result = await preflightLocalNoteForCloudCopy(h.source.id, h.deps, { omitEmptyProperties: true });
      expect(result.status).toBe('INELIGIBLE');
      expect(reasons(result).some(reason => reason === 'PROPERTIES_UNSUPPORTED' || reason === 'NOTE_INCOMPLETE')).toBe(true);
    }
  });

  it('serializes only unchanged text and original identity after the real opt-in preflight', async () => {
    const h = harness({ folderId: 'folder-1', properties: {} });
    const before = structuredClone(h.source);
    const preview = await preflightLocalNoteForCloudCopy(h.source.id, h.deps, {
      folderDisposition: 'omit-from-cloud-text', omitEmptyProperties: true,
    });
    expect(preview.status).toBe('ELIGIBLE_PREVIEW_ONLY');
    if (preview.status !== 'ELIGIBLE_PREVIEW_ONLY') return;
    const fetch = vi.fn(async () => new Response(JSON.stringify({
      status: 'VERIFIED', noteId: h.source.id, policy: INITIAL_PUBLICATION_POLICY,
    })));
    const payload = { noteId: h.source.id, approvalOperationId: INITIAL_PUBLICATION_POLICY, snapshot: preview.snapshot };
    const deps = {
      featureEnabled: () => true, isTransportAvailable: () => true, getRuntimeAccountId: () => 'account-a',
      getSession: vi.fn(async () => ({ data: { session: { access_token: 'synthetic', user: { id: 'account-a' } } }, error: null })) as any,
      getKnownDeletedIds: () => [], fetch, apiUrl: 'https://example.test',
    };
    expect(await requestInitialLaptopPublication('publish', payload, 'account-a', preview, () => true, () => true, deps)).toBe('VERIFIED');
    expect(fetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse((vi.mocked(fetch).mock.calls as any)[0][1].body);
    expect(body).toEqual({
      noteId: before.id, policy: INITIAL_PUBLICATION_POLICY, knownDeletedIds: [],
      snapshot: { title: before.title, body: before.body, updated_at: before.updatedAt, starred: before.starred },
    });
    expect(h.source).toEqual(before);
    h.source.properties!.entry = 'new authored property';
    fetch.mockClear();
    expect(await requestInitialLaptopPublication('publish', payload, 'account-a', preview, () => true, () => true, deps)).toBe('SOURCE_CHANGED');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects durable property or folder differences rather than comparing only the text snapshot', async () => {
    const options = { folderDisposition: 'omit-from-cloud-text', omitEmptyProperties: true } as const;
    for (const change of [{ properties: { entry: '' } }, { properties: undefined }, { folderId: null }]) {
      const h = harness({ folderId: 'folder-1', properties: {} });
      h.persistedNotes = [{ ...h.source, ...change }];
      expect(reasons(await preflightLocalNoteForCloudCopy(h.source.id, h.deps, options)))
        .toContain('LOCAL_PERSISTENCE_UNVERIFIED');
    }
    const h = harness({ properties: {} });
    const result = await preflightLocalNoteForCloudCopy(h.source.id, h.deps, options);
    expect(result.status).toBe('ELIGIBLE_PREVIEW_ONLY');
    if (result.status !== 'ELIGIBLE_PREVIEW_ONLY') return;
    h.persistedNotes = [{ ...h.source, properties: { value: '' } }];
    expect(await result.checkCurrent()).toBe('LOCAL_PERSISTENCE_UNVERIFIED');
  });

  it('retains attachment, relation, deleted, and stale-account denials for the text-only opt-in', async () => {
    const options = { folderDisposition: 'omit-from-cloud-text', omitEmptyProperties: true } as const;
    for (const [overrides, reason] of [
      [{ relations: {} }, 'RELATIONS_UNSUPPORTED'], [{ deletedAt: 30 }, 'NOTE_NOT_ACTIVE'],
      [{ body: 'attachment://asset' }, 'ATTACHMENT_CONTENT_UNSUPPORTED'],
    ] as const) {
      const h = harness({ properties: {}, ...overrides });
      expect(reasons(await preflightLocalNoteForCloudCopy(h.source.id, h.deps, options))).toContain(reason);
    }
    const h = harness({ properties: {} });
    h.metadata = { status: 'INCOMPLETE' };
    expect(reasons(await preflightLocalNoteForCloudCopy(h.source.id, h.deps, options))).toContain('ATTACHMENT_METADATA_INCOMPLETE');
    h.metadata = { status: 'COMPLETE', matchingRecords: 1 };
    expect(reasons(await preflightLocalNoteForCloudCopy(h.source.id, h.deps, options))).toContain('ATTACHMENT_ORIGINALS_PRESENT');
    h.metadata = { status: 'COMPLETE', matchingRecords: 0 };
    const result = await preflightLocalNoteForCloudCopy(h.source.id, h.deps, options);
    expect(result.status).toBe('ELIGIBLE_PREVIEW_ONLY');
    if (result.status !== 'ELIGIBLE_PREVIEW_ONLY') return;
    h.request = { accountId: 'account-b', generation: 2 };
    h.request = { accountId: 'account-a', generation: 3 };
    expect(await result.checkCurrent()).toBe('SOURCE_CHANGED');
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
    expect(await result.checkCurrent()).toBe('ATTACHMENT_ORIGINALS_PRESENT');
    h.metadata = { status: 'COMPLETE', matchingRecords: 0 };
    h.persistedNotes = [{ ...h.source, title: 'changed durably elsewhere' }];
    expect(await result.isCurrent()).toBe(false);
    expect(await result.checkCurrent()).toBe('LOCAL_PERSISTENCE_UNVERIFIED');
  });

  it('distinguishes changed in-memory authority from unreadable durable state during revalidation', async () => {
    const changed = harness();
    const changedResult = await preflightLocalNoteForCloudCopy('local-note-1', changed.deps);
    expect(changedResult.status).toBe('ELIGIBLE_PREVIEW_ONLY');
    if (changedResult.status !== 'ELIGIBLE_PREVIEW_ONLY') return;
    changed.request = Object.freeze({ accountId: 'account-b', generation: 2 });
    changed.accountId = 'account-b';
    expect(await changedResult.checkCurrent()).toBe('SOURCE_CHANGED');

    const unavailable = harness();
    const unavailableResult = await preflightLocalNoteForCloudCopy('local-note-1', unavailable.deps);
    expect(unavailableResult.status).toBe('ELIGIBLE_PREVIEW_ONLY');
    if (unavailableResult.status !== 'ELIGIBLE_PREVIEW_ONLY') return;
    unavailable.persistedStatus = 'UNAVAILABLE';
    expect(await unavailableResult.checkCurrent()).toBe('LOCAL_PERSISTENCE_UNVERIFIED');
  });

  it('reports attachment metadata and durable readback failures independently', async () => {
    const metadataFailure = harness();
    const metadataResult = await preflightLocalNoteForCloudCopy('local-note-1', metadataFailure.deps);
    expect(metadataResult.status).toBe('ELIGIBLE_PREVIEW_ONLY');
    if (metadataResult.status !== 'ELIGIBLE_PREVIEW_ONLY') return;
    metadataFailure.metadataRead.mockRejectedValueOnce(new Error('metadata read failed'));
    expect(await metadataResult.checkCurrent()).toBe('ATTACHMENT_METADATA_INCOMPLETE');

    const readbackFailure = harness();
    const readbackResult = await preflightLocalNoteForCloudCopy('local-note-1', readbackFailure.deps);
    expect(readbackResult.status).toBe('ELIGIBLE_PREVIEW_ONLY');
    if (readbackResult.status !== 'ELIGIBLE_PREVIEW_ONLY') return;
    readbackFailure.persistedRead.mockRejectedValueOnce(new Error('durable readback failed'));
    expect(await readbackResult.checkCurrent()).toBe('LOCAL_PERSISTENCE_UNVERIFIED');
  });
});
