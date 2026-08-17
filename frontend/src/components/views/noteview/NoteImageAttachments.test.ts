// @vitest-environment happy-dom
import { act } from 'react';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NoteBase as Note } from '../noteUtils';

const mockedMetadataRepository = vi.hoisted(() => ({
  listAttachmentsForNote: vi.fn(async () => [{
    id: 'att-1', noteId: 'note-1', fileName: 'scan.png', mimeType: 'image/png', size: 5,
    localBlobKey: 'local-image/att-1', source: 'local' as const,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
  }]),
  putAttachment: vi.fn(async () => undefined),
  tombstoneAttachment: vi.fn(async () => undefined),
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

vi.mock('../../../lib/localImageAttachments', () => ({
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

function render(element: ReturnType<typeof createElement>) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => root.render(element));
  return { host, root };
}

function cleanup(root: Root, host: HTMLElement) {
  act(() => root.unmount());
  host.remove();
}

async function flushAsync() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

afterEach(() => {
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
