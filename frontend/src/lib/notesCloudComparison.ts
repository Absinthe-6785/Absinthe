import { observePublishedNotesHydration, useNotesStore } from '../store/useNotesStore';
import {
  compareSupportedNoteContent,
  getSupportedNoteContentDifferences,
  isCompleteLocalNote,
  isComparableRemoteNoteContent,
  type NotesSupportedContentDifferenceField,
} from './notesBootstrapAuthority';
import { fetchCompleteNotesFoldersSnapshot, type CompleteNotesFoldersSnapshot } from './notesSyncClient';
import type { NoteBase, NoteFolderBase } from '../components/views/noteUtils';
import { observeAccountScopedFolders, subscribeNotesAuthorityRequestChange } from './notesAccountAuthority';

export const NOTES_COMPARISON_LIMIT = 500;
export const NOTES_CLOUD_SEARCH_QUERY_LIMIT = 120;
export type NotesCloudComparisonDetailCategory = 'localOnly' | 'remoteOnly' | 'divergent' | 'incomparable' | 'deleted';
export interface NotesCloudComparisonDetail {
  readonly id: string;
  readonly localTitle?: string;
  readonly remoteTitle?: string;
}
export type NotesCloudComparisonDetails = Readonly<Record<NotesCloudComparisonDetailCategory, readonly NotesCloudComparisonDetail[]>>;
export interface NotesCloudComparisonReport {
  localOnly: number; remoteOnly: number; matching: number; divergent: number; incomparable: number; deleted: number;
  localFoldersOnly: number; remoteFoldersOnly: number; folderDifferences: number; unresolvedFolders: number;
  details: NotesCloudComparisonDetails;
}
export interface NotesCloudRemoteOnlyNote {
  readonly id: string;
  readonly title?: string;
  readonly body: string;
}
export interface NotesCloudDivergentNotePair {
  readonly id: string;
  readonly local: Readonly<{ title: string; body: string }>;
  readonly cloud: Readonly<{ title: string; body: string }>;
  readonly differingFields: readonly NotesSupportedContentDifferenceField[];
}
export interface NotesCloudSearchMatches {
  readonly remoteOnly: readonly string[];
  readonly divergent: readonly string[];
  readonly total: number;
}

type NotesCloudSearchIndexEntry = Readonly<{
  category: 'remoteOnly' | 'divergent';
  id: string;
  title: string;
  body: string;
}>;

function normalizeCloudSearchText(value: string): string {
  return value.normalize('NFKC').toLowerCase();
}

const detailCategories: readonly NotesCloudComparisonDetailCategory[] = ['localOnly', 'remoteOnly', 'divergent', 'incomparable', 'deleted'];

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
  const report = { localOnly: 0, remoteOnly: 0, matching: 0, divergent: 0, incomparable: 0, deleted: 0, localFoldersOnly: 0, remoteFoldersOnly: 0, folderDifferences: 0, unresolvedFolders: 0 };
  const rows: Record<NotesCloudComparisonDetailCategory, NotesCloudComparisonDetail[]> = {
    localOnly: [], remoteOnly: [], divergent: [], incomparable: [], deleted: [],
  };
  const addDetail = (category: NotesCloudComparisonDetailCategory, id: string, local?: NoteBase, other?: CompleteNotesFoldersSnapshot['notes'][number]) => {
    report[category]++;
    const detail: NotesCloudComparisonDetail = {
      id,
      ...(typeof local?.title === 'string' && local.title.trim() ? { localTitle: local.title } : {}),
      ...(typeof other?.title === 'string' && other.title.trim() ? { remoteTitle: other.title } : {}),
    };
    rows[category].push(Object.freeze(detail));
  };
  for (const id of new Set([...localNotes.keys(), ...remoteNotes.keys()])) {
    const local = localNotes.get(id), other = remoteNotes.get(id);
    if ((local && !isCompleteLocalNote(local)) || (other && !isComparableRemoteNoteContent(accountId, other))) { addDetail('incomparable', id, local, other); continue; }
    if ((local && local.deletedAt !== null) || (other && other.deleted_at !== null)) { addDetail('deleted', id, local, other); continue; }
    if (!local) addDetail('remoteOnly', id, local, other);
    else if (!other) addDetail('localOnly', id, local, other);
    else {
      const comparison = compareSupportedNoteContent(accountId, local, other);
      if (comparison === 'MATCHING') report.matching++;
      else if (comparison === 'DIVERGENT') addDetail('divergent', id, local, other);
      else addDetail('incomparable', id, local, other);
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
  const details = Object.fromEntries(detailCategories.map(category => [
    category,
    Object.freeze(rows[category].sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0)),
  ])) as NotesCloudComparisonDetails;
  return Object.freeze({ ...report, details: Object.freeze(details) });
}

/** Observes existing publication authority; grants no hydration or write permit. */
export function createNotesCloudComparison(accountId: string | null, isAccountCurrent: () => boolean) {
  const observation = observePublishedNotesHydration();
  if (!accountId || !isAccountCurrent() || observation.status !== 'CURRENT' || observation.request.accountId !== accountId) throw new Error('notes_comparison_source_unavailable');
  const request = observation.request;
  const { notes, folders } = useNotesStore.getState();
  const notesIdentity = JSON.stringify(notes);
  const folderIdentity = JSON.stringify(folders);
  if (JSON.stringify(observeAccountScopedFolders(request)) !== folderIdentity) throw new Error('notes_comparison_source_unavailable');
  let live = true, started = false;
  let remoteSnapshot: CompleteNotesFoldersSnapshot | null = null;
  let comparedReport: NotesCloudComparisonReport | null = null;
  let cloudSearchIndex: readonly NotesCloudSearchIndexEntry[] | null = null;
  let unsubscribe = () => {};
  let unsubscribeAuthority = () => {};
  const invalidationListeners = new Set<() => void>();
  const discardRemoteAccess = () => { remoteSnapshot = null; comparedReport = null; cloudSearchIndex = null; };
  const cancel = () => { live = false; discardRemoteAccess(); unsubscribe(); unsubscribeAuthority(); invalidationListeners.clear(); };
  const invalidate = () => {
    if (!live) return;
    live = false; discardRemoteAccess(); unsubscribe(); unsubscribeAuthority();
    const listeners = [...invalidationListeners]; invalidationListeners.clear();
    for (const listener of listeners) { try { listener(); } catch { /* UI observers cannot restore stale authority. */ } }
  };
  const isCurrent = () => {
    try {
      const current = observePublishedNotesHydration();
      const state = useNotesStore.getState();
      const currentNow = live && isAccountCurrent() && current.status === 'CURRENT' && current.request === request && state.notes === notes
        && JSON.stringify(state.notes) === notesIdentity && state.folders === folders
        && JSON.stringify(folders) === folderIdentity && JSON.stringify(observeAccountScopedFolders(request)) === folderIdentity;
      if (!currentNow) discardRemoteAccess();
      return currentNow;
    } catch { discardRemoteAccess(); return false; }
  };
  unsubscribe = useNotesStore.subscribe(() => { if (!isCurrent()) invalidate(); });
  unsubscribeAuthority = subscribeNotesAuthorityRequestChange(currentRequest => {
    if (currentRequest !== request) invalidate();
  });
  const compare = async () => {
    if (started || !isCurrent()) throw new Error('notes_comparison_stale');
    started = true;
    if (notes.length > NOTES_COMPARISON_LIMIT || folders.length > NOTES_COMPARISON_LIMIT) throw new Error('notes_comparison_limit');
    const remote = await fetchCompleteNotesFoldersSnapshot(accountId, { singlePageLimit: NOTES_COMPARISON_LIMIT, isCurrent });
    if (!isCurrent()) throw new Error('notes_comparison_stale');
    const report = compareNotesCloudSnapshot(accountId, notes, folders, remote);
    if (!isCurrent()) throw new Error('notes_comparison_stale');
    const remoteById = new Map(remote.notes.map(row => [row.id, row] as const));
    cloudSearchIndex = (['remoteOnly', 'divergent'] as const).flatMap(category => report.details[category].flatMap(({ id }) => {
      const row = remoteById.get(id);
      if (!row || row.id !== id || row.user_id !== accountId || row.deleted_at !== null
        || !isComparableRemoteNoteContent(accountId, row)) return [];
      return [Object.freeze({ category, id, title: normalizeCloudSearchText(row.title), body: normalizeCloudSearchText(row.body) })];
    }));
    remoteSnapshot = remote;
    comparedReport = report;
    return report;
  };
  const searchCloudNotes = (query: string): NotesCloudSearchMatches | null => {
    if (typeof query !== 'string' || query.length > NOTES_CLOUD_SEARCH_QUERY_LIMIT || !started || !isCurrent()
      || !remoteSnapshot || !comparedReport || !cloudSearchIndex) return null;
    const normalizedQuery = normalizeCloudSearchText(query).trim();
    const matches = normalizedQuery
      ? cloudSearchIndex.filter(entry => entry.title.includes(normalizedQuery) || entry.body.includes(normalizedQuery))
      : [...cloudSearchIndex];
    return Object.freeze({
      remoteOnly: Object.freeze(matches.filter(entry => entry.category === 'remoteOnly').map(entry => entry.id)),
      divergent: Object.freeze(matches.filter(entry => entry.category === 'divergent').map(entry => entry.id)),
      total: cloudSearchIndex.length,
    });
  };
  const getRemoteOnlyNote = (noteId: string): NotesCloudRemoteOnlyNote | null => {
    if (!noteId || !noteId.trim() || !started || !isCurrent() || !remoteSnapshot || !comparedReport
      || notes.some(note => note.id === noteId)
      || !comparedReport.details.remoteOnly.some(detail => detail.id === noteId)) return null;
    const row = remoteSnapshot.notes.find(note => note.id === noteId);
    if (!row || row.id !== noteId || row.user_id !== accountId || row.deleted_at !== null
      || !isComparableRemoteNoteContent(accountId, row)) return null;
    return Object.freeze({
      id: row.id,
      ...(typeof row.title === 'string' && row.title.trim() ? { title: row.title } : {}),
      body: row.body,
    });
  };
  const getDivergentNotePair = (noteId: string): NotesCloudDivergentNotePair | null => {
    if (!noteId || !noteId.trim() || !started || !isCurrent() || !remoteSnapshot || !comparedReport
      || !comparedReport.details.divergent.some(detail => detail.id === noteId)) return null;
    const local = notes.find(note => note.id === noteId);
    const row = remoteSnapshot.notes.find(note => note.id === noteId);
    if (!local || local.id !== noteId || local.deletedAt !== null || !isCompleteLocalNote(local)
      || !row || row.id !== noteId || row.user_id !== accountId || row.deleted_at !== null
      || !isComparableRemoteNoteContent(accountId, row)
      || compareSupportedNoteContent(accountId, local, row) !== 'DIVERGENT') return null;
    const differingFields = getSupportedNoteContentDifferences(accountId, local, row);
    if (!differingFields?.length || !isCurrent()) return null;
    return Object.freeze({
      id: noteId,
      local: Object.freeze({ title: local.title, body: local.body }),
      cloud: Object.freeze({ title: row.title, body: row.body }),
      differingFields,
    });
  };
  const subscribeInvalidation = (listener: () => void) => {
    if (!live) { listener(); return () => {}; }
    invalidationListeners.add(listener);
    return () => invalidationListeners.delete(listener);
  };
  return { compare, cancel, isCurrent, getRemoteOnlyNote, getDivergentNotePair, searchCloudNotes, subscribeInvalidation };
}
export type NotesCloudComparison = ReturnType<typeof createNotesCloudComparison>;
