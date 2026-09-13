import type { TranslationKey } from '../../../lib/i18n';

type Translate = (key: TranslationKey) => string;

export function folderDeletionImpactFromState(
  state: {
    readonly folders: readonly { readonly id: string; readonly name: string }[];
    readonly notes: readonly { readonly folderId: string | null }[];
  },
  folderId: string,
): { readonly folderName: string; readonly affectedNoteCount: number } | null {
  const folder = state.folders.find(candidate => candidate.id === folderId);
  if (!folder) return null;
  return {
    folderName: folder.name,
    affectedNoteCount: state.notes.filter(note => note.folderId === folderId).length,
  };
}

function replaceFolderDeletionPlaceholders(
  template: string,
  folderName: string,
  affectedNoteCount?: number,
): string {
  return template
    .replace('{name}', folderName)
    .replace('{count}', String(affectedNoteCount ?? 0));
}

export function folderDeleteActionLabel(t: Translate, folderName: string): string {
  return replaceFolderDeletionPlaceholders(t('nvDeleteFolderAction'), folderName);
}

export function folderDeleteConfirmationMessage(
  t: Translate,
  folderName: string,
  affectedNoteCount: number,
): string {
  return replaceFolderDeletionPlaceholders(t('nvDeleteFolderConfirm'), folderName, affectedNoteCount);
}

export function folderDeletedUndoMessage(
  t: Translate,
  folderName: string,
  affectedNoteCount: number,
): string {
  return replaceFolderDeletionPlaceholders(t('nvFolderDeletedUndo'), folderName, affectedNoteCount);
}
