// @vitest-environment happy-dom
import { createElement } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FolderDeletionResult, FolderDeletionUndoResult } from '../../../store/useNotesStore';
import { useFolderDeletionLifecycle } from './useFolderDeletionLifecycle';

type HookValue = ReturnType<typeof useFolderDeletionLifecycle>;
type ConfirmCall = [string, () => void | Promise<void>, { confirmLabel: string; variant: 'destructive' }];

describe('useFolderDeletionLifecycle', () => {
  let host: HTMLDivElement;
  let root: Root;
  let latest: HookValue | null;
  let localState: {
    folders: Array<{ id: string; name: string }>;
    notes: Array<{ folderId: string | null }>;
  };
  let activeFolderId: string | null | 'trash' | 'starred';
  let deleteFolder: ReturnType<typeof vi.fn<(id: string) => Promise<FolderDeletionResult>>>;
  let undoFolderDeletion: ReturnType<typeof vi.fn<(token: string) => Promise<FolderDeletionUndoResult>>>;
  let confirmCalls: ConfirmCall[];
  let showToast: ReturnType<typeof vi.fn>;

  const t = (key: string) => ({
    nvDeleteFolderConfirm: 'Delete folder “{name}”? The folder will be deleted. Affected notes: {count}. Note contents will remain, but those notes will become unassigned.',
    deleteLabel: 'Delete',
    nvFolderDeleteFailed: 'Folder deletion failed',
    nvFolderUndoFailed: 'Folder recovery failed',
    nvFolderRestored: 'Folder restored',
  }[key] ?? key);

  function Harness() {
    latest = useFolderDeletionLifecycle({
      getCurrentState: () => localState,
      deleteFolder,
      undoFolderDeletion,
      setActiveFolderId: next => {
        activeFolderId = typeof next === 'function' ? next(activeFolderId) : next;
      },
      showConfirm: (...args) => { confirmCalls.push(args); },
      showToast,
      t: t as never,
    });
    return null;
  }

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    latest = null;
    localState = {
      folders: [{ id: 'research', name: 'Research' }],
      notes: [{ folderId: 'research' }],
    };
    activeFolderId = 'research';
    deleteFolder = vi.fn(async () => ({
      status: 'deleted',
      receipt: {
        token: 'delete-token',
        folderId: 'research',
        folderName: 'Research',
        affectedNoteCount: 2,
        expiresAt: 4_000,
      },
    }));
    undoFolderDeletion = vi.fn(async () => ({
      status: 'restored',
      restoredNoteIds: [],
      preservedNewerAssignmentNoteIds: [],
    }));
    confirmCalls = [];
    showToast = vi.fn();
    act(() => root.render(createElement(Harness)));
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.useRealTimers();
    delete (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  });

  it('opens confirmation while cancel/no callback performs zero destructive work', () => {
    act(() => latest!.requestDeleteFolder('research'));

    expect(confirmCalls).toHaveLength(1);
    expect(confirmCalls[0]?.[0]).toContain('Affected notes: 1.');
    expect(deleteFolder).not.toHaveBeenCalled();
    expect(undoFolderDeletion).not.toHaveBeenCalled();
    expect(activeFolderId).toBe('research');
    expect(localState.folders).toHaveLength(1);
    expect(localState.notes[0]?.folderId).toBe('research');
  });

  it('reconfirms changed impact and consumes the accepted destructive callback once', async () => {
    act(() => latest!.requestDeleteFolder('research'));
    localState = {
      folders: [{ id: 'research', name: 'Research renamed' }],
      notes: [{ folderId: 'research' }, { folderId: 'research' }],
    };

    await act(async () => { await confirmCalls[0]![1](); });
    expect(deleteFolder).not.toHaveBeenCalled();
    expect(confirmCalls).toHaveLength(2);
    expect(confirmCalls[1]?.[0]).toContain('Delete folder “Research renamed”?');
    expect(confirmCalls[1]?.[0]).toContain('Affected notes: 2.');

    await act(async () => {
      await Promise.all([confirmCalls[1]![1](), confirmCalls[1]![1]()]);
    });
    expect(deleteFolder).toHaveBeenCalledTimes(1);
    expect(deleteFolder).toHaveBeenCalledWith('research');
    expect(activeFolderId).toBeNull();
    expect(latest?.folderDeletionUndo?.token).toBe('delete-token');
  });

  it('surfaces an unexpected delete rejection without claiming success or changing navigation', async () => {
    deleteFolder.mockRejectedValueOnce(new Error('unexpected persistence rejection'));
    act(() => latest!.requestDeleteFolder('research'));

    await act(async () => { await confirmCalls[0]![1](); });

    expect(deleteFolder).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledWith('Folder deletion failed', 'error');
    expect(activeFolderId).toBe('research');
    expect(latest?.folderDeletionUndo).toBeNull();
  });
});
