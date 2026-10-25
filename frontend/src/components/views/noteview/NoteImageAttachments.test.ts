// @vitest-environment happy-dom
import { act } from 'react';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NoteBase as Note } from '../noteUtils';
import type { AccountScopedAttachmentMetadata, ScopedAttachmentTombstoneResult } from '../../../lib/attachmentRepository';

const authority = vi.hoisted(() => ({
  request: null as { accountId: string; generation: number } | null,
  state: { notes: [] as Note[] },
  listeners: new Set<() => void>(),
}));

vi.mock('../../../store/useNotesStore', async () => {
  const { useSyncExternalStore } = await import('react');
  return {
    useNotesStore: Object.assign(() => useSyncExternalStore(callback => {
      authority.listeners.add(callback); return () => { authority.listeners.delete(callback); };
    }, () => authority.state), { getState: () => authority.state }),
    observePublishedNotesHydration: () => authority.request
      ? { status: 'CURRENT', request: authority.request } : { status: 'UNAVAILABLE', reason: 'PENDING_REPLACEMENT_HYDRATION' },
  };
});

const mockedMetadataRepository = vi.hoisted(() => ({
  listAttachmentsForNote: vi.fn(async () => [{
    id: 'att-1', noteId: 'note-1', fileName: 'scan.png', mimeType: 'image/png', size: 5,
    localBlobKey: 'local-image/att-1', source: 'local' as const,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
  }]),
  putAttachment: vi.fn(async () => undefined),
  tombstoneAttachment: vi.fn(async () => undefined),
  listAttachmentsForAccountNote: vi.fn<(_account: string, _note: string) => Promise<AccountScopedAttachmentMetadata[]>>(),
  tombstoneAttachmentForAccountNote: vi.fn<(_input: unknown) => Promise<ScopedAttachmentTombstoneResult>>(),
}));

const mockedAttachLocalImageToNote = vi.hoisted(() => vi.fn(async () => ({
  metadata: { id: 'created-attachment' },
  body: 'attachment://created-attachment',
})));

const mockedBlobAdapter = vi.hoisted(() => ({
  putBlob: vi.fn(async () => undefined),
  getObjectUrl: vi.fn(async () => 'blob:existing-attachment'),
  revokeObjectUrl: vi.fn(),
}));

vi.mock('../../../lib/attachmentMetadataIndexedDb', () => ({
  createLocalAttachmentMetadataRepository: () => mockedMetadataRepository,
}));

vi.mock('../../../lib/attachmentBlobIndexedDb', () => ({
  createLocalAttachmentBlobAdapter: () => mockedBlobAdapter,
}));

vi.mock('../../../lib/localImageAttachments', async importOriginal => ({
  ...await importOriginal<typeof import('../../../lib/localImageAttachments')>(),
  attachLocalImageToNote: mockedAttachLocalImageToNote,
}));

import { NoteImageAttachments } from './NoteImageAttachments';

const colors = {
  sideBdr: '#ddd', card: '#fff', editor: '#fff', input: '#fff', inputBdr: '#ddd',
  text: '#111', textMuted: '#555', textFaint: '#888', danger: '#dc2626',
} as never;

const note: Note = {
  id: 'note-1', title: 'Note', body: 'attachment://att-1', updatedAt: 1, folderId: null, deletedAt: null,
};

const mounted = new Map<Root, HTMLElement>();
function render(element: ReturnType<typeof createElement>) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => root.render(element));
  mounted.set(root, host);
  return { host, root };
}

function cleanup(root: Root, host: HTMLElement) {
  act(() => root.unmount());
  host.remove();
  mounted.delete(root);
}

async function flushAsync() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function scopedMetadata(accountId = 'A', id = 'att-1'): AccountScopedAttachmentMetadata {
  return { id, accountId, noteId: note.id, fileName: `${id}.png`, mimeType: 'image/png', size: 5,
    localBlobKey: `local-image/${accountId}/${id}`, source: 'local',
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', deletedAt: null };
}
function transition(accountId: string | null, notes: Note[], generation = 1) {
  act(() => {
    authority.request = accountId ? Object.freeze({ accountId, generation }) : null;
    authority.state = { notes };
    for (const listener of authority.listeners) listener();
  });
}
function deferred<T>() {
  let resolve!: (value: T) => void; let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function renderAttachments(displayedNote = note) {
  return render(createElement(NoteImageAttachments, { note: displayedNote, colors, readOnly: false, onUpdateBody: vi.fn() }));
}
function removeButton(host: HTMLElement) {
  const button = host.querySelector('button[title="Remove image"]');
  if (!(button instanceof HTMLButtonElement)) throw new Error('scoped removal button missing');
  return button;
}

beforeEach(() => {
  vi.clearAllMocks();
  authority.request = Object.freeze({ accountId: 'A', generation: 1 });
  authority.state = { notes: [note] };
  mockedMetadataRepository.listAttachmentsForAccountNote.mockReset().mockResolvedValue([scopedMetadata()]);
  mockedMetadataRepository.tombstoneAttachmentForAccountNote.mockReset().mockResolvedValue({ status: 'TOMBSTONED' });
  mockedBlobAdapter.getObjectUrl.mockReset().mockResolvedValue('blob:existing-attachment');
});

afterEach(() => {
  for (const [root, host] of mounted) cleanup(root, host);
  vi.unstubAllEnvs();
  mockedMetadataRepository.listAttachmentsForNote.mockClear();
  mockedMetadataRepository.putAttachment.mockClear();
  mockedMetadataRepository.tombstoneAttachment.mockClear();
  mockedAttachLocalImageToNote.mockClear();
  mockedBlobAdapter.putBlob.mockClear();
});
describe('NoteImageAttachments Return-to-Use attachment isolation', () => {
  it('keeps an existing preview readable while picker and removal remain unavailable', async () => {
    vi.stubEnv('VITE_ABSINTHE_RETURN_TO_USE_ATTACHMENT_ISOLATION', 'true');
    const onUpdateBody = vi.fn();
    const { host, root } = render(createElement(NoteImageAttachments, {
      note, colors, readOnly: false, onUpdateBody,
    }));
    await flushAsync();

    const preview = host.querySelector('img[src="blob:existing-attachment"]');
    expect(preview).not.toBeNull();
    const attachButton = Array.from(host.querySelectorAll('button')).find(button => button.textContent?.includes('Attachments disabled'));
    expect(attachButton).toBeInstanceOf(HTMLButtonElement);
    expect((attachButton as HTMLButtonElement).disabled).toBe(true);
    const removeButton = host.querySelector('button[title*="Attachments are temporarily disabled"]');
    expect(removeButton).toBeInstanceOf(HTMLButtonElement);
    expect((removeButton as HTMLButtonElement).disabled).toBe(true);

    act(() => (removeButton as HTMLButtonElement).click());
    expect(mockedMetadataRepository.tombstoneAttachment).not.toHaveBeenCalled();
    expect(onUpdateBody).not.toHaveBeenCalled();
    cleanup(root, host);
  });

  it('blocks the actual hidden picker change path while isolation is active', async () => {
    vi.stubEnv('VITE_ABSINTHE_RETURN_TO_USE_ATTACHMENT_ISOLATION', 'true');
    const onUpdateBody = vi.fn();
    const { host, root } = render(createElement(NoteImageAttachments, {
      note, colors, readOnly: false, onUpdateBody,
    }));
    await flushAsync();

    const input = host.querySelector('input[type="file"]');
    if (!(input instanceof HTMLInputElement)) throw new Error('attachment picker input missing');
    const file = new File(['image'], 'picked.png', { type: 'image/png' });
    act(() => {
      Object.defineProperty(input, 'files', { configurable: true, value: [file] });
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await flushAsync();

    expect(mockedAttachLocalImageToNote).not.toHaveBeenCalled();
    expect(mockedBlobAdapter.putBlob).not.toHaveBeenCalled();
    expect(mockedMetadataRepository.putAttachment).not.toHaveBeenCalled();
    expect(mockedMetadataRepository.tombstoneAttachment).not.toHaveBeenCalled();
    expect(onUpdateBody).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Attachments are temporarily disabled');
    cleanup(root, host);
  });
});

describe('NoteImageAttachments scoped publication lifetime', () => {
  it('U01 requires CURRENT published hydration before metadata or Blob access', async () => {
    transition(null, [note]);
    const { host } = renderAttachments(); await flushAsync();
    expect(host.querySelector('section')).toBeNull();
    expect(mockedMetadataRepository.listAttachmentsForAccountNote).not.toHaveBeenCalled();
    expect(mockedBlobAdapter.getObjectUrl).not.toHaveBeenCalled();
  });

  it('U02 rejects a foreign displayed Note object even if its noteId and contents match', async () => {
    const { host } = renderAttachments({ ...note }); await flushAsync();
    expect(host.querySelector('section')).toBeNull();
    expect(mockedMetadataRepository.listAttachmentsForAccountNote).not.toHaveBeenCalled();
  });

  it('U03 only requests the exact account/Note scope and hides cross-account or accountless metadata', async () => {
    mockedMetadataRepository.listAttachmentsForAccountNote.mockResolvedValue([
      scopedMetadata(), scopedMetadata('B', 'foreign'),
      { ...scopedMetadata('A', 'legacy'), accountId: undefined } as unknown as AccountScopedAttachmentMetadata,
      { ...scopedMetadata('A', 'other-note'), noteId: 'other' },
    ]);
    const { host } = renderAttachments(); await flushAsync();
    expect(mockedMetadataRepository.listAttachmentsForAccountNote).toHaveBeenCalledExactlyOnceWith('A', note.id);
    expect(mockedMetadataRepository.listAttachmentsForNote).not.toHaveBeenCalled();
    expect(mockedBlobAdapter.getObjectUrl).toHaveBeenCalledExactlyOnceWith('local-image/A/att-1');
    expect(host.querySelectorAll('img')).toHaveLength(1);
    expect(host.textContent).not.toContain('foreign.png');
  });

  it.each(['local-attachment/recovered-att-1', 'local-image/B/att-1', 'legacy-blob'])('U04 preserves but never previews unproved key %s', async key => {
    const record = { ...scopedMetadata(), localBlobKey: key };
    mockedMetadataRepository.listAttachmentsForAccountNote.mockResolvedValue([record]);
    const { host } = renderAttachments(); await flushAsync();
    expect(mockedBlobAdapter.getObjectUrl).not.toHaveBeenCalled();
    expect(host.querySelector('img')).toBeNull();
    expect(record.localBlobKey).toBe(key);
    expect(mockedMetadataRepository.tombstoneAttachmentForAccountNote).not.toHaveBeenCalled();
  });

  it('U05 discards stale metadata without starting Blob access', async () => {
    const wait = deferred<AccountScopedAttachmentMetadata[]>();
    mockedMetadataRepository.listAttachmentsForAccountNote.mockReturnValueOnce(wait.promise);
    const { host } = renderAttachments(); await flushAsync();
    transition(null, [note]);
    await act(async () => { wait.resolve([scopedMetadata()]); await wait.promise; });
    expect(mockedBlobAdapter.getObjectUrl).not.toHaveBeenCalled();
    expect(host.querySelector('img')).toBeNull();
  });

  it('U06 revokes a late Blob URL after account invalidation without displaying it', async () => {
    const wait = deferred<string>(); mockedBlobAdapter.getObjectUrl.mockReturnValueOnce(wait.promise);
    const { host } = renderAttachments(); await flushAsync();
    expect(mockedBlobAdapter.getObjectUrl).toHaveBeenCalledTimes(1);
    transition('B', [{ ...note }], 2);
    await act(async () => { wait.resolve('blob:late-A'); await wait.promise; });
    expect(mockedBlobAdapter.revokeObjectUrl).toHaveBeenCalledWith('blob:late-A');
    expect(host.querySelector('img')).toBeNull();
  });

  it('U07 revokes every URL returned after unmount', async () => {
    const wait = deferred<string>(); mockedBlobAdapter.getObjectUrl.mockReturnValueOnce(wait.promise);
    const { root, host } = renderAttachments(); await flushAsync(); cleanup(root, host);
    await act(async () => { wait.resolve('blob:after-unmount'); await wait.promise; });
    expect(mockedBlobAdapter.revokeObjectUrl).toHaveBeenCalledExactlyOnceWith('blob:after-unmount');
  });

  it('U08 revokes loaded previews when the displayed owner is retired', async () => {
    const { host } = renderAttachments(); await flushAsync();
    expect(host.querySelector('img')).not.toBeNull();
    transition(null, [note]);
    expect(host.querySelector('img')).toBeNull();
    expect(mockedBlobAdapter.revokeObjectUrl).toHaveBeenCalledWith('blob:existing-attachment');
  });

  it('U09 suppresses an old metadata error after authority replacement', async () => {
    const wait = deferred<AccountScopedAttachmentMetadata[]>();
    mockedMetadataRepository.listAttachmentsForAccountNote.mockReturnValueOnce(wait.promise);
    const { host } = renderAttachments(); await flushAsync(); transition(null, [note]);
    await act(async () => { wait.reject(new Error('old-account-error')); await wait.promise.catch(() => undefined); });
    expect(host.textContent).not.toContain('could not be loaded');
    expect(host.textContent).not.toContain('old-account-error');
  });

  it('U10 removes a same-account record through only the atomic scoped API and reloads on confirmed commit', async () => {
    vi.stubEnv('VITE_ABSINTHE_RETURN_TO_USE_ATTACHMENT_ISOLATION', 'false');
    const record = scopedMetadata();
    mockedMetadataRepository.listAttachmentsForAccountNote.mockResolvedValueOnce([record]).mockResolvedValue([]);
    const { host } = renderAttachments(); await flushAsync();
    await act(async () => { removeButton(host).click(); }); await flushAsync();
    expect(mockedMetadataRepository.tombstoneAttachmentForAccountNote).toHaveBeenCalledTimes(1);
    expect(mockedMetadataRepository.tombstoneAttachmentForAccountNote.mock.calls[0][0]).toMatchObject({
      accountId: 'A', noteId: note.id, expected: record,
    });
    expect(mockedMetadataRepository.tombstoneAttachment).not.toHaveBeenCalled();
    expect(mockedMetadataRepository.listAttachmentsForAccountNote).toHaveBeenCalledTimes(2);
    expect(host.querySelector('img')).toBeNull();
    expect(mockedBlobAdapter.revokeObjectUrl).toHaveBeenCalledWith('blob:existing-attachment');
  });

  it.each(['TOMBSTONED', 'INDETERMINATE', 'REJECTION'] as const)('U11 A1 -> B -> A2 suppresses the old action result %s and its reload', async outcome => {
    vi.stubEnv('VITE_ABSINTHE_RETURN_TO_USE_ATTACHMENT_ISOLATION', 'false');
    const wait = deferred<ScopedAttachmentTombstoneResult>();
    mockedMetadataRepository.tombstoneAttachmentForAccountNote.mockReturnValueOnce(wait.promise);
    const { host } = renderAttachments(); await flushAsync(); act(() => removeButton(host).click());
    const sent = mockedMetadataRepository.tombstoneAttachmentForAccountNote.mock.calls[0][0] as { isCurrent: () => boolean };
    expect(sent.isCurrent()).toBe(true);
    transition('B', [note], 2); expect(sent.isCurrent()).toBe(false);
    transition('A', [note], 3); await flushAsync(); expect(sent.isCurrent()).toBe(false);
    const reads = mockedMetadataRepository.listAttachmentsForAccountNote.mock.calls.length;
    await act(async () => {
      if (outcome === 'REJECTION') wait.reject(new Error('old-removal-error'));
      else wait.resolve({ status: outcome });
      await wait.promise.catch(() => undefined);
    }); await flushAsync();
    expect(mockedMetadataRepository.listAttachmentsForAccountNote).toHaveBeenCalledTimes(reads);
    expect(host.textContent).not.toContain('not completed');
    expect(host.textContent).not.toContain('outcome is uncertain');
  });

  it('U12 treats an indeterminate write as uncertain, without reload or automatic retry', async () => {
    vi.stubEnv('VITE_ABSINTHE_RETURN_TO_USE_ATTACHMENT_ISOLATION', 'false');
    mockedMetadataRepository.tombstoneAttachmentForAccountNote.mockResolvedValue({ status: 'INDETERMINATE' });
    const { host } = renderAttachments(); await flushAsync();
    await act(async () => { removeButton(host).click(); }); await flushAsync();
    expect(host.textContent).toContain('outcome is uncertain');
    expect(removeButton(host).disabled).toBe(true); act(() => removeButton(host).click());
    expect(mockedMetadataRepository.tombstoneAttachmentForAccountNote).toHaveBeenCalledTimes(1);
    expect(mockedMetadataRepository.listAttachmentsForAccountNote).toHaveBeenCalledTimes(1);
  });

  it('U13 serializes double clicks before the first write settles', async () => {
    vi.stubEnv('VITE_ABSINTHE_RETURN_TO_USE_ATTACHMENT_ISOLATION', 'false');
    const wait = deferred<ScopedAttachmentTombstoneResult>();
    mockedMetadataRepository.tombstoneAttachmentForAccountNote.mockReturnValueOnce(wait.promise);
    const { host } = renderAttachments(); await flushAsync(); const button = removeButton(host);
    act(() => { button.click(); button.click(); });
    expect(mockedMetadataRepository.tombstoneAttachmentForAccountNote).toHaveBeenCalledTimes(1);
    await act(async () => { wait.resolve({ status: 'ABORTED' }); await wait.promise; });
    expect(host.textContent).toContain('not completed');
  });

  it('U14 keeps the unproven upload path closed even when isolation is explicitly off', async () => {
    vi.stubEnv('VITE_ABSINTHE_RETURN_TO_USE_ATTACHMENT_ISOLATION', 'false');
    const { host } = renderAttachments(); await flushAsync();
    const input = host.querySelector('input')!;
    act(() => {
      Object.defineProperty(input, 'files', { configurable: true, value: [new File(['x'], 'x.png', { type: 'image/png' })] });
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }); await flushAsync();
    expect(host.textContent).toContain('account-scoped write safety');
    expect(mockedAttachLocalImageToNote).not.toHaveBeenCalled();
    expect(mockedBlobAdapter.putBlob).not.toHaveBeenCalled();
    expect(mockedMetadataRepository.putAttachment).not.toHaveBeenCalled();
  });

  it('U15 revokes both existing and late URLs when a parallel preview load fails', async () => {
    mockedMetadataRepository.listAttachmentsForAccountNote.mockResolvedValue([
      scopedMetadata(), scopedMetadata('A', 'fails'), scopedMetadata('A', 'late'),
    ]);
    const failure = deferred<string>(); const late = deferred<string>();
    mockedBlobAdapter.getObjectUrl.mockResolvedValueOnce('blob:partial')
      .mockReturnValueOnce(failure.promise).mockReturnValueOnce(late.promise);
    const { host } = renderAttachments(); await flushAsync();
    await act(async () => { failure.reject(new Error('blob failure')); await failure.promise.catch(() => undefined); });
    await flushAsync();
    expect(host.textContent).toContain('could not be loaded');
    expect(host.querySelector('img')).toBeNull();
    expect(mockedBlobAdapter.revokeObjectUrl).toHaveBeenCalledWith('blob:partial');
    await act(async () => { late.resolve('blob:late-after-failure'); await late.promise; });
    expect(mockedBlobAdapter.revokeObjectUrl).toHaveBeenCalledWith('blob:late-after-failure');
  });

  it('U16 permits a proven same-account read-only preview without mutation controls', async () => {
    const { host } = render(createElement(NoteImageAttachments, { note, colors, readOnly: true, onUpdateBody: vi.fn() }));
    await flushAsync();
    expect(host.querySelector('img')).not.toBeNull();
    expect(host.querySelector('button')).toBeNull();
    expect(mockedMetadataRepository.tombstoneAttachmentForAccountNote).not.toHaveBeenCalled();
  });

  it('U17 rebinds a legitimate immutable Note edit but never borrows its identity for the old prop', async () => {
    const { host, root } = renderAttachments(); await flushAsync();
    const edited = { ...note, body: 'same-account edit' };
    const originalRequest = authority.request;
    act(() => {
      authority.state = { notes: [edited] };
      for (const listener of authority.listeners) listener();
    });
    expect(authority.request).toBe(originalRequest);
    expect(host.querySelector('img')).toBeNull();
    act(() => root.render(createElement(NoteImageAttachments, { note: edited, colors, readOnly: false, onUpdateBody: vi.fn() })));
    await flushAsync();
    expect(host.querySelector('img')).not.toBeNull();
    expect(mockedMetadataRepository.listAttachmentsForAccountNote).toHaveBeenCalledTimes(2);
  });
});
