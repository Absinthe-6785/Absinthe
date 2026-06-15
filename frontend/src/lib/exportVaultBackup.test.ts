import { describe, expect, it } from 'vitest';
import type { NoteBase } from '@/components/views/noteUtils';
import { buildVaultBackupManifest, VAULT_BACKUP_SCHEMA_VERSION } from './exportVaultBackup';

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
    relations: {},
  };
}

describe('exportVaultBackup', () => {
  it('builds a manifest with schema version and notes', () => {
    const manifest = buildVaultBackupManifest(
      [note('n1', 'Alpha'), { ...note('n2', 'Trash'), deletedAt: 99 }],
      [{ id: 'f1', name: 'Research' }],
    );
    expect(manifest.schemaVersion).toBe(VAULT_BACKUP_SCHEMA_VERSION);
    expect(manifest.app).toBe('absinthe');
    expect(manifest.folders).toHaveLength(1);
    expect(manifest.notes).toHaveLength(1);
    expect(manifest.notes[0]?.title).toBe('Alpha');
    expect(manifest.notes[0]?.markdown).toContain('Content');
  });
});
