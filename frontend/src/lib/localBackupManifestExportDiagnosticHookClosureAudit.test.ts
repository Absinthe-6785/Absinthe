import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const docPath = join(process.cwd(), 'docs', 'K-245-local-backup-manifest-export-diagnostic-hook-closure-audit.md');
const exportSourcePath = join(process.cwd(), 'src', 'lib', 'exportVaultBackup.ts');
const zipSourcePath = join(process.cwd(), 'src', 'lib', 'vaultBackupZip.ts');
const importSourcePath = join(process.cwd(), 'src', 'lib', 'importVaultBackup.ts');
const restoreSourcePath = join(process.cwd(), 'src', 'lib', 'vaultRestorePipeline.ts');

describe('K-245 local backup manifest export diagnostic hook closure audit', () => {
  it('documents closure scope and non-goals', () => {
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      'K-245 Local Backup Manifest Export Diagnostic Hook Closure Audit',
      'K-245 closes the K-244 export diagnostic hook milestone.',
      'K-245 is docs/audit plus audit test only.',
      'K-245 does not change hook behavior',
      'expose diagnostic output',
      'change ZIP output',
      'change `manifest.json`',
      'add sidecar output',
      'change import/restore behavior',
      'change persistence/network/remote/blob behavior',
      'no Google Drive QA work',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('summarizes current state and hook placement', () => {
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      '## Current State Summary',
      'K-238 manifest generator/validator exists.',
      'K-241 export diagnostic helper exists.',
      'K-244 calls the diagnostic helper from the export-adjacent path.',
      'The hook is output-neutral.',
      'The hook is after `VaultBackupManifest` assembly in `buildVaultBackupManifestV3`.',
      'The hook is before JSON/ZIP writing.',
      'The diagnostic result is internal/ignored.',
      'ZIP entries are unchanged.',
      'Parsed `manifest.json` is unchanged.',
      'No sidecar output exists.',
      'Public export return shape is unchanged.',
      '`VaultBackupManifest` v3 remains the current package contract.',
      '`importVaultBackup` remains unchanged.',
      '`vaultRestorePipeline` remains unchanged.',
      '`backupBeforeRestore` remains safety context only.',
      'Local runtime data remains source of truth.',
      'Remote systems remain support layers.',
      '## K-244 Hook Placement Audit',
      'frontend/src/lib/exportVaultBackup.ts',
      'runVaultBackupManifestExportDiagnostic(manifest);',
      'single localized choke point',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('documents output-neutral proof and field mapping audits', () => {
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      '## Output-Neutral Proof Audit',
      'ZIP entry list before/after the diagnostic call is unchanged.',
      'Parsed `manifest.json` before/after the diagnostic call is unchanged.',
      'No local-first manifest sidecar is written.',
      'No diagnostic manifest sidecar is written.',
      'Export return shape is unchanged.',
      'The diagnostic result is internal/ignored.',
      'The helper does not write files.',
      'The helper does not create ZIPs.',
      'The helper does not mutate export payload.',
      'Parsed `manifest.json` equality plus ZIP entry equality is the accepted proof',
      '## Field Mapping Audit',
      '`noteCount` is the source note count from `VaultBackupManifest.notes`.',
      '`folderCount` is the source folder count from `VaultBackupManifest.folders`.',
      '`relationCount` is the source relation count computed from note relationships.',
      'does not expose a generic `counts` object',
      '`diagnostic-manifest` / `0`',
      '`core-data` / `1`',
      'Level 2, Level 3, and Level 4 requests remain hard failures.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('documents pipeline preservation, diagnostic boundary, and failure behavior', () => {
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      '## Export/Import Pipeline Preservation',
      '`exportVaultBackup` behavior is unchanged except for the output-neutral diagnostic hook.',
      '`vaultBackupZip` output is unchanged.',
      '`VaultBackupManifest` v3 is unchanged.',
      'Existing `manifest.json` remains the package contract and is not replaced.',
      '`importVaultBackup` is unchanged.',
      '`vaultRestorePipeline` is unchanged.',
      '`backupBeforeRestore` is unchanged.',
      'does not connect restore/import validation',
      'Per-item `skip`, `duplicate`, and `replace` restore strategies remain separate',
      '## Diagnostic Result Boundary',
      'not added to ZIP',
      'not added to `manifest.json`',
      'not added as a sidecar',
      'not returned publicly',
      'not shown in UI',
      'not logged with sensitive values',
      '## Failure Behavior Audit',
      'credentials/tokens/secrets detected',
      '`destructiveWholeVaultReplaceAllowed` true',
      'invalid `backupKind` / `scopeLevel`',
      'Level 2/3/4 escalation',
      'raw blob payload embedded',
      'unsafe override escalation',
      'checksums not computed',
      'attachment blob payload not included under diagnostic/core-data scope',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('documents privacy/security, attachment boundary, K-246 decision, non-goals, and closure', () => {
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      '## Privacy/Security Audit',
      'Key-level forbidden guard is preserved.',
      'Value-level secret guard is preserved.',
      'Nested arrays/objects remain recursively inspected.',
      'Errors do not leak sensitive values.',
      'no Supabase imports',
      'no Google Drive/OAuth imports',
      'no fetch/network calls',
      'no new IndexedDB/localStorage usage',
      'no raw blob data URL allowance',
      '## Attachment Boundary Audit',
      'no Level 3 blob support claim',
      'There is no attachment blob movement, copy, upload, download, delete, recovery, or sync change.',
      'Provider-aware recovery remains non-goal.',
      'Google Drive appDataFolder QA remains separate and externally blocked.',
      '## K-246 Decision',
      'K-246 Local Backup Manifest Diagnostic Visibility Plan',
      'docs/plan only',
      '## Non-Goals',
      'no hook behavior change in K-245',
      'no diagnostic output exposure',
      'no ZIP output change',
      'no `manifest.json` replacement/change',
      'no local-first manifest written to ZIP',
      'no ZIP sidecar',
      'no restore/import validation',
      'no Google Drive QA work',
      '## Closure Statement',
      'K-245 closes the K-244 export diagnostic hook if audit checks pass.',
      'The hook remains output-neutral.',
      'ZIP `manifest.json` and `VaultBackupManifest` v3 remain unchanged.',
      'No sidecar/local-first manifest is written to backup artifacts.',
      'Import/restore behavior remains unchanged.',
      'Diagnostics visibility or artifact evolution requires a separate future plan.',
      'Local runtime data remains source of truth.',
      'Remote systems remain support layers.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('confirms the hook is localized and diagnostics are not wired into ZIP, import, or restore output paths', () => {
    const exportSource = readFileSync(exportSourcePath, 'utf8');
    const zipSource = readFileSync(zipSourcePath, 'utf8');
    const importSource = readFileSync(importSourcePath, 'utf8');
    const restoreSource = readFileSync(restoreSourcePath, 'utf8');

    expect(exportSource).toContain('runVaultBackupManifestExportDiagnostic(manifest);');
    expect(exportSource.indexOf('if (cloud) manifest.cloud = cloud;')).toBeLessThan(
      exportSource.indexOf('runVaultBackupManifestExportDiagnostic(manifest);'),
    );
    expect(exportSource.indexOf('runVaultBackupManifestExportDiagnostic(manifest);')).toBeLessThan(
      exportSource.indexOf('return manifest;'),
    );

    expect(zipSource).toContain("zip.file('manifest.json', JSON.stringify(manifest, null, 2));");
    for (const source of [zipSource, importSource, restoreSource]) {
      expect(source).not.toContain('localBackupManifestExportDiagnostic');
      expect(source).not.toContain('createLocalBackupManifestExportDiagnostic');
      expect(source).not.toContain('runVaultBackupManifestExportDiagnostic');
      expect(source).not.toContain('local-first-manifest.json');
      expect(source).not.toContain('diagnostic-manifest.json');
    }
  });
});
