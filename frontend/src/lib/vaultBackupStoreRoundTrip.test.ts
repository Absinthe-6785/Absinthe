// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NoteBase } from '@/components/views/noteUtils';
import { buildValidatedVaultBackupManifest } from './vaultBackupExport';
import { buildVaultRestorePreview, parseVaultBackupJson } from './importVaultBackup';
import { useNotesStore } from '@/store/useNotesStore';
import { setRecoveryModeActiveForTest } from './recoverySafetyPolicy';

function note(id: string, title: string, body: string): NoteBase {
  return {
    id,
    title,
    body,
    folderId: null,
    starred: false,
    deletedAt: null,
    createdAt: 1,
    updatedAt: 2,
    properties: { status: 'active' },
    relations: {},
  };
}

describe('vault backup store round-trip', () => {
  beforeEach(() => {
    setRecoveryModeActiveForTest(false);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    useNotesStore.setState({
      notes: [
        note('n1', '', 'First note body'),
        note('n2', 'Second', 'Second note body'),
        note('n3', '', '# Third heading\n\nThird body'),
      ],
      folders: [{ id: 'f1', name: 'Work', createdAt: 1 }],
    });
  });

  it('exports and restores through the notes store without corruption', () => {
    const { notes, folders, importVaultRestore } = useNotesStore.getState();
    const manifest = buildValidatedVaultBackupManifest(notes, folders);
    const parsed = parseVaultBackupJson(JSON.stringify(manifest));
    expect(parsed).not.toBeNull();

    const preview = buildVaultRestorePreview(parsed!, [], []);
    expect(preview.valid).toBe(true);
    expect(preview.validation?.corruptedNoteIds).toEqual([]);

    const result = importVaultRestore(parsed!, 'replace');
    expect(result.importedNotes + result.replacedNotes).toBeGreaterThan(0);

    const restored = useNotesStore.getState().notes.filter(n => !n.deletedAt);
    expect(restored.find(n => n.id === 'n1')?.title).toBe('First note body');
    expect(restored.find(n => n.id === 'n2')?.title).toBe('Second');
    expect(restored.find(n => n.id === 'n3')?.title).toBe('Third heading');
    expect(restored.find(n => n.id === 'n1')?.properties?.status).toBe('active');
  });
});
