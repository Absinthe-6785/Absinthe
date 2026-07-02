import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import type { NoteBase } from '@/components/views/noteUtils';
import { buildVaultBackupManifest, type VaultBackupManifest } from './exportVaultBackup';
import {
  LOCAL_BACKUP_MANIFEST_EXPORT_DIAGNOSTIC_GATE,
  classifyLocalBackupManifestExportDiagnosticValidation,
  createLocalBackupManifestExportDiagnostic,
  isLocalBackupManifestExportDiagnosticHardFailure,
} from './localBackupManifestExportDiagnostic';
import { buildVaultBackupZip } from './vaultBackupZip';

const sourcePath = join(process.cwd(), 'src', 'lib', 'localBackupManifestExportDiagnostic.ts');
const exportSourcePath = join(process.cwd(), 'src', 'lib', 'exportVaultBackup.ts');
const zipSourcePath = join(process.cwd(), 'src', 'lib', 'vaultBackupZip.ts');
const docPath = join(process.cwd(), 'docs', 'K-241-local-backup-manifest-export-diagnostic-integration.md');

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

function vaultManifest(overrides: Partial<VaultBackupManifest> = {}): VaultBackupManifest {
  return {
    ...buildVaultBackupManifest(
      [note('n1', 'Alpha'), note('n2', 'Beta')],
      [{ id: 'f1', name: 'Work', createdAt: 1 }],
    ),
    exportedAt: '2026-07-02T00:00:00.000Z',
    ...overrides,
  };
}

async function zipEntries(blob: Blob): Promise<string[]> {
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  return Object.keys(zip.files).sort();
}

describe('local backup manifest export diagnostic', () => {
  it('documents the Gate A diagnostic-only decision and non-goals', () => {
    const doc = readFileSync(docPath, 'utf8');
    for (const required of [
      'K-241 Local Backup Manifest Export Diagnostic Integration',
      'K-241 chooses Gate A: output-neutral export-adjacent diagnostic helper.',
      'The export path itself was not touched.',
      'manifest.json unchanged.',
      '`VaultBackupManifest` v3 unchanged.',
      'no sidecar file.',
      'no ZIP entry changes.',
      'K-241 does not claim Level 3 blob support.',
      'validation errors do not print detected sensitive values.',
      'K-242 Local Backup Manifest Export Diagnostic Closure Audit',
      'no ZIP output change.',
      'no manifest.json replacement.',
      'no ZIP sidecar.',
      'no importVaultBackup change.',
      'no vaultRestorePipeline change.',
      'no backupBeforeRestore change.',
      'no Supabase sync changes.',
      'no Google Drive changes.',
      'no OAuth changes.',
      'no Notes/Cosmos changes.',
      'no Google Drive QA work.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('builds and validates a diagnostic local-first manifest from existing export metadata', () => {
    const result = createLocalBackupManifestExportDiagnostic({ vaultManifest: vaultManifest() });

    expect(result.gate).toBe(LOCAL_BACKUP_MANIFEST_EXPORT_DIAGNOSTIC_GATE);
    expect(result.manifest).not.toBeNull();
    expect(result.validation.ok).toBe(true);
    expect(result.hardFailure).toBe(false);
    expect(result.hardFailureReasons).toEqual([]);
    expect(result.manifest?.backupKind).toBe('diagnostic-manifest');
    expect(result.manifest?.scopeLevel).toBe(0);
    expect(result.manifest?.counts.notes).toBe(2);
    expect(result.manifest?.attachments.attachmentBlobPayloadIncluded).toBe(false);
    expect(result.warnings).toContain('manifest_checksum_not_computed');
  });

  it('does not mutate the input VaultBackupManifest', () => {
    const manifest = vaultManifest();
    const before = JSON.stringify(manifest);

    createLocalBackupManifestExportDiagnostic({ vaultManifest: manifest });

    expect(JSON.stringify(manifest)).toBe(before);
  });

  it('can use core-data scope without claiming attachment blob payloads', () => {
    const result = createLocalBackupManifestExportDiagnostic({
      vaultManifest: vaultManifest(),
      backupKind: 'core-data',
      scopeLevel: 1,
    });

    expect(result.validation.ok).toBe(true);
    expect(result.hardFailure).toBe(false);
    expect(result.manifest?.backupKind).toBe('core-data');
    expect(result.manifest?.scopeLevel).toBe(1);
    expect(result.manifest?.attachments.attachmentBlobPayloadIncluded).toBe(false);
    expect(result.manifest?.warnings).toContain('attachment-blob-payload-not-included');
  });

  it('treats invalid backup kind and scope level as a hard failure', () => {
    const result = createLocalBackupManifestExportDiagnostic({
      vaultManifest: vaultManifest(),
      backupKind: 'diagnostic-manifest',
      scopeLevel: 1,
    });

    expect(result.hardFailure).toBe(true);
    expect(result.hardFailureReasons).toContain('invalid_backupKind_scopeLevel:diagnostic-manifest:1');
    expect(result.manifest).toBeNull();
  });

  it('treats credential-like values as hard failures without leaking the sensitive value in errors', () => {
    const result = createLocalBackupManifestExportDiagnostic({
      vaultManifest: vaultManifest(),
      warnings: ['access_token=super-secret-value'],
    });

    expect(result.hardFailure).toBe(true);
    expect(result.hardFailureReasons).toContain('credential_like_value:warnings[3]');
    expect(result.manifest).toBeNull();
    expect(JSON.stringify(result.validation.errors)).not.toContain('super-secret-value');
    expect(JSON.stringify(result.hardFailureReasons)).not.toContain('super-secret-value');
  });

  it('treats raw blob payloads as hard failures', () => {
    const result = createLocalBackupManifestExportDiagnostic({
      vaultManifest: vaultManifest(),
      warnings: ['data:image/png;base64,AAA111'],
    });

    expect(result.hardFailure).toBe(true);
    expect(result.hardFailureReasons).toContain('raw_blob_payload_value:warnings[3]');
    expect(result.manifest).toBeNull();
  });

  it('classifies destructive restore, generated artifacts, and privacy exclusions as hard failures', () => {
    expect(isLocalBackupManifestExportDiagnosticHardFailure('destructive_whole_vault_replace_allowed')).toBe(true);
    expect(isLocalBackupManifestExportDiagnosticHardFailure('generated_dev_test_artifacts_count_nonzero')).toBe(true);
    expect(isLocalBackupManifestExportDiagnosticHardFailure('privacy_exclusion_not_true:excludesTokens')).toBe(true);

    const classification = classifyLocalBackupManifestExportDiagnosticValidation({
      ok: false,
      errors: [
        'destructive_whole_vault_replace_allowed',
        'generated_dev_test_artifacts_not_excluded',
        'privacy_exclusion_not_true:excludesCredentials',
      ],
      warnings: [],
    });

    expect(classification.hardFailure).toBe(true);
    expect(classification.hardFailureReasons).toEqual([
      'destructive_whole_vault_replace_allowed',
      'generated_dev_test_artifacts_not_excluded',
      'privacy_exclusion_not_true:excludesCredentials',
    ]);
  });

  it('keeps checksum, optional domain, and metadata-only attachment gaps warning-only', () => {
    const result = createLocalBackupManifestExportDiagnostic({ vaultManifest: vaultManifest() });

    expect(result.hardFailure).toBe(false);
    expect(result.warnings).toContain('manifest_checksum_not_computed');
    expect(result.manifest?.warnings).toContain('optional-domain-gaps-unresolved');
    expect(result.manifest?.warnings).toContain('attachment-blob-payload-not-included');
    expect(result.manifest?.backupKind).not.toBe('full-content-with-blobs');
    expect(result.manifest?.scopeLevel).toBeLessThan(3);
  });

  it('excludes generated/dev-test artifacts in normal diagnostics', () => {
    const result = createLocalBackupManifestExportDiagnostic({ vaultManifest: vaultManifest() });

    const generatedDomain = result.manifest?.domains.find(domain => domain.id === 'generatedDevTestArtifacts');
    expect(generatedDomain?.included).toBe(false);
    expect(generatedDomain?.count).toBe(0);
    expect(result.manifest?.counts.generatedDevTestArtifacts).toBe(0);
  });

  it('does not change existing ZIP output entries or manifest.json shape', async () => {
    const manifest = vaultManifest();
    const beforeZip = await buildVaultBackupZip(manifest);
    const beforeEntries = await zipEntries(beforeZip);

    createLocalBackupManifestExportDiagnostic({ vaultManifest: manifest });

    const afterZip = await buildVaultBackupZip(manifest);
    const afterEntries = await zipEntries(afterZip);
    const after = await JSZip.loadAsync(await afterZip.arrayBuffer());
    const manifestJson = JSON.parse(await after.file('manifest.json')!.async('string')) as Record<string, unknown>;

    expect(afterEntries).toEqual(beforeEntries);
    expect(afterEntries).toContain('manifest.json');
    expect(afterEntries).not.toContain('local-first-manifest.json');
    expect(afterEntries).not.toContain('diagnostic-manifest.json');
    expect(manifestJson).toHaveProperty('schemaVersion');
    expect(manifestJson).toHaveProperty('notes');
    expect(manifestJson).not.toHaveProperty('localFirstBackupManifest');
    expect(manifestJson).not.toHaveProperty('backupKind');
  });

  it('keeps the diagnostic helper isolated from forbidden runtime services', () => {
    const source = readFileSync(sourcePath, 'utf8');
    for (const forbidden of [
      'from ' + "'./importVaultBackup'",
      'from ' + "'./vaultRestorePipeline'",
      'from ' + "'./vaultBackupZip'",
      'JSZip',
      'fetch(',
      'indexedDB',
      'localStorage',
      'Google' + 'Drive',
      'O' + 'Auth',
      'putBlob',
      'deleteBlob',
      'createObjectURL',
    ]) {
      expect(source).not.toContain(forbidden);
    }
    expect(source).not.toMatch(/from\s+['"][^'"]*supabase/i);
    expect(source).not.toMatch(/import\s*\([^)]*supabase/i);
  });

  it('does not wire the diagnostic helper into export or zip output paths', () => {
    const exportSource = readFileSync(exportSourcePath, 'utf8');
    const zipSource = readFileSync(zipSourcePath, 'utf8');

    expect(exportSource).not.toContain('localBackupManifestExportDiagnostic');
    expect(exportSource).not.toContain('createLocalBackupManifestExportDiagnostic');
    expect(zipSource).not.toContain('localBackupManifestExportDiagnostic');
    expect(zipSource).not.toContain('createLocalBackupManifestExportDiagnostic');
    expect(zipSource).not.toContain('local-first-manifest.json');
  });
});
