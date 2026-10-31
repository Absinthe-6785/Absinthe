// @vitest-environment happy-dom
import { createElement, type MutableRefObject } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { healthSnapshotMock, zipDownloadMock, jsonDownloadMock, observeMock, attachMock } = vi.hoisted(() => ({
  healthSnapshotMock: vi.fn(),
  zipDownloadMock: vi.fn(),
  jsonDownloadMock: vi.fn(),
  observeMock: vi.fn(), attachMock: vi.fn(),
}));

vi.mock('../../../../store/useNotesStore', async original => ({
  ...await original<typeof import('../../../../store/useNotesStore')>(), observePublishedNotesHydration: observeMock,
}));
vi.mock('../../../../lib/localImageAttachments', async original => ({
  ...await original<typeof import('../../../../lib/localImageAttachments')>(), attachLocalImageToNote: attachMock,
}));

vi.mock('../../../../lib/healthRoutineSync', () => ({
  productionHealthRoutinePersistence: { snapshot: healthSnapshotMock },
}));
vi.mock('../../../../lib/vaultBackupZip', async importOriginal => ({
  ...await importOriginal<typeof import('../../../../lib/vaultBackupZip')>(),
  downloadVaultBackupZip: zipDownloadMock,
}));
vi.mock('../../../../lib/exportVaultBackup', async importOriginal => ({
  ...await importOriginal<typeof import('../../../../lib/exportVaultBackup')>(),
  downloadVaultBackup: jsonDownloadMock,
}));

import type { NoteBase as Note } from '../../noteUtils';
import type { UseNoteViewActionsParams } from './types';
import { useNoteImportExportActions } from './useNoteImportExportActions';
import { useNotesStore } from '../../../../store/useNotesStore';
import {
  DEFAULT_ROUTINE_PRESET_ID,
  createRoutinePresetState,
  updateRoutinePresetState,
} from '../../features/health/routinePresets';

const note: Note = {
  id: 'note-1', title: 'Note', body: 'plain text', updatedAt: 1, folderId: null, deletedAt: null,
};

function renderActions(params: UseNoteViewActionsParams) {
  const actionsRef: MutableRefObject<ReturnType<typeof useNoteImportExportActions> | null> = { current: null };
  function Probe() {
    actionsRef.current = useNoteImportExportActions(params);
    return null;
  }
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => root.render(createElement(Probe)));
  if (!actionsRef.current) throw new Error('actions were not created');
  return { actions: actionsRef.current, root, host };
}

function cleanup(root: Root, host: HTMLElement) {
  act(() => root.unmount());
  host.remove();
}

function params(overrides: Partial<UseNoteViewActionsParams> = {}) {
  const insertImage = vi.fn();
  const insertEmptyImageBlock = vi.fn();
  const updateNote = vi.fn();
  const setIsDragOver = vi.fn();
  const base = {
    notes: [note],
    activeNote: note,
    activeNoteId: note.id,
    activeFolderId: null,
    viewMode: 'edit',
    blockEditorRef: { current: { insertImage, insertEmptyImageBlock } },
    docCopyTimerRef: { current: null },
    setDocCopied: vi.fn(),
    setIsDragOver,
    importNote: vi.fn(),
    updateNote,
  } as unknown as UseNoteViewActionsParams;
  return { params: { ...base, ...overrides } as UseNoteViewActionsParams, insertImage, insertEmptyImageBlock, updateNote, setIsDragOver };
}

beforeEach(() => { observeMock.mockReturnValue({ status: 'UNAVAILABLE' }); attachMock.mockReset(); });
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('useNoteImportExportActions Return-to-Use attachment isolation', () => {
  function publish(accountId: string, target = note) {
    const request = Object.freeze({ accountId, generation: 1 });
    useNotesStore.setState({ notes: [target], activeAccountId: accountId, activeNoteId: target.id });
    observeMock.mockReturnValue({ status: 'CURRENT', request });
    return request;
  }

  it.each(['foreign-same-id', 'account-a-b-a', 'missing-publication'])('rejects a retained callback for %s before attachment writes', async kind => {
    vi.stubEnv('VITE_ABSINTHE_RETURN_TO_USE_ATTACHMENT_ISOLATION', 'false');
    publish('A'); const configured = params(); const mounted = renderActions(configured.params);
    attachMock.mockResolvedValue({ reference: 'attachment://att-test', isCurrent: () => true });
    if (kind === 'foreign-same-id') publish('B', { ...note });
    if (kind === 'account-a-b-a') { publish('B', { ...note }); publish('A'); }
    if (kind === 'missing-publication') observeMock.mockReturnValue({ status: 'UNAVAILABLE' });
    try {
      await act(async () => mounted.actions.attachImageFilesToActiveNote([new File(['private-A'], 'from-A.png', { type: 'image/png' })]));
      expect(attachMock).not.toHaveBeenCalled(); expect(configured.updateNote).not.toHaveBeenCalled();
    } finally { cleanup(mounted.root, mounted.host); }
  });

  it('keeps one captured request for the whole batch and rejects A/B/A while a file is awaited', async () => {
    vi.stubEnv('VITE_ABSINTHE_RETURN_TO_USE_ATTACHMENT_ISOLATION', 'false');
    publish('A'); const configured = params(); const mounted = renderActions(configured.params);
    let resolve!: (value: unknown) => void;
    attachMock.mockReturnValue(new Promise(yes => { resolve = yes; }));
    try {
      mounted.actions.attachImageFilesToActiveNote([new File(['1'], 'one.png', { type: 'image/png' }), new File(['2'], 'two.png', { type: 'image/png' })]);
      publish('B', { ...note }); publish('A');
      await act(async () => { resolve({ reference: 'attachment://att-test', isCurrent: () => true }); });
      expect(attachMock).toHaveBeenCalledTimes(1); expect(configured.updateNote).not.toHaveBeenCalled();
    } finally { cleanup(mounted.root, mounted.host); }
  });

  it('retains same-owner multi-file reference assembly and the existing single body update', async () => {
    vi.stubEnv('VITE_ABSINTHE_RETURN_TO_USE_ATTACHMENT_ISOLATION', 'false');
    publish('A'); const configured = params(); const mounted = renderActions(configured.params);
    attachMock.mockResolvedValueOnce({ reference: 'attachment://one', isCurrent: () => true })
      .mockResolvedValueOnce({ reference: 'attachment://two', isCurrent: () => true });
    try {
      await act(async () => mounted.actions.attachImageFilesToActiveNote([new File(['1'], 'one.png', { type: 'image/png' }), new File(['2'], 'two.png', { type: 'image/png' })]));
      expect(attachMock).toHaveBeenCalledTimes(2);
      expect(attachMock.mock.calls.every(([input]) => input.accountId === 'A' && input.currentBody === note.body)).toBe(true);
      expect(configured.updateNote).toHaveBeenCalledExactlyOnceWith(note.id, { body: 'plain text\n\nattachment://one\n\nattachment://two' });
    } finally { cleanup(mounted.root, mounted.host); }
  });
  it('blocks editor image insertion and drag/drop attachment persistence while isolation is active', async () => {
    vi.stubEnv('VITE_ABSINTHE_RETURN_TO_USE_ATTACHMENT_ISOLATION', 'true');
    const configured = params();
    const mounted = renderActions(configured.params);
    const file = new File(['image'], 'drop.png', { type: 'image/png' });
    const event = {
      preventDefault: vi.fn(),
      dataTransfer: { files: [file] },
      target: document.createElement('div'),
    } as unknown as React.DragEvent<HTMLDivElement>;

    mounted.actions.insertImageAtCursor('alt', 'https://example.test/image.png');
    mounted.actions.insertEmptyImageBlockAtCursor();
    mounted.actions.attachImageFilesToActiveNote([file]);
    mounted.actions.handleEditorDrop(event);
    await act(async () => await Promise.resolve());

    expect(configured.insertImage).not.toHaveBeenCalled();
    expect(configured.insertEmptyImageBlock).not.toHaveBeenCalled();
    expect(configured.updateNote).not.toHaveBeenCalled();
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(configured.setIsDragOver).toHaveBeenCalledWith(false);
    cleanup(mounted.root, mounted.host);
  });

  it('preserves editor image insertion when isolation is disabled', () => {
    vi.stubEnv('VITE_ABSINTHE_RETURN_TO_USE_ATTACHMENT_ISOLATION', 'false');
    const configured = params();
    const mounted = renderActions(configured.params);

    mounted.actions.insertImageAtCursor('alt', 'https://example.test/image.png');
    mounted.actions.insertEmptyImageBlockAtCursor();

    expect(configured.insertImage).toHaveBeenCalledWith('https://example.test/image.png', 'alt');
    expect(configured.insertEmptyImageBlock).toHaveBeenCalledTimes(1);
    cleanup(mounted.root, mounted.host);
  });

  it('routes production ZIP and JSON actions through the awaited account-scoped durable Health snapshot', async () => {
    const durable = updateRoutinePresetState(
      createRoutinePresetState({ routines: [], splitCount: 4 }),
      { type: 'set-split', presetId: DEFAULT_ROUTINE_PRESET_ID, splitCount: 3 },
    );
    healthSnapshotMock.mockResolvedValue(durable);
    zipDownloadMock.mockResolvedValue(undefined);
    useNotesStore.setState({
      activeAccountId: 'account-a',
      folders: [{ id: 'folder-a', name: 'Folder', createdAt: 1 }],
    });
    const configured = params();
    const mounted = renderActions(configured.params);

    await act(async () => mounted.actions.exportVaultBackup());
    await act(async () => mounted.actions.exportVaultBackupJson());

    expect(healthSnapshotMock).toHaveBeenNthCalledWith(1, 'account-a');
    expect(healthSnapshotMock).toHaveBeenNthCalledWith(2, 'account-a');
    expect(zipDownloadMock.mock.calls[0][0].extensions?.health.routinePresetState).toEqual(durable);
    expect(jsonDownloadMock.mock.calls[0][0].extensions?.health.routinePresetState).toEqual(durable);
    cleanup(mounted.root, mounted.host);
  });
});
