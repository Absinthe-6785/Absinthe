import { describe, expect, it } from 'vitest';
import type { NoteBase } from '@/components/views/noteUtils';
import { buildVaultBackupManifest } from './exportVaultBackup';
import { buildVaultBackupZip, parseVaultBackupZip } from './vaultBackupZip';

function note(id: string, title: string): NoteBase {
  return {
    id,
    title,
    body: `# ${title}\n\nBody`,
    folderId: null,
    starred: false,
    deletedAt: null,
    createdAt: 1,
    updatedAt: 2,
    properties: {},
    relations: { links: ['n2'] },
  };
}

describe('vaultBackupZip', () => {
  it('builds a zip with manifest, readme, and markdown notes', async () => {
    const manifest = buildVaultBackupManifest(
      [note('n1', 'Alpha'), note('n2', 'Beta')],
      [{ id: 'f1', name: 'Work', createdAt: 1 }],
    );
    const blob = await buildVaultBackupZip(manifest);
    const parsed = await parseVaultBackupZip(blob);
    expect(parsed?.notes).toHaveLength(2);
    expect(parsed?.folders).toHaveLength(1);
    expect(parsed?.noteCount).toBe(2);
    expect(parsed?.appVersion).toBeTruthy();
  });

  it('returns null for invalid zip', async () => {
    const blob = new Blob(['not a zip'], { type: 'application/zip' });
    expect(await parseVaultBackupZip(blob)).toBeNull();
  });
});
