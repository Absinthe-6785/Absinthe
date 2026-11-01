// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NoteBase as Note } from '../noteUtils';
import type { PublishedLocalDocumentOriginal } from '../../../lib/localDocumentAttachments';

const authority = vi.hoisted(() => ({
  request: null as { accountId: string; generation: number } | null,
  state: { activeAccountId: null as string | null, activeNoteId: null as string | null, notes: [] as Note[] },
  listeners: new Set<() => void>(),
}));

const services = vi.hoisted(() => ({
  list: vi.fn<(...args: any[]) => Promise<any>>(),
  read: vi.fn<(...args: any[]) => Promise<any>>(),
  metadataRepository: { listAttachmentsForAccountNote: vi.fn() },
  blobAdapter: { getBlob: vi.fn(), putBlob: vi.fn(), deleteBlob: vi.fn(), getObjectUrl: vi.fn(), revokeObjectUrl: vi.fn() },
}));

vi.mock('../../../store/useNotesStore', async () => {
  const { useSyncExternalStore } = await import('react');
  return {
    useNotesStore: Object.assign(() => useSyncExternalStore(callback => {
      authority.listeners.add(callback); return () => { authority.listeners.delete(callback); };
    }, () => authority.state), { getState: () => authority.state }),
    observePublishedNotesHydration: () => authority.request
      ? { status: 'CURRENT', request: authority.request } : { status: 'UNAVAILABLE', reason: 'NO_PUBLICATION' },
  };
});
vi.mock('../../../lib/localDocumentAttachments', () => ({
  listPublishedLocalDocumentOriginals: services.list,
  readPublishedLocalDocumentOriginal: services.read,
}));
vi.mock('../../../lib/attachmentMetadataIndexedDb', () => ({
  createLocalAttachmentMetadataRepository: () => services.metadataRepository,
}));
vi.mock('../../../lib/attachmentBlobIndexedDb', () => ({
  createLocalAttachmentBlobAdapter: () => services.blobAdapter,
}));

import { NoteLocalDocumentOriginals } from './NoteLocalDocumentOriginals';
import { useAppStore } from '../../../store/useAppStore';
import { getTranslator } from '../../../lib/i18n';

const colors = { sideBdr: '#ddd', card: '#fff', input: '#fff', inputBdr: '#ddd', text: '#111', textMuted: '#555' } as never;
const note: Note = { id: 'note-A', title: 'A', body: 'attachment://doc-1', updatedAt: 1, folderId: null, deletedAt: null };
const candidate = (request: NonNullable<typeof authority.request>, fileName = 'Quarterly.pdf'): PublishedLocalDocumentOriginal => Object.freeze({
  attachmentId: 'doc-1', fileName, mimeType: 'application/pdf', size: 4, format: 'pdf', metadataSnapshot: 'snapshot', request,
});

const mounted = new Map<Root, HTMLElement>();
function render(displayedNote: Note = note) {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(createElement(NoteLocalDocumentOriginals, { note: displayedNote, colors })));
  mounted.set(root, host);
  return { host, root };
}
function cleanup(root: Root, host: HTMLElement) {
  act(() => root.unmount());
  host.remove(); mounted.delete(root);
}
async function flushAsync() {
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
}
function transition(accountId: string | null, notes: Note[], activeNoteId: string | null, generation = 1) {
  act(() => {
    authority.request = accountId ? Object.freeze({ accountId, generation }) : null;
    authority.state = { activeAccountId: accountId, activeNoteId, notes };
    for (const listener of authority.listeners) listener();
  });
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(yes => { resolve = yes; });
  return { promise, resolve };
}

const originalLanguage = useAppStore.getState().appSettings.language;
let createObjectUrl: ReturnType<typeof vi.fn>;
let revokeObjectUrl: ReturnType<typeof vi.fn>;
let originalCreateDescriptor: PropertyDescriptor | undefined;
let originalRevokeDescriptor: PropertyDescriptor | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  services.list.mockReset();
  services.read.mockReset();
  transition('A', [note], note.id, 1);
  services.list.mockImplementation(async () => ({ status: 'VERIFIED', documents: [candidate(authority.request!)] }));
  services.read.mockResolvedValue({ status: 'VERIFIED', file: new File(['data'], 'Quarterly.pdf', { type: 'application/pdf' }) });
  services.metadataRepository.listAttachmentsForAccountNote.mockResolvedValue([]);
  useAppStore.setState(state => ({ ...state, appSettings: { ...state.appSettings, language: 'en' } }));
  originalCreateDescriptor = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
  originalRevokeDescriptor = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
  createObjectUrl = vi.fn(() => 'blob:verified-original');
  revokeObjectUrl = vi.fn();
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectUrl });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectUrl });
});

afterEach(() => {
  for (const [root, host] of mounted) cleanup(root, host);
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  useAppStore.setState(state => ({ ...state, appSettings: { ...state.appSettings, language: originalLanguage } }));
  if (originalCreateDescriptor) Object.defineProperty(URL, 'createObjectURL', originalCreateDescriptor);
  else Reflect.deleteProperty(URL, 'createObjectURL');
  if (originalRevokeDescriptor) Object.defineProperty(URL, 'revokeObjectURL', originalRevokeDescriptor);
  else Reflect.deleteProperty(URL, 'revokeObjectURL');
});

describe('NoteLocalDocumentOriginals', () => {
  it('lists the current Note documents and hands off one verified original with a safe filename', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.href).toBe('blob:verified-original');
      expect(this.download).toBe('Quarterly.pdf');
    });
    const { host, root } = render();
    await flushAsync();

    expect(host.querySelector('[data-local-document-originals]')?.textContent).toContain('Quarterly.pdf');
    const button = host.querySelector('button[aria-label="Download original Quarterly.pdf"]');
    expect(button).toBeInstanceOf(HTMLButtonElement);
    act(() => (button as HTMLButtonElement).click());
    await flushAsync();

    expect(services.read).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ accountId: 'A', noteId: note.id, candidate: expect.objectContaining({ attachmentId: 'doc-1' }) }));
    expect(createObjectUrl).toHaveBeenCalledExactlyOnceWith(expect.any(File));
    expect(click).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain(getTranslator('en')('noteLocalDocumentDownloadStarted'));
    expect(services.metadataRepository.listAttachmentsForAccountNote).not.toHaveBeenCalled();
    cleanup(root, host);
    expect(revokeObjectUrl).toHaveBeenCalledExactlyOnceWith('blob:verified-original');
  });

  it('uses the localized list-level error when document metadata cannot be loaded', async () => {
    services.list.mockResolvedValue({ status: 'UNAVAILABLE', reason: 'document_metadata_unavailable' });
    const { host, root } = render();
    await flushAsync();
    expect(host.textContent).toContain(getTranslator('en')('noteLocalDocumentsUnavailable'));
    expect(host.textContent).not.toContain(getTranslator('en')('noteLocalDocumentDownloadUnavailable'));
    expect(host.querySelector('button')).toBeNull();
    cleanup(root, host);
  });

  it('uses a portable filename and never reports success when readback is rejected', async () => {
    services.list.mockResolvedValue({ status: 'VERIFIED', documents: [candidate(authority.request!, 'CON.pdf')] });
    services.read.mockResolvedValue({ status: 'UNAVAILABLE', reason: 'document_integrity_mismatch' });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click');
    const { host, root } = render();
    await flushAsync();
    const button = host.querySelector('button');
    act(() => (button as HTMLButtonElement).click());
    await flushAsync();
    expect(click).not.toHaveBeenCalled();
    expect(createObjectUrl).not.toHaveBeenCalled();
    expect(host.textContent).toContain(getTranslator('en')('noteLocalDocumentDownloadUnavailable'));
    cleanup(root, host);
  });

  it('normalizes a platform-reserved download filename without changing the displayed original name', async () => {
    services.list.mockResolvedValue({ status: 'VERIFIED', documents: [candidate(authority.request!, 'CON.pdf')] });
    services.read.mockResolvedValue({ status: 'VERIFIED', file: new File(['data'], 'CON.pdf', { type: 'application/pdf' }) });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe('note-CON.pdf');
    });
    const { host, root } = render();
    await flushAsync();
    expect(host.textContent).toContain('CON.pdf');
    const button = host.querySelector('button');
    act(() => (button as HTMLButtonElement).click());
    await flushAsync();
    expect(click).toHaveBeenCalledTimes(1);
    cleanup(root, host);
  });

  it('does not expose a late list result after the account publication changes A/B/A', async () => {
    const pending = deferred<any>();
    const initialRequest = authority.request!;
    services.list.mockReturnValueOnce(pending.promise).mockResolvedValue({ status: 'VERIFIED', documents: [] });
    const { host, root } = render();
    transition('B', [{ ...note, id: 'note-B' }], 'note-B', 2);
    act(() => root.render(createElement(NoteLocalDocumentOriginals, { note: { ...note, id: 'note-B' }, colors })));
    transition('A', [note], note.id, 3);
    act(() => root.render(createElement(NoteLocalDocumentOriginals, { note, colors })));
    pending.resolve({ status: 'VERIFIED', documents: [candidate(initialRequest, 'foreign.pdf')] });
    await flushAsync();
    expect(host.textContent).not.toContain('foreign.pdf');
    expect(host.querySelector('[data-local-document-originals]')).toBeNull();
    cleanup(root, host);
  });

  it('suppresses a delayed download after switching Notes and does not allocate a browser URL', async () => {
    const pending = deferred<any>();
    services.read.mockReturnValueOnce(pending.promise);
    const { host, root } = render();
    await flushAsync();
    const button = host.querySelector('button');
    act(() => (button as HTMLButtonElement).click());
    const nextNote = { ...note, id: 'note-B', body: 'attachment://other-doc' };
    transition('A', [nextNote], nextNote.id, 1);
    act(() => root.render(createElement(NoteLocalDocumentOriginals, { note: nextNote, colors })));
    pending.resolve({ status: 'VERIFIED', file: new File(['secret'], 'Quarterly.pdf', { type: 'application/pdf' }) });
    await flushAsync();
    expect(createObjectUrl).not.toHaveBeenCalled();
    expect(host.textContent).not.toContain(getTranslator('en')('noteLocalDocumentDownloadStarted'));
    cleanup(root, host);
  });
});
