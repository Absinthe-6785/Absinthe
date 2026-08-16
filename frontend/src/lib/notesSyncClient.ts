/**
 * K-114 — Notes cloud sync client: bootstrap full fetch, steady-state delta, recovery full.
 */
import { API_URL } from './config';
import { authFetch, authReadFetch } from './supabase';
import type { NoteFolderBase as NoteFolder } from '../components/views/noteUtils';
import {
  RecoveryModeBlockedError,
  assertCurrentOperationEpoch,
  captureOperationEpoch,
  mayHydrateRemote,
  recordRecoveryBlock,
} from './recoverySafetyPolicy';
export {
  isNotesCloudSyncEnabled,
  NOTES_RUNTIME_SYNC_MODE_KEY,
  RETURN_TO_USE_LOCAL_LOCK_ENV,
  resolveNotesRuntimeSyncMode,
  type NotesRuntimeSyncMode,
} from './syncMode';

export const NOTES_LAST_SYNC_KEY = 'absinthe-notes-last-sync-at';
export const NOTES_DELTA_CURSOR_KEY = NOTES_LAST_SYNC_KEY;
export const NOTES_FOLDERS_BOOTSTRAP_KEY = 'absinthe-note-folders-bootstrapped';

export type NotesSyncMode = 'bootstrap' | 'delta' | 'recovery';
export type NotesSyncStatus = 'clean' | 'dirty' | 'deleted' | 'conflict';

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

export interface NotesFetchResult {
  mode: NotesSyncMode;
  rows: DbNoteRow[];
  usedIncremental: boolean;
  lastSyncAt: number | null;
}

export interface FoldersFetchResult {
  rows: Array<{ id: string; name: string; created_at: number; user_id?: string }>;
  skipped: boolean;
}

export type CompleteNotesFoldersSnapshot = {
  notes: DbNoteRow[];
  folders: FoldersFetchResult['rows'];
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

function appendFoldersPage(rows: FoldersFetchResult['rows'], pageRows: FoldersFetchResult['rows'], accountId: string, ids: Set<string>): void {
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
      (rows, pageRows, ids) => appendFoldersPage(rows as FoldersFetchResult['rows'], pageRows as FoldersFetchResult['rows'], accountId, ids),
    ),
  ]);
  const noteIds = new Set<string>();
  for (const row of notes as DbNoteRow[]) noteIds.add(row.id);
  const folderIds = new Set<string>();
  for (const row of folders as FoldersFetchResult['rows']) folderIds.add(row.id);
  if (noteIds.size !== notes.length || folderIds.size !== folders.length) {
    throw new Error('complete_snapshot_duplicate_id');
  }
  return { notes: notes as DbNoteRow[], folders: folders as FoldersFetchResult['rows'] };
}

export function readLastNotesSyncAt(): number | null {
  try {
    const raw = localStorage.getItem(NOTES_LAST_SYNC_KEY);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export function writeLastNotesSyncAt(timestamp: number): void {
  if (!mayHydrateRemote()) {
    recordRecoveryBlock('hydrate_remote');
    return;
  }
  try {
    localStorage.setItem(NOTES_LAST_SYNC_KEY, String(timestamp));
  } catch { /* ignore */ }
}

export function clearLastNotesSyncAt(): void {
  try {
    localStorage.removeItem(NOTES_LAST_SYNC_KEY);
    localStorage.removeItem(NOTES_FOLDERS_BOOTSTRAP_KEY);
  } catch { /* ignore */ }
}

export function resolveNotesSyncMode(explicit?: NotesSyncMode): NotesSyncMode {
  if (explicit) return explicit;
  return 'delta';
}

export function computeLastSyncTimestamp(rows: readonly DbNoteRow[], fallback = Date.now()): number {
  let max = 0;
  for (const row of rows) {
    const updated = row.updated_at ?? 0;
    const deleted = row.deleted_at ?? 0;
    max = Math.max(max, updated, deleted);
  }
  return max > 0 ? max : fallback;
}

export function buildNotesFetchUrl(_mode: NotesSyncMode, lastSyncAt: number | null): string {
  const cursor = lastSyncAt ?? 0;
  return `${API_URL}/api/notes?updated_after=${cursor}`;
}

export async function fetchNotesFromCloud(mode?: NotesSyncMode): Promise<NotesFetchResult> {
  if (!mayHydrateRemote()) {
    recordRecoveryBlock('hydrate_remote');
    throw new RecoveryModeBlockedError('hydrate_remote');
  }
  const operationEpoch = captureOperationEpoch();
  const resolved = resolveNotesSyncMode(mode);
  const lastSyncAt = readLastNotesSyncAt();
  const url = buildNotesFetchUrl(resolved, lastSyncAt);
  const res = await authFetch(url);
  assertCurrentOperationEpoch(operationEpoch, 'hydrate_remote');
  if (!res.ok) {
    throw new Error(`Failed to load notes (${res.status})`);
  }
  const rows = (await res.json()) as DbNoteRow[];
  assertCurrentOperationEpoch(operationEpoch, 'hydrate_remote');
  return {
    mode: resolved,
    rows,
    usedIncremental: true,
    lastSyncAt,
  };
}

export function shouldFetchFolders(mode: NotesSyncMode): boolean {
  if (mode === 'bootstrap' || mode === 'recovery') return true;
  try {
    return localStorage.getItem(NOTES_FOLDERS_BOOTSTRAP_KEY) !== '1';
  } catch {
    return true;
  }
}

export function markFoldersBootstrapped(): void {
  try {
    localStorage.setItem(NOTES_FOLDERS_BOOTSTRAP_KEY, '1');
  } catch { /* ignore */ }
}

export async function fetchFoldersFromCloud(mode?: NotesSyncMode): Promise<FoldersFetchResult> {
  if (!mayHydrateRemote()) {
    recordRecoveryBlock('hydrate_remote');
    throw new RecoveryModeBlockedError('hydrate_remote');
  }
  const operationEpoch = captureOperationEpoch();
  const resolved = resolveNotesSyncMode(mode);
  if (!shouldFetchFolders(resolved)) {
    return { rows: [], skipped: true };
  }
  const res = await authFetch(`${API_URL}/api/note_folders`);
  assertCurrentOperationEpoch(operationEpoch, 'hydrate_remote');
  if (!res.ok) {
    throw new Error(`Failed to load folders (${res.status})`);
  }
  const rows = (await res.json()) as FoldersFetchResult['rows'];
  assertCurrentOperationEpoch(operationEpoch, 'hydrate_remote');
  markFoldersBootstrapped();
  return { rows, skipped: false };
}

export function mapDbFolder(row: { id: string; name: string; created_at: number }): NoteFolder {
  return { id: row.id, name: row.name, createdAt: row.created_at };
}

export function mergeDeltaNoteRows<T extends { id: string; updatedAt: number; deletedAt: number | null }>(
  localNotes: readonly T[],
  deltaNotes: readonly T[],
): T[] {
  const byId = new Map(localNotes.map(n => [n.id, n]));
  for (const delta of deltaNotes) {
    const existing = byId.get(delta.id);
    if (!existing || compareNoteRevision(delta, existing) >= 0) {
      byId.set(delta.id, delta);
    }
  }
  return [...byId.values()].sort((a, b) => noteRevisionTime(b) - noteRevisionTime(a));
}

export function noteRevisionTime(note: { updatedAt: number; deletedAt: number | null }): number {
  return Math.max(note.updatedAt ?? 0, note.deletedAt ?? 0);
}

export function compareNoteRevision(
  a: { updatedAt: number; deletedAt: number | null },
  b: { updatedAt: number; deletedAt: number | null },
): number {
  return noteRevisionTime(a) - noteRevisionTime(b);
}

export function getNoteSyncStatus(
  note: { updatedAt: number; deletedAt: number | null },
  lastSyncAt: number | null = readLastNotesSyncAt(),
): NotesSyncStatus {
  const cursor = lastSyncAt ?? 0;
  const revision = noteRevisionTime(note);
  if (revision <= cursor) return 'clean';
  if (note.deletedAt != null && note.deletedAt >= note.updatedAt) return 'deleted';
  return 'dirty';
}

export function shouldPushNoteToCloud(
  note: { updatedAt: number; deletedAt: number | null },
  lastSyncAt: number | null = readLastNotesSyncAt(),
): boolean {
  const status = getNoteSyncStatus(note, lastSyncAt);
  return status === 'dirty' || status === 'deleted';
}

export function selectDirtyNotesForPush<T extends { updatedAt: number; deletedAt: number | null }>(
  notes: readonly T[],
  lastSyncAt: number | null = readLastNotesSyncAt(),
): T[] {
  return notes.filter(note => shouldPushNoteToCloud(note, lastSyncAt));
}

export function resetNotesSyncClientForTest(): void {
  clearLastNotesSyncAt();
}
