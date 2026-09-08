/**
 * K-114 — Account-scoped complete snapshot bootstrap and note-local sync status.
 */
import { API_URL } from './config';
import { authFetch, authReadFetch } from './supabase';
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

export interface NoteWritePayload {
  id: string;
  title: string;
  body: string;
  updated_at: number;
  folder_id: string | null;
  deleted_at: number | null;
  starred?: boolean;
  properties?: Record<string, string> | null;
  relations?: Record<string, string[]> | null;
}

export type NotesRemoteContextState = 'CURRENT' | 'STALE_ACCOUNT' | 'STALE_OPERATION';

export type NotesRemoteWriteClassification =
  | 'REMOTE_CONFIRMED'
  | 'AUTH_UNAVAILABLE'
  | 'REQUEST_NOT_STARTED'
  | 'HTTP_REJECTION'
  | 'TRANSPORT_AMBIGUOUS'
  | 'REMOTE_CONFIRMED_AFTER_READBACK'
  | 'REMOTE_NOT_CONFIRMED'
  | 'REMOTE_CONFLICT'
  | 'STALE_OPERATION'
  | 'STALE_ACCOUNT';

export interface NotesRemoteWriteResult {
  classification: NotesRemoteWriteClassification;
  httpStatus?: number;
  code?: string;
}

export interface NotesRemoteWriteInput {
  accountId: string;
  payload: NoteWritePayload;
  currentState: () => NotesRemoteContextState;
}

const AUTHORITATIVE_NOTE_KEYS = [
  'body', 'deleted_at', 'folder_id', 'id', 'properties', 'relations',
  'starred', 'title', 'updated_at', 'user_id',
] as const;

function validStringRecord(value: unknown): value is Record<string, string> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
    && Object.entries(value as Record<string, unknown>).every(([key, item]) => key.length > 0 && typeof item === 'string');
}

function validRelations(value: unknown): value is Record<string, string[]> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
    && Object.entries(value as Record<string, unknown>).every(([key, item]) => (
      key.length > 0 && Array.isArray(item) && item.every(id => typeof id === 'string')
    ));
}

export function validateAuthoritativeNoteRow(value: unknown, accountId: string): DbNoteRow | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (Object.keys(row).sort().join(',') !== [...AUTHORITATIVE_NOTE_KEYS].sort().join(',')) return null;
  if (typeof row.id !== 'string' || row.user_id !== accountId
    || typeof row.title !== 'string' || typeof row.body !== 'string'
    || !Number.isSafeInteger(row.updated_at) || (row.updated_at as number) < 0
    || (row.folder_id !== null && typeof row.folder_id !== 'string')
    || (row.deleted_at !== null && (!Number.isSafeInteger(row.deleted_at) || (row.deleted_at as number) < 0))
    || typeof row.starred !== 'boolean'
    || (row.properties !== null && !validStringRecord(row.properties))
    || (row.relations !== null && !validRelations(row.relations))) return null;
  return row as unknown as DbNoteRow;
}

function orderedRecord(value: Record<string, string> | null | undefined): Record<string, string> | null {
  if (!value || Object.keys(value).length === 0) return null;
  return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)));
}

function orderedRelations(value: Record<string, string[]> | null | undefined): Record<string, string[]> | null {
  if (!value || Object.keys(value).length === 0) return null;
  return Object.fromEntries(Object.entries(value)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, ids]) => [key, [...ids]]));
}

function canonicalMutation(value: NoteWritePayload | DbNoteRow): string {
  return JSON.stringify({
    id: value.id,
    title: value.title,
    body: value.body,
    folder_id: value.folder_id,
    deleted_at: value.deleted_at,
    starred: value.starred ?? false,
    properties: orderedRecord(value.properties),
    relations: orderedRelations(value.relations),
  });
}

function effectiveRevision(value: Pick<NoteWritePayload, 'updated_at' | 'deleted_at'>): number {
  return Math.max(value.updated_at, value.deleted_at ?? 0);
}

function matchingAuthoritativeMutation(row: DbNoteRow, payload: NoteWritePayload): boolean {
  return row.id === payload.id
    && effectiveRevision(row) >= effectiveRevision(payload)
    && canonicalMutation(row) === canonicalMutation(payload);
}

async function responseCode(response: Response): Promise<string | undefined> {
  try {
    const body = await response.json() as unknown;
    if (!body || typeof body !== 'object' || Array.isArray(body)) return undefined;
    const detail = (body as { detail?: unknown }).detail;
    if (typeof detail === 'string') return detail;
    if (detail && typeof detail === 'object' && !Array.isArray(detail)
      && typeof (detail as { code?: unknown }).code === 'string') {
      return (detail as { code: string }).code;
    }
  } catch { /* A status/code classification never depends on an error body. */ }
  return undefined;
}

function deterministicNoWrite(status: number, code?: string): boolean {
  if (code === 'NOTE_WRITE_UNCONFIRMED') return false;
  if (code === 'NOTE_ID_UNAVAILABLE' || code === 'NOTE_WRITE_CONFLICT') return true;
  return status === 400 || status === 401 || status === 403 || status === 404
    || status === 413 || status === 422;
}

function preRequestFailure(error: unknown): NotesRemoteWriteClassification {
  return error instanceof Error && error.message === 'Not authenticated'
    ? 'AUTH_UNAVAILABLE'
    : 'REQUEST_NOT_STARTED';
}

/**
 * Performs one Note POST and, only for an outcome that may have committed,
 * one exact owner-scoped readback. It never retries the mutation.
 */
export async function writeNoteWithAuthoritativeReadback(
  input: NotesRemoteWriteInput,
): Promise<NotesRemoteWriteResult> {
  const context = (): NotesRemoteWriteClassification | null => {
    const state = input.currentState();
    return state === 'CURRENT' ? null : state;
  };
  const initialStale = context();
  if (initialStale) return { classification: initialStale };

  const readback = async (): Promise<NotesRemoteWriteResult> => {
    const beforeRead = context();
    if (beforeRead) return { classification: beforeRead };
    let response: Response;
    try {
      response = await authReadFetch(
        `${API_URL}/api/notes/${encodeURIComponent(input.payload.id)}`,
        { method: 'GET' },
        {
          onRequestStart: () => {
            if (context()) throw new Error('notes_readback_context_stale');
          },
        },
      );
    } catch {
      return context()
        ? { classification: context() as NotesRemoteWriteClassification }
        : { classification: 'TRANSPORT_AMBIGUOUS' };
    }
    const afterRead = context();
    if (afterRead) return { classification: afterRead };
    if (response.status === 404) return { classification: 'REMOTE_NOT_CONFIRMED', httpStatus: 404 };
    if (!response.ok) return { classification: 'TRANSPORT_AMBIGUOUS', httpStatus: response.status };
    let row: DbNoteRow | null = null;
    try {
      row = validateAuthoritativeNoteRow(await response.json(), input.accountId);
    } catch { /* Invalid readback remains ambiguous. */ }
    if (!row) return { classification: 'TRANSPORT_AMBIGUOUS' };
    const finalRead = context();
    if (finalRead) return { classification: finalRead };
    if (matchingAuthoritativeMutation(row, input.payload)) {
      return { classification: 'REMOTE_CONFIRMED_AFTER_READBACK' };
    }
    if (effectiveRevision(row) < effectiveRevision(input.payload)) {
      return { classification: 'REMOTE_NOT_CONFIRMED' };
    }
    return { classification: 'REMOTE_CONFLICT' };
  };

  let requestStarted = false;
  let response: Response;
  try {
    response = await authFetch(
      `${API_URL}/api/notes`,
      { method: 'POST', body: JSON.stringify(input.payload) },
      {
        onRequestStart: () => {
          if (context()) throw new Error('notes_write_context_stale');
          requestStarted = true;
        },
      },
    );
  } catch (error) {
    const afterFailure = context();
    if (afterFailure) return { classification: afterFailure };
    if (!requestStarted) return { classification: preRequestFailure(error) };
    return readback();
  }

  const afterPost = context();
  if (afterPost) return { classification: afterPost };
  if (response.ok) {
    let row: DbNoteRow | null = null;
    try {
      row = validateAuthoritativeNoteRow(await response.json(), input.accountId);
    } catch { /* A malformed 2xx may still have committed. */ }
    if (row && matchingAuthoritativeMutation(row, input.payload)) {
      return { classification: 'REMOTE_CONFIRMED' };
    }
    return readback();
  }

  const code = await responseCode(response);
  const afterErrorBody = context();
  if (afterErrorBody) return { classification: afterErrorBody };
  if (deterministicNoWrite(response.status, code)) {
    return { classification: 'HTTP_REJECTION', httpStatus: response.status, code };
  }
  return readback();
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
