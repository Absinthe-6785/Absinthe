import { describe, expect, it } from 'vitest';
import type { NoteBase } from '@/components/views/noteUtils';
import { buildVaultBackupManifest, VAULT_BACKUP_SCHEMA_VERSION } from './exportVaultBackup';
import { ABSINTHE_APP_VERSION } from './vaultBackupConstants';

function note(id: string, title: string): NoteBase {
  return {
    id,
    title,
    body: `# ${title}\n\nContent`,
    folderId: null,
    starred: false,
    deletedAt: null,
    createdAt: 1,
    updatedAt: 2,
    properties: {},
    relations: { cites: ['n2'] },
  };
}

describe('exportVaultBackup', () => {
  it('builds a v3 manifest with schema version and notes', () => {
    const manifest = buildVaultBackupManifest(
      [note('n1', 'Alpha'), { ...note('n2', 'Trash'), deletedAt: 99 }],
      [{ id: 'f1', name: 'Research' }],
    );
    expect(manifest.schemaVersion).toBe(VAULT_BACKUP_SCHEMA_VERSION);
    expect(manifest.schemaVersion).toBe(3);
    expect(manifest.app).toBe('absinthe');
    expect(manifest.appVersion).toBe(ABSINTHE_APP_VERSION);
    expect(manifest.noteCount).toBe(1);
    expect(manifest.folderCount).toBe(1);
    expect(manifest.relationCount).toBe(1);
    expect(manifest.folders).toHaveLength(1);
    expect(manifest.notes).toHaveLength(1);
    expect(manifest.notes[0]?.title).toBe('Alpha');
    expect(manifest.extensions).toBeDefined();
    expect(manifest.contentFingerprint).toBeTruthy();
  });
});
