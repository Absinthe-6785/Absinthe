import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NoteBase } from '@/components/views/noteUtils';
import { buildVaultBackupManifest } from './exportVaultBackup';
import {
  applyVaultRestore,
  buildVaultRestorePreview,
  parseVaultBackupJson,
  validateVaultBackupManifest,
} from './importVaultBackup';
import { assertExportReady } from './vaultExportValidate';
import { buildVaultBackupZip, parseVaultBackupZip } from './vaultBackupZip';
import {
  BACKUP_FALLBACK_TITLE,
  deriveBackupNoteTitle,
  migrateVaultBackupManifest,
  repairVaultBackupNoteEntry,
} from './vaultBackupCompatibility';
import { buildValidatedVaultBackupManifest } from './vaultBackupExport';
import { VAULT_BACKUP_SCHEMA_VERSION_V2 } from './vaultBackupConstants';

function note(partial: Partial<NoteBase> & { id: string }): NoteBase {
  return {
    title: 'Note',
    body: 'Body',
    folderId: null,
    starred: false,
    deletedAt: null,
    createdAt: 1,
    updatedAt: 2,
    properties: {},
    relations: {},
    ...partial,
  };
}

describe('vaultBackupCompatibility', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('derives a title for empty-title notes', () => {
    expect(deriveBackupNoteTitle('', '# Meeting notes\n\nDetails')).toBe('Meeting notes');
    expect(deriveBackupNoteTitle('', '')).toBe(BACKUP_FALLBACK_TITLE);
  });

  it('repairs empty titles and legacy body fields', () => {
    const repaired = repairVaultBackupNoteEntry({
      id: 'n1',
      title: '',
      folderId: null,
      starred: false,
      updatedAt: 1,
      markdown: '',
      properties: {},
      relations: {},
      body: 'Legacy body content',
    });
    expect(repaired.entry.title).toBe('Legacy body content');
    expect(repaired.entry.markdown).toBe('Legacy body content');
    expect(repaired.issues.some(issue => issue.reason === 'legacy_body_field')).toBe(true);
    expect(repaired.issues.some(issue => issue.reason === 'missing_title')).toBe(true);
  });

  it('export → restore round-trip succeeds for empty-title notes', () => {
    const notes = [
      note({ id: 'n1', title: '', body: 'Alpha content' }),
      note({ id: 'n2', title: 'Named', body: 'Beta content' }),
      note({ id: 'n3', title: '', body: '# Heading note\n\nDetails' }),
    ];
    const manifest = buildValidatedVaultBackupManifest(notes, [{ id: 'f1', name: 'Work', createdAt: 1 }]);
    const exportReport = assertExportReady(manifest);
    expect(exportReport.valid).toBe(true);
    expect(exportReport.corruptedNoteIds).toEqual([]);

    const parsed = parseVaultBackupJson(JSON.stringify(manifest));
    expect(parsed).not.toBeNull();

    const preview = buildVaultRestorePreview(parsed!, [], []);
    expect(preview.valid).toBe(true);
    expect(preview.validation?.corruptedNoteIds).toEqual([]);
    expect(preview.noteOptions.map(n => n.title)).toEqual([
      'Alpha content',
      'Named',
      'Heading note',
    ]);

    const { notes: restored, result } = applyVaultRestore(parsed!, [], [], 'replace');
    expect(result.importedNotes).toBe(3);
    expect(restored.find(n => n.id === 'n1')?.title).toBe('Alpha content');
    expect(restored.find(n => n.id === 'n3')?.title).toBe('Heading note');
  });

  it('migrates v2 manifests with missing titles', () => {
    const raw = {
      schemaVersion: VAULT_BACKUP_SCHEMA_VERSION_V2,
      exportedAt: '2026-01-01T00:00:00.000Z',
      app: 'absinthe' as const,
      appVersion: '1.0.0',
      noteCount: 1,
      folderCount: 0,
      relationCount: 0,
      folders: [],
      notes: [{
        id: 'legacy-1',
        title: '',
        folderId: null,
        starred: false,
        updatedAt: 1,
        markdown: 'Recovered body',
        properties: {},
        relations: {},
      }],
    };
    const migrated = migrateVaultBackupManifest(raw);
    const report = validateVaultBackupManifest(migrated.manifest, [], []);
    expect(report.valid).toBe(true);
    expect(report.corruptedNoteIds).toEqual([]);
    expect(migrated.manifest.notes[0]?.title).toBe('Recovered body');
  });

  it('ZIP export → restore round-trip succeeds', async () => {
    const manifest = buildValidatedVaultBackupManifest(
      [note({ id: 'zip-1', title: '', body: 'ZIP note body' })],
      [],
    );
    const blob = await buildVaultBackupZip(manifest);
    const parsed = await parseVaultBackupZip(blob);
    expect(parsed).not.toBeNull();
    const preview = buildVaultRestorePreview(parsed!, [], []);
    expect(preview.valid).toBe(true);
    expect(preview.validation?.corruptedNoteIds).toEqual([]);
  });

  it('current schema migration repairs missing titles before validation', () => {
    const manifest = buildVaultBackupManifest(
      [note({ id: 'a', title: '', body: 'one' })],
      [],
    );
    const raw = {
      ...manifest,
      notes: [{
        ...manifest.notes[0]!,
        title: '',
        markdown: 'one',
      }],
    };
    const migrated = migrateVaultBackupManifest(raw);
    const report = validateVaultBackupManifest(migrated.manifest, [], []);
    expect(report.valid).toBe(true);
    expect(migrated.manifest.notes[0]?.title).toBe('one');
    expect(migrated.issues.some(issue => issue.reason === 'missing_title')).toBe(true);
  });

  it('legacy buildVaultBackupManifest produces restore-safe entries', () => {
    const manifest = buildVaultBackupManifest(
      [note({ id: 'legacy-export', title: '', body: 'from sidebar export' })],
      [],
    );
    const preview = buildVaultRestorePreview(manifest, [], []);
    expect(preview.valid).toBe(true);
    expect(preview.noteOptions[0]?.title).toBe('from sidebar export');
  });
});
