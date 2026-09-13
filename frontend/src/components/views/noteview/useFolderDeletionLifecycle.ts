import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { TranslationKey } from '../../../lib/i18n';
import {
  FOLDER_DELETE_UNDO_WINDOW_MS,
  type FolderDeletionReceipt,
  type FolderDeletionResult,
  type FolderDeletionUndoResult,
} from '../../../store/useNotesStore';
import {
  folderDeleteConfirmationMessage,
  folderDeletionImpactFromState,
} from './folderDeletionPresentation';

type Translate = (key: TranslationKey) => string;
type FolderFilter = string | null | 'trash' | 'starred';

interface FolderDeletionLocalState {
  readonly folders: readonly { readonly id: string; readonly name: string }[];
  readonly notes: readonly { readonly folderId: string | null }[];
}

interface UseFolderDeletionLifecycleParams {
  getCurrentState: () => FolderDeletionLocalState;
  deleteFolder: (folderId: string) => Promise<FolderDeletionResult>;
  undoFolderDeletion: (token: string) => Promise<FolderDeletionUndoResult>;
  folderDeletionUndoEpoch: number;
  setActiveFolderId: Dispatch<SetStateAction<FolderFilter>>;
  showConfirm: (
    message: string,
    onConfirm: () => void | Promise<void>,
    options: { confirmLabel: string; variant: 'destructive' },
  ) => void;
  showToast: (message: string, type?: 'success' | 'error') => void;
  t: Translate;
}

export function useFolderDeletionLifecycle({
  getCurrentState,
  deleteFolder,
  undoFolderDeletion,
  folderDeletionUndoEpoch,
  setActiveFolderId,
  showConfirm,
  showToast,
  t,
}: UseFolderDeletionLifecycleParams) {
  const [undoReceipt, setUndoReceipt] = useState<FolderDeletionReceipt | null>(null);
  const [undoBusy, setUndoBusy] = useState(false);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoBusyRef = useRef(false);
  const observedUndoEpochRef = useRef(folderDeletionUndoEpoch);
  const currentUndoEpochRef = useRef(folderDeletionUndoEpoch);
  currentUndoEpochRef.current = folderDeletionUndoEpoch;

  useEffect(() => () => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
  }, []);

  useEffect(() => {
    if (observedUndoEpochRef.current === folderDeletionUndoEpoch) return;
    observedUndoEpochRef.current = folderDeletionUndoEpoch;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    undoTimerRef.current = null;
    setUndoReceipt(null);
  }, [folderDeletionUndoEpoch]);

  const exposeUndo = useCallback((receipt: FolderDeletionReceipt, expectedEpoch: number) => {
    if (currentUndoEpochRef.current !== expectedEpoch) return;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoReceipt(receipt);
    const remaining = Math.max(
      0,
      Math.min(FOLDER_DELETE_UNDO_WINDOW_MS, receipt.expiresAt - Date.now()),
    );
    undoTimerRef.current = setTimeout(() => {
      setUndoReceipt(current => current?.token === receipt.token ? null : current);
      undoTimerRef.current = null;
    }, remaining);
  }, []);

  const requestDeleteFolder = useCallback((folderId: string) => {
    const requestUndoEpoch = currentUndoEpochRef.current;
    const armConfirmation = (expectedName: string, expectedCount: number) => {
      let consumed = false;
      showConfirm(
        folderDeleteConfirmationMessage(t, expectedName, expectedCount),
        async () => {
          if (consumed) return;
          consumed = true;
          const currentImpact = folderDeletionImpactFromState(getCurrentState(), folderId);
          if (!currentImpact) {
            showToast(t('nvFolderDeleteFailed'), 'error');
            return;
          }
          if (currentImpact.folderName !== expectedName || currentImpact.affectedNoteCount !== expectedCount) {
            armConfirmation(currentImpact.folderName, currentImpact.affectedNoteCount);
            return;
          }

          let result: FolderDeletionResult;
          try {
            result = await deleteFolder(folderId);
          } catch {
            showToast(t('nvFolderDeleteFailed'), 'error');
            return;
          }
          if (result.status !== 'deleted') {
            showToast(t('nvFolderDeleteFailed'), 'error');
            return;
          }
          setActiveFolderId(active => active === folderId ? null : active);
          exposeUndo(result.receipt, requestUndoEpoch);
        },
        { confirmLabel: t('deleteLabel'), variant: 'destructive' },
      );
    };

    const impact = folderDeletionImpactFromState(getCurrentState(), folderId);
    if (!impact) return;
    armConfirmation(impact.folderName, impact.affectedNoteCount);
  }, [deleteFolder, exposeUndo, getCurrentState, setActiveFolderId, showConfirm, showToast, t]);

  const handleUndo = useCallback(async () => {
    const pending = undoReceipt;
    if (!pending || undoBusyRef.current) return;
    undoBusyRef.current = true;
    setUndoBusy(true);
    try {
      const result = await undoFolderDeletion(pending.token);
      if (result.status !== 'restored') {
        showToast(t('nvFolderUndoFailed'), 'error');
        return;
      }
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
      setUndoReceipt(null);
      showToast(t('nvFolderRestored'));
    } catch {
      showToast(t('nvFolderUndoFailed'), 'error');
    } finally {
      undoBusyRef.current = false;
      setUndoBusy(false);
    }
  }, [undoFolderDeletion, undoReceipt, showToast, t]);

  return {
    folderDeletionUndo: undoReceipt,
    folderUndoBusy: undoBusy,
    requestDeleteFolder,
    handleUndoFolderDeletion: handleUndo,
  };
}
