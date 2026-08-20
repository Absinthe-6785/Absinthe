/**
 * K-114 — Account-scoped complete snapshot bootstrap and note-local sync status.
 */
import { API_URL } from './config';
import { authReadFetch } from './supabase';
import type { NoteFolderBase as NoteFolder } from '../components/views/noteUtils';
export {
  isNotesCloudSyncEnabled,
  NOTES_RUNTIME_SYNC_MODE_KEY,
  RETURN_TO_USE_LOCAL_LOCK_ENV,
  resolveNotesRuntimeSyncMode,
  type NotesRuntimeSyncMode,
} from './syncMode';

export type NotesSyncStatus = 'dirty' | 'deleted';

export interface DbNoteRow {
  id: string;
  user_id?: string;
  title: string;
  body: string;
  updated_at: number;
  folder_id: string | null;
  deleted_at: number | null;
  starred?: boolean;
  properties?: Record<string, string> | null;
  relations?: Record<string, string[]> | null;
}

type FoldersFetchRows = Array<{ id: string; name: string; created_at: number; user_id?: string }>;

export type CompleteNotesFoldersSnapshot = {
  notes: DbNoteRow[];
  folders: FoldersFetchRows;
};

type CompleteSnapshotPage<T> = {
  account_id: string;
  rows: T[];
  total_count: number;
  offset: number;
  limit: number;
  complete: boolean;
};

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function validateSnapshotPage<T>(value: unknown, accountId: string, kind: 'notes' | 'folders'): CompleteSnapshotPage<T> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`complete_${kind}_snapshot_malformed`);
  const page = value as Partial<CompleteSnapshotPage<T>>;
  const totalCount = page.total_count;
  const pageOffset = page.offset;
  const pageLimit = page.limit;
  if (page.account_id !== accountId || !Array.isArray(page.rows)
    || !Number.isSafeInteger(totalCount) || (totalCount as number) < 0
    || !Number.isSafeInteger(pageOffset) || (pageOffset as number) < 0
    || !Number.isSafeInteger(pageLimit) || (pageLimit as number) < 1
    || typeof page.complete !== 'boolean') {
    throw new Error(`complete_${kind}_snapshot_invalid`);
  }
  return {
    account_id: page.account_id,
    rows: page.rows,
    total_count: page.total_count,
    offset: page.offset,
    limit: page.limit,
    complete: page.complete,
  } as CompleteSnapshotPage<T>;
}

async function readSnapshotPage<T>(url: string, accountId: string, kind: 'notes' | 'folders'): Promise<CompleteSnapshotPage<T>> {
  const response = await authReadFetch(url, { method: 'GET' });
  if (!response.ok) throw new Error(`Failed to load complete ${kind} (${response.status})`);
  return validateSnapshotPage<T>(await response.json(), accountId, kind);
}

function appendNotesPage(rows: DbNoteRow[], pageRows: DbNoteRow[], accountId: string, ids: Set<string>): void {
  for (const row of pageRows) {
    if (!row || typeof row !== 'object' || !hasOwn(row, 'user_id') || row.user_id !== accountId
      || !hasOwn(row, 'folder_id') || !hasOwn(row, 'deleted_at')
      || typeof row.id !== 'string' || ids.has(row.id)
      || typeof row.title !== 'string' || typeof row.body !== 'string'
      || !Number.isFinite(row.updated_at)
      || (row.folder_id !== null && typeof row.folder_id !== 'string')
      || (row.deleted_at !== null && !Number.isFinite(row.deleted_at))) {
      throw new Error('complete_notes_snapshot_invalid');
    }
    ids.add(row.id);
    rows.push(row);
  }
}

function appendFoldersPage(rows: FoldersFetchRows, pageRows: FoldersFetchRows, accountId: string, ids: Set<string>): void {
  for (const row of pageRows) {
    if (!row || typeof row !== 'object' || !hasOwn(row, 'user_id') || row.user_id !== accountId
      || typeof row.id !== 'string' || ids.has(row.id)
      || typeof row.name !== 'string' || !Number.isFinite(row.created_at)) {
      throw new Error('complete_folders_snapshot_invalid');
    }
    ids.add(row.id);
    rows.push(row);
  }
}

async function readCompleteSnapshot<T>(
  accountId: string,
  kind: 'notes' | 'folders',
  buildUrl: (offset: number, limit: number) => string,
  append: (rows: T[], pageRows: T[], ids: Set<string>) => void,
): Promise<T[]> {
  const rows: T[] = [];
  const ids = new Set<string>();
  const pageSize = 500;
  let offset = 0;
  let expectedTotal: number | null = null;
  for (;;) {
    const page = await readSnapshotPage<T>(buildUrl(offset, pageSize), accountId, kind);
    const pageTotal = page.total_count as number;
    if (page.offset !== offset || page.limit !== pageSize
      || (expectedTotal !== null && pageTotal !== expectedTotal)
      || page.rows.length > pageSize) {
      throw new Error(`complete_${kind}_snapshot_incomplete`);
    }
    expectedTotal ??= pageTotal;
    append(rows, page.rows, ids);
    if (rows.length > pageTotal || page.complete !== (rows.length === pageTotal)) {
      throw new Error(`complete_${kind}_snapshot_incomplete`);
    }
    if (page.complete) return rows;
    if (page.rows.length === 0) throw new Error(`complete_${kind}_snapshot_incomplete`);
    offset += page.rows.length;
  }
}

/** Complete account snapshot for RTU bootstrap. This path never pushes local rows. */
export async function fetchCompleteNotesFoldersSnapshot(accountId: string): Promise<CompleteNotesFoldersSnapshot> {
  if (!accountId.trim()) throw new Error('complete_snapshot_account_required');
  const [notes, folders] = await Promise.all([
    readCompleteSnapshot(
      accountId,
      'notes',
      (offset, limit) => `${API_URL}/api/notes?updated_after=0&bootstrap=true&offset=${offset}&limit=${limit}`,
      (rows, pageRows, ids) => appendNotesPage(rows as DbNoteRow[], pageRows as DbNoteRow[], accountId, ids),
    ),
    readCompleteSnapshot(
      accountId,
      'folders',
      (offset, limit) => `${API_URL}/api/note_folders?bootstrap=true&offset=${offset}&limit=${limit}`,
      (rows, pageRows, ids) => appendFoldersPage(rows as FoldersFetchRows, pageRows as FoldersFetchRows, accountId, ids),
    ),
  ]);
  const noteIds = new Set<string>();
  for (const row of notes as DbNoteRow[]) noteIds.add(row.id);
  const folderIds = new Set<string>();
  for (const row of folders as FoldersFetchRows) folderIds.add(row.id);
  if (noteIds.size !== notes.length || folderIds.size !== folders.length) {
    throw new Error('complete_snapshot_duplicate_id');
  }
  return { notes: notes as DbNoteRow[], folders: folders as FoldersFetchRows };
}

export function mapDbFolder(row: { id: string; name: string; created_at: number }): NoteFolder {
  return { id: row.id, name: row.name, createdAt: row.created_at };
}

export function noteRevisionTime(note: { updatedAt: number; deletedAt: number | null }): number {
  return Math.max(note.updatedAt ?? 0, note.deletedAt ?? 0);
}

export function getNoteSyncStatus(
  note: { updatedAt: number; deletedAt: number | null },
): NotesSyncStatus {
  if (note.deletedAt != null && note.deletedAt >= note.updatedAt) return 'deleted';
  return 'dirty';
}
