/**
 * K-114 — Notes cloud sync client: bootstrap full fetch, steady-state delta, recovery full.
 */
import { API_URL } from './config';
import { authFetch } from './supabase';
import type { NoteFolderBase as NoteFolder } from '../components/views/noteUtils';

export const NOTES_LAST_SYNC_KEY = 'absinthe-notes-last-sync-at';
export const NOTES_FOLDERS_BOOTSTRAP_KEY = 'absinthe-note-folders-bootstrapped';

export type NotesSyncMode = 'bootstrap' | 'delta' | 'recovery';

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
  return readLastNotesSyncAt() == null ? 'bootstrap' : 'delta';
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

export function buildNotesFetchUrl(mode: NotesSyncMode, lastSyncAt: number | null): string {
  if (mode === 'recovery' || mode === 'bootstrap' || lastSyncAt == null) {
    return `${API_URL}/api/notes`;
  }
  return `${API_URL}/api/notes?updated_after=${lastSyncAt}`;
}

export async function fetchNotesFromCloud(mode?: NotesSyncMode): Promise<NotesFetchResult> {
  const resolved = resolveNotesSyncMode(mode);
  const lastSyncAt = readLastNotesSyncAt();
  const useIncremental = resolved === 'delta' && lastSyncAt != null;
  const url = buildNotesFetchUrl(resolved, lastSyncAt);
  const res = await authFetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load notes (${res.status})`);
  }
  const rows = (await res.json()) as DbNoteRow[];
  return {
    mode: resolved,
    rows,
    usedIncremental: useIncremental,
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
    if (!existing || delta.updatedAt >= existing.updatedAt) {
      byId.set(delta.id, delta);
    }
  }
  return [...byId.values()].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function resetNotesSyncClientForTest(): void {
  clearLastNotesSyncAt();
}
