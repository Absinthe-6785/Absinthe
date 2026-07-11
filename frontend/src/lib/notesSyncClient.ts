/**
 * K-114 — Notes cloud sync client: bootstrap full fetch, steady-state delta, recovery full.
 */
import { API_URL } from './config';
import { authFetch } from './supabase';
import type { NoteFolderBase as NoteFolder } from '../components/views/noteUtils';
import {
  RecoveryModeBlockedError,
  mayHydrateRemote,
  recordRecoveryBlock,
} from './recoverySafetyPolicy';
export {
  isNotesCloudSyncEnabled,
  NOTES_RUNTIME_SYNC_MODE_KEY,
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
  rows: Array<{ id: string; name: string; created_at: number }>;
  skipped: boolean;
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
  const resolved = resolveNotesSyncMode(mode);
  const lastSyncAt = readLastNotesSyncAt();
  const url = buildNotesFetchUrl(resolved, lastSyncAt);
  const res = await authFetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load notes (${res.status})`);
  }
  const rows = (await res.json()) as DbNoteRow[];
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
  const resolved = resolveNotesSyncMode(mode);
  if (!shouldFetchFolders(resolved)) {
    return { rows: [], skipped: true };
  }
  const res = await authFetch(`${API_URL}/api/note_folders`);
  if (!res.ok) {
    throw new Error(`Failed to load folders (${res.status})`);
  }
  const rows = (await res.json()) as FoldersFetchResult['rows'];
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
