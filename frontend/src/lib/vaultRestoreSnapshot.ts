import type { NoteBase } from '@/components/views/noteUtils';
import type { NoteFolder } from '@/store/useNotesStore';

export const VAULT_RESTORE_SNAPSHOT_KEY = 'absinthe-vault-restore-snapshot';
export const VAULT_RESTORE_SNAPSHOT_FAILURE_MESSAGE =
  'Restore was stopped because a recovery snapshot could not be safely created.';

export class VaultRestoreSnapshotError extends Error {
  readonly code = 'VAULT_RESTORE_SNAPSHOT_NOT_DURABLE';

  constructor() {
    super(VAULT_RESTORE_SNAPSHOT_FAILURE_MESSAGE);
    this.name = 'VaultRestoreSnapshotError';
  }
}

export interface VaultRestoreSnapshot {
  savedAt: string;
  notes: NoteBase[];
  folders: NoteFolder[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isUsableNote(value: unknown): value is NoteBase {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string'
    && value.id.trim().length > 0
    && typeof value.title === 'string'
    && typeof value.body === 'string'
    && isFiniteNumber(value.updatedAt)
    && (value.folderId === null || typeof value.folderId === 'string')
    && (value.deletedAt === null || isFiniteNumber(value.deletedAt));
}

function isUsableFolder(value: unknown): value is NoteFolder {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string'
    && value.id.trim().length > 0
    && typeof value.name === 'string'
    && isFiniteNumber(value.createdAt);
}

function hasUniqueIds(values: readonly { id: string }[]): boolean {
  return new Set(values.map(value => value.id)).size === values.length;
}

function parseUsableSnapshot(raw: string | null): VaultRestoreSnapshot | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)
      || typeof parsed.savedAt !== 'string'
      || !Number.isFinite(Date.parse(parsed.savedAt))
      || !Array.isArray(parsed.notes)
      || !parsed.notes.every(isUsableNote)
      || !hasUniqueIds(parsed.notes)
      || !Array.isArray(parsed.folders)
      || !parsed.folders.every(isUsableFolder)
      || !hasUniqueIds(parsed.folders)) {
      return null;
    }
    return parsed as unknown as VaultRestoreSnapshot;
  } catch {
    return null;
  }
}

function restorePreviousSnapshot(raw: string | null): void {
  try {
    if (raw === null) localStorage.removeItem(VAULT_RESTORE_SNAPSHOT_KEY);
    else localStorage.setItem(VAULT_RESTORE_SNAPSHOT_KEY, raw);
  } catch {
    // Best effort only: the destructive restore remains aborted either way.
  }
}

export function saveVaultRestoreSnapshot(
  notes: readonly NoteBase[],
  folders: readonly NoteFolder[],
): VaultRestoreSnapshot {
  const snapshot: VaultRestoreSnapshot = {
    savedAt: new Date().toISOString(),
    notes: notes.map(note => ({ ...note })),
    folders: folders.map(folder => ({ ...folder })),
  };
  let previous: string | null = null;
  let shouldRestorePrevious = false;
  try {
    const serialized = JSON.stringify(snapshot);
    previous = localStorage.getItem(VAULT_RESTORE_SNAPSHOT_KEY);
    shouldRestorePrevious = true;
    localStorage.setItem(VAULT_RESTORE_SNAPSHOT_KEY, serialized);
    const persisted = localStorage.getItem(VAULT_RESTORE_SNAPSHOT_KEY);
    const verified = parseUsableSnapshot(persisted);
    if (persisted !== serialized || !verified) throw new VaultRestoreSnapshotError();
    return verified;
  } catch {
    if (shouldRestorePrevious) restorePreviousSnapshot(previous);
    throw new VaultRestoreSnapshotError();
  }
}

export function loadVaultRestoreSnapshot(): VaultRestoreSnapshot | null {
  try {
    return parseUsableSnapshot(localStorage.getItem(VAULT_RESTORE_SNAPSHOT_KEY));
  } catch {
    return null;
  }
}

export function clearVaultRestoreSnapshot(): void {
  try {
    localStorage.removeItem(VAULT_RESTORE_SNAPSHOT_KEY);
  } catch {
    // ignore
  }
}

export function hasVaultRestoreSnapshot(): boolean {
  return loadVaultRestoreSnapshot() !== null;
}
