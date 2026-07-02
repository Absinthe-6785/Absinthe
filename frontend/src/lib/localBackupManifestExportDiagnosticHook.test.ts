import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import type { NoteBase } from '@/components/views/noteUtils';
import type { NoteFolder } from '@/store/useNotesStore';
import {
  buildVaultBackupManifest,
  buildVaultBackupManifestV3,
  runVaultBackupManifestExportDiagnostic,
  type VaultBackupManifest,
} from './exportVaultBackup';
import {
  LOCAL_BACKUP_MANIFEST_EXPORT_DIAGNOSTIC_GATE,
  createLocalBackupManifestExportDiagnostic,
} from './localBackupManifestExportDiagnostic';
import { buildVaultBackupZip } from './vaultBackupZip';

const exportSourcePath = join(process.cwd(), 'src', 'lib', 'exportVaultBackup.ts');
const zipSourcePath = join(process.cwd(), 'src', 'lib', 'vaultBackupZip.ts');
const docPath = join(process.cwd(), 'docs', 'K-244-local-backup-manifest-export-diagnostic-hook.md');

function note(id: string, title: string, relations: NoteBase['relations'] = {}): NoteBase {
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
    relations,
  };
}

const folders: NoteFolder[] = [
  { id: 'f1', name: 'Work', createdAt: 1 },
  { id: 'f2', name: 'Training', createdAt: 2 },
];

function buildManifest(): VaultBackupManifest {
  return buildVaultBackupManifestV3(
    [
      note('n1', 'Alpha', { links: ['n2'], mentions: ['n3'] }),
      note('n2', 'Beta'),
      { ...note('n3', 'Deleted'), deletedAt: 3 },
    ],
    folders,
  );
}

async function zipSnapshot(manifest: VaultBackupManifest): Promise<{
  entries: string[];
  manifestJson: Record<string, unknown>;
}> {
  const zip = await JSZip.loadAsync(await buildVaultBackupZip(manifest).then(blob => blob.arrayBuffer()));
  const entries = Object.keys(zip.files).sort();
  const manifestText = await zip.file('manifest.json')!.async('string');

  return {
    entries,
    manifestJson: JSON.parse(manifestText) as Record<string, unknown>,
  };
}

describe('local backup manifest export diagnostic hook', () => {
  it('documents source-grounded VaultBackupManifest count mapping without generic count overclaim', () => {
    const doc = readFileSync(docPath, 'utf8');

    expect(doc).toContain('`noteCount` is the source note count from `VaultBackupManifest.notes`');
    expect(doc).toContain('`folderCount` is the source folder count from `VaultBackupManifest.folders`');
    expect(doc).toContain('`relationCount` is the source relation count computed from note relationships');
    expect(doc).toContain('The source export type does not expose a generic `counts` object.');
    expect(doc).not.toContain('`folderCount` -> `counts.noteMetadata`');
  });

  it('runs from the post-buildVaultBackupManifestV3 choke point', () => {
    const source = readFileSync(exportSourcePath, 'utf8');

    expect(source).toContain('createLocalBackupManifestExportDiagnostic');
    expect(source).toContain('runVaultBackupManifestExportDiagnostic(manifest);');
    expect(source.indexOf('if (cloud) manifest.cloud = cloud;')).toBeLessThan(
      source.indexOf('runVaultBackupManifestExportDiagnostic(manifest);'),
    );
    expect(source.indexOf('runVaultBackupManifestExportDiagnostic(manifest);')).toBeLessThan(
      source.indexOf('return manifest;'),
    );
  });

  it('maps VaultBackupManifest counts into the K-241 diagnostic helper', () => {
    const manifest = buildManifest();
    const diagnostic = runVaultBackupManifestExportDiagnostic(manifest);

    expect(diagnostic.gate).toBe(LOCAL_BACKUP_MANIFEST_EXPORT_DIAGNOSTIC_GATE);
    expect(diagnostic.hardFailure).toBe(false);
    expect(diagnostic.manifest?.counts.notes).toBe(manifest.noteCount);
    expect(diagnostic.manifest?.counts.noteMetadata).toBe(manifest.folderCount);
    expect(diagnostic.manifest?.counts.noteRelationships).toBe(manifest.relationCount);
    expect(diagnostic.manifest?.domains.find(domain => domain.id === 'notes')?.count).toBe(manifest.noteCount);
    expect(diagnostic.manifest?.domains.find(domain => domain.id === 'noteMetadata')?.count)
      .toBe(manifest.folderCount);
    expect(diagnostic.manifest?.domains.find(domain => domain.id === 'noteRelationships')?.count)
      .toBe(manifest.relationCount);
  });

  it('does not mutate the assembled VaultBackupManifest or add diagnostic fields', () => {
    const manifest = buildManifest();
    const before = JSON.stringify(manifest);

    runVaultBackupManifestExportDiagnostic(manifest);

    expect(JSON.stringify(manifest)).toBe(before);
    expect(manifest).not.toHaveProperty('localFirstBackupManifest');
    expect(manifest).not.toHaveProperty('backupKind');
    expect(manifest).not.toHaveProperty('scopeLevel');
    expect(manifest).not.toHaveProperty('domains');
    expect(manifest).not.toHaveProperty('attachments');
    expect(manifest).not.toHaveProperty('integrity');
  });

  it('keeps buildVaultBackupManifest return shape unchanged', () => {
    const manifest = buildVaultBackupManifest([note('n1', 'Alpha')], folders);

    expect(Object.keys(manifest).sort()).toEqual([
      'app',
      'appVersion',
      'contentFingerprint',
      'exportedAt',
      'extensions',
      'folderCount',
      'folders',
      'kind',
      'noteCount',
      'notes',
      'relationCount',
      'schemaVersion',
      'scope',
    ]);
  });

  it('keeps ZIP entries and parsed manifest.json unchanged when diagnostics run', async () => {
    const manifest = buildManifest();
    const before = await zipSnapshot(manifest);

    runVaultBackupManifestExportDiagnostic(manifest);

    const after = await zipSnapshot(manifest);

    expect(after.entries).toEqual(before.entries);
    expect(after.manifestJson).toEqual(before.manifestJson);
    expect(after.entries).not.toContain('local-first-manifest.json');
    expect(after.entries).not.toContain('diagnostic-manifest.json');
    expect(after.manifestJson).not.toHaveProperty('localFirstBackupManifest');
    expect(after.manifestJson).not.toHaveProperty('backupKind');
    expect(after.manifestJson).not.toHaveProperty('scopeLevel');
  });

  it('preserves K-241 scope escalation and privacy hard-failure behavior in the helper', () => {
    const manifest = buildManifest();
    const blobScope = createLocalBackupManifestExportDiagnostic({
      vaultManifest: manifest,
      backupKind: 'full-content-with-blobs' as never,
      scopeLevel: 3 as never,
    });
    const secretWarning = createLocalBackupManifestExportDiagnostic({
      vaultManifest: manifest,
      warnings: ['access_token=super-secret-value'],
    });

    expect(blobScope.hardFailure).toBe(true);
    expect(blobScope.manifest).toBeNull();
    expect(blobScope.hardFailureReasons).toContain('unsupported_k241_diagnostic_scope:full-content-with-blobs:3');
    expect(secretWarning.hardFailure).toBe(true);
    expect(secretWarning.manifest).toBeNull();
    expect(JSON.stringify(secretWarning.validation.errors)).not.toContain('super-secret-value');
  });

  it('does not introduce ZIP sidecars or forbidden runtime service imports', () => {
    const exportSource = readFileSync(exportSourcePath, 'utf8');
    const zipSource = readFileSync(zipSourcePath, 'utf8');

    expect(zipSource).not.toContain('local-first-manifest.json');
    expect(zipSource).not.toContain('diagnostic-manifest.json');
    expect(zipSource).not.toContain('localBackupManifestExportDiagnostic');

    for (const forbidden of [
      'from ' + "'./importVaultBackup'",
      'from ' + "'./vaultRestorePipeline'",
      'JSZip',
      'fetch(',
      'indexedDB',
      'localStorage',
      'Google' + 'Drive',
      'O' + 'Auth',
      'putBlob',
      'deleteBlob',
      'getBlob',
    ]) {
      expect(exportSource).not.toContain(forbidden);
    }
    expect(exportSource).not.toMatch(/from\s+['"][^'"]*supabase/i);
    expect(exportSource).not.toMatch(/import\s*\([^)]*supabase/i);
  });
});
