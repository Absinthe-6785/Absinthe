import type { NoteBase } from '@/components/views/noteUtils';
import type { NoteFolder } from '@/store/useNotesStore';

const SNAPSHOT_KEY = 'absinthe-vault-restore-snapshot';

export interface VaultRestoreSnapshot {
  savedAt: string;
  notes: NoteBase[];
  folders: NoteFolder[];
}

export function saveVaultRestoreSnapshot(
  notes: readonly NoteBase[],
  folders: readonly NoteFolder[],
): void {
  const snapshot: VaultRestoreSnapshot = {
    savedAt: new Date().toISOString(),
    notes: notes.map(n => ({ ...n })),
    folders: folders.map(f => ({ ...f })),
  };
  try {
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
  } catch {
    // Quota exceeded — restore proceeds without undo safety net
  }
}

export function loadVaultRestoreSnapshot(): VaultRestoreSnapshot | null {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as VaultRestoreSnapshot;
    if (!Array.isArray(parsed.notes) || !Array.isArray(parsed.folders)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearVaultRestoreSnapshot(): void {
  try {
    localStorage.removeItem(SNAPSHOT_KEY);
  } catch {
    // ignore
  }
}

export function hasVaultRestoreSnapshot(): boolean {
  return loadVaultRestoreSnapshot() !== null;
}
