import type { NoteBase } from '@/components/views/noteUtils';
import type { NoteFolder } from '@/store/useNotesStore';
import { buildVaultSnapshot } from './vaultSnapshotBuild';
import { saveVaultSnapshot } from './vaultSnapshotStore';

const DEBOUNCE_MS = 30_000;

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let pendingNotes: NoteBase[] | null = null;
let pendingFolders: NoteFolder[] | null = null;

function isoDateKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function isoWeekKey(d = new Date()): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function createLastSnapshot(
  notes: readonly NoteBase[],
  folders: readonly NoteFolder[],
) {
  const snapshot = buildVaultSnapshot(notes, folders, 'last', 'last');
  return saveVaultSnapshot(snapshot);
}

export function createDailySnapshot(
  notes: readonly NoteBase[],
  folders: readonly NoteFolder[],
  date = new Date(),
) {
  const slotKey = `daily-${isoDateKey(date)}`;
  const snapshot = buildVaultSnapshot(notes, folders, 'daily', slotKey);
  return saveVaultSnapshot(snapshot);
}

export function createWeeklySnapshot(
  notes: readonly NoteBase[],
  folders: readonly NoteFolder[],
  date = new Date(),
) {
  const slotKey = `weekly-${isoWeekKey(date)}`;
  const snapshot = buildVaultSnapshot(notes, folders, 'weekly', slotKey);
  return saveVaultSnapshot(snapshot);
}

function flushDebouncedSnapshot(): void {
  if (!pendingNotes || !pendingFolders) return;
  createLastSnapshot(pendingNotes, pendingFolders);
  pendingNotes = null;
  pendingFolders = null;
}

/** Debounced auto-snapshot after vault mutations. */
export function scheduleAutoSnapshot(
  notes: readonly NoteBase[],
  folders: readonly NoteFolder[],
): void {
  pendingNotes = [...notes];
  pendingFolders = [...folders];
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    flushDebouncedSnapshot();
  }, DEBOUNCE_MS);
}

/** Run daily/weekly slot checks on app startup. */
export function runPeriodicSnapshotSlots(
  notes: readonly NoteBase[],
  folders: readonly NoteFolder[],
): void {
  const active = notes.filter(n => !n.deletedAt);
  if (active.length === 0) return;
  createDailySnapshot(active, folders);
  createWeeklySnapshot(active, folders);
}

/** Test helper — flush pending debounced snapshot immediately. */
export function flushAutoSnapshotForTests(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  flushDebouncedSnapshot();
}

/** Test helper — reset debounce state. */
export function resetAutoSnapshotStateForTests(): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = null;
  pendingNotes = null;
  pendingFolders = null;
}
