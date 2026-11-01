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
    const button = host.querySelector<HTMLButtonElement>('[aria-label="Download original CON.pdf"]');
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
    const button = host.querySelector<HTMLButtonElement>('[aria-label="Download original CON.pdf"]');
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

  it('previews only a verified PDF, exposes the iframe to keyboard users, and provides a close path', async () => {
    const file = new File(['%PDF-verified-bytes'], 'Quarterly.pdf', { type: 'application/pdf' });
    createObjectUrl.mockReturnValue('about:blank');
    services.read.mockResolvedValue({ status: 'VERIFIED', file });
    const { host, root } = render();
    await flushAsync();
    const details = host.querySelector('details')!;
    details.open = true;
    const previewButton = host.querySelector<HTMLButtonElement>('[aria-label="Preview PDF Quarterly.pdf"]')!;
    previewButton.focus();
    act(() => previewButton.click());
    await flushAsync();

    const dialog = document.body.querySelector<HTMLElement>('[data-pdf-preview-dialog]')!;
    const frame = dialog.querySelector<HTMLIFrameElement>('[data-pdf-preview-frame]')!;
    const close = dialog.querySelector<HTMLButtonElement>('button[aria-label="Close"]')!;
    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBe('note-local-document-preview-title');
    expect(frame.src).toBe('about:blank');
    expect(frame.title).toBe('PDF preview: Quarterly.pdf');
    expect(frame.tabIndex).toBe(0);
    expect(frame.hasAttribute('sandbox')).toBe(false);
    expect(document.activeElement).toBe(close);
    expect(dialog.querySelector('[aria-label="Download original Quarterly.pdf"]')).not.toBeNull();
    expect(services.read).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ accountId: 'A', noteId: note.id }));
    expect(createObjectUrl).toHaveBeenCalledExactlyOnceWith(file);
    expect(services.blobAdapter.putBlob).not.toHaveBeenCalled();
    expect(services.blobAdapter.deleteBlob).not.toHaveBeenCalled();

    const tabFromClose = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    act(() => window.dispatchEvent(tabFromClose));
    expect(tabFromClose.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(dialog.querySelector('[aria-label="Download original Quarterly.pdf"]'));
    const tabIntoViewer = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    act(() => window.dispatchEvent(tabIntoViewer));
    expect(tabIntoViewer.defaultPrevented).toBe(false);
    frame.focus();
    expect(document.activeElement).toBe(frame);
    const tabBackToDownload = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
    act(() => window.dispatchEvent(tabBackToDownload));
    expect(tabBackToDownload.defaultPrevented).toBe(false);
    dialog.querySelector<HTMLButtonElement>('[aria-label="Download original Quarterly.pdf"]')!.focus();
    const tabFromDownload = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    act(() => window.dispatchEvent(tabFromDownload));
    expect(tabFromDownload.defaultPrevented).toBe(false);
    frame.focus();
    const tabToClose = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    act(() => window.dispatchEvent(tabToClose));
    expect(tabToClose.defaultPrevented).toBe(false);
    close.focus();
    expect(document.activeElement).toBe(close);

    const outside = document.createElement('button');
    document.body.appendChild(outside);
    frame.focus();
    act(() => frame.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: outside })));
    expect(document.activeElement).toBe(close);
    outside.remove();

    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })));
    await flushAsync();
    expect(document.body.querySelector('[data-pdf-preview-dialog]')).toBeNull();
    expect(revokeObjectUrl).toHaveBeenCalledExactlyOnceWith('about:blank');
    expect(document.activeElement).toBe(previewButton);
    cleanup(root, host);
    expect(revokeObjectUrl).toHaveBeenCalledExactlyOnceWith('about:blank');
  });

  it('keeps DOCX download-only and preserves the existing original download action', async () => {
    const docxCandidate: PublishedLocalDocumentOriginal = Object.freeze({
      ...candidate(authority.request!, 'Contract.docx'),
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      format: 'docx',
    });
    services.list.mockResolvedValue({ status: 'VERIFIED', documents: [docxCandidate] });
    const file = new File(['docx-bytes'], 'Contract.docx', { type: docxCandidate.mimeType });
    services.read.mockResolvedValue({ status: 'VERIFIED', file });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe('Contract.docx');
    });
    const { host, root } = render();
    await flushAsync();
    expect(host.querySelector('[aria-label="Preview PDF Contract.docx"]')).toBeNull();
    const downloadButton = host.querySelector<HTMLButtonElement>('[aria-label="Download original Contract.docx"]')!;
    act(() => downloadButton.click());
    await flushAsync();
    expect(services.read).toHaveBeenCalledOnce();
    expect(createObjectUrl).toHaveBeenCalledExactlyOnceWith(file);
    expect(click).toHaveBeenCalledOnce();
    expect(document.body.querySelector('[data-pdf-preview-dialog]')).toBeNull();
    cleanup(root, host);
  });

  it('does not create an object URL for missing or integrity-rejected PDF readback', async () => {
    services.read.mockResolvedValue({ status: 'UNAVAILABLE', reason: 'document_integrity_mismatch' });
    const { host, root } = render();
    await flushAsync();
    host.querySelector<HTMLButtonElement>('[aria-label="Preview PDF Quarterly.pdf"]')!.click();
    await flushAsync();
    expect(createObjectUrl).not.toHaveBeenCalled();
    expect(document.body.querySelector('[data-pdf-preview-dialog]')).toBeNull();
    expect(host.textContent).toContain(getTranslator('en')('noteLocalDocumentPreviewUnavailable'));
    cleanup(root, host);
  });

  it('does not expose a late verified PDF after an A/B/A Notes authority transition', async () => {
    const pending = deferred<any>();
    services.read.mockReturnValueOnce(pending.promise);
    const { host, root } = render();
    await flushAsync();
    const details = host.querySelector('details')!;
    details.open = true;
    host.querySelector<HTMLButtonElement>('[aria-label="Preview PDF Quarterly.pdf"]')!.click();
    transition('B', [{ ...note, id: 'note-B' }], 'note-B', 2);
    act(() => root.render(createElement(NoteLocalDocumentOriginals, { note: { ...note, id: 'note-B' }, colors })));
    transition('A', [note], note.id, 3);
    act(() => root.render(createElement(NoteLocalDocumentOriginals, { note, colors })));
    pending.resolve({ status: 'VERIFIED', file: new File(['secret'], 'Quarterly.pdf', { type: 'application/pdf' }) });
    await flushAsync();
    expect(createObjectUrl).not.toHaveBeenCalled();
    expect(document.body.querySelector('[data-pdf-preview-dialog]')).toBeNull();
    expect(revokeObjectUrl).not.toHaveBeenCalled();
    cleanup(root, host);
  });

  it.each(['account switch', 'publication replacement'] as const)('closes and revokes an open PDF preview on %s', async invalidation => {
    createObjectUrl.mockReturnValue('about:blank');
    const { host, root } = render();
    await flushAsync();
    const details = host.querySelector('details')!;
    details.open = true;
    host.querySelector<HTMLButtonElement>('[aria-label="Preview PDF Quarterly.pdf"]')!.click();
    await flushAsync();
    expect(document.body.querySelector('[data-pdf-preview-dialog]')).not.toBeNull();

    if (invalidation === 'account switch') {
      const nextNote = { ...note, id: 'note-B' };
      transition('B', [nextNote], nextNote.id, 2);
      act(() => root.render(createElement(NoteLocalDocumentOriginals, { note: nextNote, colors })));
    } else {
      transition('A', [note], note.id, 2);
      act(() => root.render(createElement(NoteLocalDocumentOriginals, { note, colors })));
    }

    expect(document.body.querySelector('[data-pdf-preview-dialog]')).toBeNull();
    expect(revokeObjectUrl).toHaveBeenCalledExactlyOnceWith('about:blank');
    cleanup(root, host);
    expect(revokeObjectUrl).toHaveBeenCalledExactlyOnceWith('about:blank');
  });

  it('revokes a verified preview URL when the component unmounts', async () => {
    createObjectUrl.mockReturnValue('about:blank');
    const { host, root } = render();
    await flushAsync();
    const details = host.querySelector('details')!;
    details.open = true;
    host.querySelector<HTMLButtonElement>('[aria-label="Preview PDF Quarterly.pdf"]')!.click();
    await flushAsync();
    expect(document.body.querySelector('[data-pdf-preview-frame]')).not.toBeNull();
    cleanup(root, host);
    expect(document.body.querySelector('[data-pdf-preview-dialog]')).toBeNull();
    expect(revokeObjectUrl).toHaveBeenCalledExactlyOnceWith('about:blank');
  });

  it('closes and revokes the preview when the current Note is deleted', async () => {
    createObjectUrl.mockReturnValue('about:blank');
    const { host, root } = render();
    await flushAsync();
    const details = host.querySelector('details')!;
    details.open = true;
    host.querySelector<HTMLButtonElement>('[aria-label="Preview PDF Quarterly.pdf"]')!.click();
    await flushAsync();

    transition('A', [{ ...note, deletedAt: '2026-11-01T00:00:00.000Z' }], note.id, 2);
    act(() => root.render(createElement(NoteLocalDocumentOriginals, { note, colors })));
    expect(document.body.querySelector('[data-pdf-preview-dialog]')).toBeNull();
    expect(revokeObjectUrl).toHaveBeenCalledExactlyOnceWith('about:blank');
    cleanup(root, host);
  });

  it('allows only one rapid preview readback at a time', async () => {
    createObjectUrl.mockReturnValue('about:blank');
    const pending = deferred<any>();
    services.read.mockReturnValueOnce(pending.promise);
    const { host, root } = render();
    await flushAsync();
    const details = host.querySelector('details')!;
    details.open = true;
    const button = host.querySelector<HTMLButtonElement>('[aria-label="Preview PDF Quarterly.pdf"]')!;
    act(() => { button.click(); button.click(); });
    expect(services.read).toHaveBeenCalledOnce();
    pending.resolve({ status: 'VERIFIED', file: new File(['data'], 'Quarterly.pdf', { type: 'application/pdf' }) });
    await flushAsync();
    expect(createObjectUrl).toHaveBeenCalledOnce();
    cleanup(root, host);
  });
});
