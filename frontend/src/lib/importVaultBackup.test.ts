import { describe, expect, it } from 'vitest';
import type { NoteBase } from '@/components/views/noteUtils';
import {
  applyVaultRestore,
  backupEntryToNote,
  buildVaultRestorePreview,
  filterManifestBySelection,
  parseVaultBackupJson,
  validateVaultBackupManifest,
} from './importVaultBackup';
import { buildVaultBackupManifest } from './exportVaultBackup';

function note(id: string, title: string): NoteBase {
  return {
    id,
    title,
    body: 'body',
    folderId: null,
    starred: false,
    deletedAt: null,
    createdAt: 1,
    updatedAt: 1,
    properties: {},
    relations: {},
  };
}

describe('importVaultBackup', () => {
  it('parses valid backup JSON', () => {
    const manifest = buildVaultBackupManifest([note('n1', 'Alpha')], [{ id: 'f1', name: 'Work', createdAt: 1 }]);
    const parsed = parseVaultBackupJson(JSON.stringify(manifest));
    expect(parsed?.notes).toHaveLength(1);
    expect(parsed?.folders).toHaveLength(1);
  });

  it('rejects invalid JSON', () => {
    expect(parseVaultBackupJson('not json')).toBeNull();
    expect(parseVaultBackupJson('{}')).toBeNull();
  });

  it('builds preview with conflict count and validation', () => {
    const manifest = buildVaultBackupManifest(
      [note('n1', 'Backup'), note('n2', 'New')],
      [],
    );
    const preview = buildVaultRestorePreview(manifest, [note('n1', 'Local')], []);
    expect(preview.valid).toBe(true);
    expect(preview.noteCount).toBe(2);
    expect(preview.conflictCount).toBe(1);
    expect(preview.newNoteCount).toBe(1);
    expect(preview.validation?.relationCount).toBeDefined();
    expect(preview.folderOptions.length).toBeGreaterThan(0);
    expect(preview.noteOptions).toHaveLength(2);
  });

  it('filters manifest by selection', () => {
    const manifest = buildVaultBackupManifest(
      [note('n1', 'A'), note('n2', 'B')],
      [{ id: 'f1', name: 'F', createdAt: 1 }],
    );
    const selection = { noteIds: new Set(['n1']), folderIds: new Set(['f1']) };
    const filtered = filterManifestBySelection(manifest, selection);
    expect(filtered.notes).toHaveLength(1);
    expect(filtered.notes[0]?.id).toBe('n1');
  });

  it('validates manifest metadata', () => {
    const manifest = buildVaultBackupManifest([note('n1', 'A')], []);
    const report = validateVaultBackupManifest(manifest, [], []);
    expect(report.valid).toBe(true);
    expect(report.noteCount).toBe(1);
    expect(report.appVersion).toBeTruthy();
  });

  it('skips conflicting notes', () => {
    const manifest = buildVaultBackupManifest([note('n1', 'Backup')], []);
    const { notes, result } = applyVaultRestore(manifest, [note('n1', 'Local')], [], 'skip');
    expect(notes.find(n => n.id === 'n1')?.title).toBe('Local');
    expect(result.skippedNotes).toBe(1);
  });

  it('replaces conflicting notes', () => {
    const manifest = buildVaultBackupManifest(
      [{ ...note('n1', 'Backup'), body: 'from backup' }],
      [],
    );
    const { notes, result } = applyVaultRestore(manifest, [note('n1', 'Local')], [], 'replace');
    expect(notes.find(n => n.id === 'n1')?.title).toBe('Backup');
    expect(result.replacedNotes).toBe(1);
  });

  it('duplicates conflicting notes', () => {
    const manifest = buildVaultBackupManifest([note('n1', 'Backup')], []);
    const { notes, result } = applyVaultRestore(manifest, [note('n1', 'Local')], [], 'duplicate');
    expect(notes.filter(n => n.title === 'Backup')).toHaveLength(1);
    expect(notes.find(n => n.id === 'n1')?.title).toBe('Local');
    expect(result.duplicatedNotes).toBe(1);
  });

  it('restores markdown body and properties', () => {
    const entry = {
      id: 'n1',
      title: 'Test',
      folderId: null,
      starred: true,
      updatedAt: 99,
      markdown: '---\ntags:\n  - math\n---\n\nBody text',
      properties: {},
      relations: {},
    };
    const restored = backupEntryToNote(entry);
    expect(restored.body).toBe('Body text');
    expect(restored.starred).toBe(true);
  });
});
