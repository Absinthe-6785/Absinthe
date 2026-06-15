import type { NoteBase } from '@/components/views/noteUtils';
import { serializeNoteMarkdown } from '@/components/views/features/knowledge';
import type { NoteFolder } from '@/store/useNotesStore';

export const VAULT_BACKUP_SCHEMA_VERSION = 1;

export const VAULT_BACKUP_FORMATS_DOC = `
Supported export formats:
1. Single note — Markdown (.md) via note menu
2. All notes — individual Markdown files via sidebar export
3. Vault backup — JSON manifest with folders, note metadata, and serialized Markdown bodies
4. Health data — CSV date-range export via Settings
`;

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
  folders: NoteFolder[];
  notes: VaultBackupNoteEntry[];
}

export function buildVaultBackupManifest(
  notes: readonly NoteBase[],
  folders: readonly NoteFolder[],
): VaultBackupManifest {
  return {
    schemaVersion: VAULT_BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    app: 'absinthe',
    folders: [...folders],
    notes: notes
      .filter(n => !n.deletedAt)
      .map(n => ({
        id: n.id,
        title: n.title,
        folderId: n.folderId,
        starred: n.starred ?? false,
        createdAt: n.createdAt,
        updatedAt: n.updatedAt,
        markdown: serializeNoteMarkdown(n),
        properties: n.properties ?? {},
        relations: n.relations ?? {},
      })),
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
