import { observePublishedNotesHydration, useNotesStore } from '../store/useNotesStore';
import { compareSupportedNoteContent, isCompleteLocalNote, isComparableRemoteNoteContent } from './notesBootstrapAuthority';
import { fetchCompleteNotesFoldersSnapshot, type CompleteNotesFoldersSnapshot } from './notesSyncClient';
import type { NoteBase, NoteFolderBase } from '../components/views/noteUtils';
import { observeAccountScopedFolders } from './notesAccountAuthority';

export const NOTES_COMPARISON_LIMIT = 500;
export interface NotesCloudComparisonReport {
  localOnly: number; remoteOnly: number; matching: number; divergent: number; incomparable: number; deleted: number;
  localFoldersOnly: number; remoteFoldersOnly: number; folderDifferences: number; unresolvedFolders: number;
}

function byId<T extends { id: string }>(rows: readonly T[]): Map<string, T> {
  if (rows.length > NOTES_COMPARISON_LIMIT) throw new Error('notes_comparison_limit');
  const result = new Map<string, T>();
  for (const row of rows) {
    if (!row || typeof row.id !== 'string' || !row.id.trim() || result.has(row.id)) throw new Error('notes_comparison_invalid');
    result.set(row.id, row);
  }
  return result;
}

/** Counts identities and supported content, not attachment bytes/history or durable-save proof. */
export function compareNotesCloudSnapshot(accountId: string, notes: readonly NoteBase[], folders: readonly NoteFolderBase[], remote: CompleteNotesFoldersSnapshot): NotesCloudComparisonReport {
  const localNotes = byId(notes), remoteNotes = byId(remote.notes);
  const localFolders = byId(folders), remoteFolders = byId(remote.folders);
  if (folders.some(row => typeof row.name !== 'string' || !Number.isSafeInteger(row.createdAt) || row.createdAt < 0)) throw new Error('notes_comparison_invalid');
  if (remote.notes.some(row => row.user_id !== accountId) || remote.folders.some(row => row.user_id !== accountId)) throw new Error('notes_comparison_owner');
  const report: NotesCloudComparisonReport = { localOnly: 0, remoteOnly: 0, matching: 0, divergent: 0, incomparable: 0, deleted: 0, localFoldersOnly: 0, remoteFoldersOnly: 0, folderDifferences: 0, unresolvedFolders: 0 };
  for (const id of new Set([...localNotes.keys(), ...remoteNotes.keys()])) {
    const local = localNotes.get(id), other = remoteNotes.get(id);
    if ((local && !isCompleteLocalNote(local)) || (other && !isComparableRemoteNoteContent(accountId, other))) { report.incomparable++; continue; }
    if ((local && local.deletedAt !== null) || (other && other.deleted_at !== null)) { report.deleted++; continue; }
    if (!local) report.remoteOnly++;
    else if (!other) report.localOnly++;
    else {
      const comparison = compareSupportedNoteContent(accountId, local, other);
      if (comparison === 'MATCHING') report.matching++;
      else if (comparison === 'DIVERGENT') report.divergent++;
      else report.incomparable++;
    }
  }
  for (const id of new Set([...localFolders.keys(), ...remoteFolders.keys()])) {
    const local = localFolders.get(id), other = remoteFolders.get(id);
    if (!local) report.remoteFoldersOnly++;
    else if (!other) report.localFoldersOnly++;
    else if (local.name !== other.name || local.createdAt !== other.created_at) report.folderDifferences++;
  }
  for (const row of notes) if (row.folderId !== null && !localFolders.has(row.folderId)) report.unresolvedFolders++;
  for (const row of remote.notes) if (row.folder_id !== null && !remoteFolders.has(row.folder_id)) report.unresolvedFolders++;
  return Object.freeze(report);
}

/** Observes existing publication authority; grants no hydration or write permit. */
export function createNotesCloudComparison(accountId: string | null, isAccountCurrent: () => boolean) {
  const observation = observePublishedNotesHydration();
  if (!accountId || !isAccountCurrent() || observation.status !== 'CURRENT' || observation.request.accountId !== accountId) throw new Error('notes_comparison_source_unavailable');
  const request = observation.request;
  const { notes, folders } = useNotesStore.getState();
  const folderIdentity = JSON.stringify(folders);
  if (JSON.stringify(observeAccountScopedFolders(request)) !== folderIdentity) throw new Error('notes_comparison_source_unavailable');
  let live = true, started = false;
  let unsubscribe = () => {};
  const cancel = () => { live = false; unsubscribe(); };
  const isCurrent = () => {
    try {
      const current = observePublishedNotesHydration();
      const state = useNotesStore.getState();
      return live && isAccountCurrent() && current.status === 'CURRENT' && current.request === request && state.notes === notes && state.folders === folders
        && JSON.stringify(folders) === folderIdentity && JSON.stringify(observeAccountScopedFolders(request)) === folderIdentity;
    } catch { return false; }
  };
  unsubscribe = useNotesStore.subscribe(() => { if (!isCurrent()) cancel(); });
  const compare = async () => {
    if (started || !isCurrent()) throw new Error('notes_comparison_stale');
    started = true;
    if (notes.length > NOTES_COMPARISON_LIMIT || folders.length > NOTES_COMPARISON_LIMIT) throw new Error('notes_comparison_limit');
    const remote = await fetchCompleteNotesFoldersSnapshot(accountId, { singlePageLimit: NOTES_COMPARISON_LIMIT, isCurrent });
    if (!isCurrent()) throw new Error('notes_comparison_stale');
    return compareNotesCloudSnapshot(accountId, notes, folders, remote);
  };
  return { compare, cancel, isCurrent };
}
export type NotesCloudComparison = ReturnType<typeof createNotesCloudComparison>;
