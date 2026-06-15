import type { NoteBase } from '@/components/views/noteUtils';
import { serializeNoteMarkdown } from '@/components/views/features/knowledge';
import type { NoteFolder } from '@/store/useNotesStore';
import {
  ABSINTHE_APP_VERSION,
  VAULT_BACKUP_SCHEMA_VERSION,
  VAULT_BACKUP_FORMATS_DOC,
} from './vaultBackupConstants';

export { ABSINTHE_APP_VERSION, VAULT_BACKUP_SCHEMA_VERSION, VAULT_BACKUP_FORMATS_DOC };

export interface VaultBackupNoteEntry {
  id: string;
  title: string;
  folderId: string | null;
  starred: boolean;
  createdAt?: number;
  updatedAt: number;
  markdown: string;
  properties: NoteBase['properties'];
  relations: NoteBase['relations'];
}

export interface VaultBackupManifest {
  schemaVersion: number;
  exportedAt: string;
  app: 'absinthe';
  appVersion: string;
  noteCount: number;
  folderCount: number;
  relationCount: number;
  folders: NoteFolder[];
  notes: VaultBackupNoteEntry[];
}

function countRelations(notes: readonly VaultBackupNoteEntry[]): number {
  let total = 0;
  for (const note of notes) {
    const rel = note.relations ?? {};
    for (const targets of Object.values(rel)) {
      if (Array.isArray(targets)) total += targets.length;
    }
  }
  return total;
}

export function buildVaultBackupManifest(
  notes: readonly NoteBase[],
  folders: readonly NoteFolder[],
): VaultBackupManifest {
  const active = notes.filter(n => !n.deletedAt);
  const entries: VaultBackupNoteEntry[] = active.map(n => ({
    id: n.id,
    title: n.title,
    folderId: n.folderId,
    starred: n.starred ?? false,
    createdAt: n.createdAt,
    updatedAt: n.updatedAt,
    markdown: serializeNoteMarkdown(n),
    properties: n.properties ?? {},
    relations: n.relations ?? {},
  }));

  return {
    schemaVersion: VAULT_BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    app: 'absinthe',
    appVersion: ABSINTHE_APP_VERSION,
    noteCount: entries.length,
    folderCount: folders.length,
    relationCount: countRelations(entries),
    folders: [...folders],
    notes: entries,
  };
}

export function downloadVaultBackup(manifest: VaultBackupManifest): void {
  const blob = new Blob([JSON.stringify(manifest, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const date = manifest.exportedAt.slice(0, 10);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `absinthe-vault-backup-${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Normalize manifest from older backups (schema v1). */
export function normalizeVaultBackupManifest(
  raw: Partial<VaultBackupManifest>,
): VaultBackupManifest | null {
  if (raw.app !== 'absinthe') return null;
  if (typeof raw.schemaVersion !== 'number') return null;
  if (!Array.isArray(raw.folders) || !Array.isArray(raw.notes)) return null;
  if (typeof raw.exportedAt !== 'string') return null;

  const notes: VaultBackupNoteEntry[] = raw.notes.map(n => ({
    id: String(n.id),
    title: String(n.title ?? ''),
    folderId: n.folderId ?? null,
    starred: Boolean(n.starred),
    createdAt: typeof n.createdAt === 'number' ? n.createdAt : undefined,
    updatedAt: typeof n.updatedAt === 'number' ? n.updatedAt : Date.now(),
    markdown: String(n.markdown ?? ''),
    properties: (n.properties ?? {}) as NoteBase['properties'],
    relations: (n.relations ?? {}) as NoteBase['relations'],
  }));

  return {
    schemaVersion: raw.schemaVersion,
    exportedAt: raw.exportedAt,
    app: 'absinthe',
    appVersion: typeof raw.appVersion === 'string' ? raw.appVersion : 'unknown',
    noteCount: typeof raw.noteCount === 'number' ? raw.noteCount : notes.length,
    folderCount: typeof raw.folderCount === 'number' ? raw.folderCount : raw.folders.length,
    relationCount: typeof raw.relationCount === 'number' ? raw.relationCount : countRelations(notes),
    folders: raw.folders.map(f => ({
      id: String(f.id),
      name: String(f.name ?? ''),
      createdAt: typeof f.createdAt === 'number' ? f.createdAt : Date.now(),
    })),
    notes,
  };
}
