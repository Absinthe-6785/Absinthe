import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const docPath = join(process.cwd(), 'docs', 'K-242-local-backup-manifest-export-diagnostic-closure-audit.md');
const helperPath = join(process.cwd(), 'src', 'lib', 'localBackupManifestExportDiagnostic.ts');
const helperTestPath = join(process.cwd(), 'src', 'lib', 'localBackupManifestExportDiagnostic.test.ts');
const exportSourcePath = join(process.cwd(), 'src', 'lib', 'exportVaultBackup.ts');
const zipSourcePath = join(process.cwd(), 'src', 'lib', 'vaultBackupZip.ts');
const importSourcePath = join(process.cwd(), 'src', 'lib', 'importVaultBackup.ts');
const restoreSourcePath = join(process.cwd(), 'src', 'lib', 'vaultRestorePipeline.ts');

describe('K-242 local backup manifest export diagnostic closure audit', () => {
  it('documents closure scope and non-goals', () => {
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      'K-242 Local Backup Manifest Export Diagnostic Closure Audit',
      'K-242 is docs/audit plus audit test only.',
      'K-242 does not wire helper into export path.',
      'K-242 does not change ZIP output.',
      'K-242 does not change manifest.json.',
      'K-242 does not add sidecar output.',
      'K-242 does not change import/restore behavior.',
      'K-242 decides whether K-243 should implement export path integration or remain test-only.',
      'no Google Drive QA work.',
      'K-242 closes the K-241 diagnostic helper milestone if audit checks pass.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('documents the current state, helper audit, and output-neutral evidence', () => {
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      '## Current State Summary',
      'K-238 manifest generator/validator exists.',
      'K-241 export diagnostic helper exists.',
      'K-241 helper wraps K-238 generator/validator.',
      'K-241 helper is output-neutral.',
      'K-241 helper is not wired into export path.',
      'existing ZIP manifest.json remains unchanged.',
      'VaultBackupManifest v3 remains unchanged.',
      'no sidecar output exists.',
      'importVaultBackup remains unchanged.',
      'vaultRestorePipeline remains unchanged.',
      'backupBeforeRestore remains safety context only.',
      '## K-241 Helper Audit',
      'frontend/src/lib/localBackupManifestExportDiagnostic.ts',
      'createLocalBackupManifestExportDiagnostic',
      '## Output-Neutral Evidence',
      'ZIP output not changed.',
      'manifest.json not changed.',
      'helper does not write files.',
      'helper does not create ZIPs.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('documents export/import pipeline, scope hardening, and override boundaries', () => {
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      '## Export/Import Pipeline Boundary',
      'exportVaultBackup relationship',
      'VaultBackupManifest v3 relationship',
      'ZIP manifest.json relationship',
      'importVaultBackup relationship',
      'vaultRestorePipeline relationship',
      'backupBeforeRestore relationship',
      '## Scope Hardening Audit',
      'diagnostic-manifest / 0 supported.',
      'core-data / 1 supported.',
      'full-content-metadata / 2 rejected.',
      'full-content-with-blobs / 3 rejected.',
      'provider-aware-recovery / 4 rejected.',
      'Level 3 attachment blob support is not claimed.',
      '## Override Boundary Audit',
      'createdAt.',
      'backupId.',
      'broad manifestInputOverrides removed.',
      'unsafe override escalation hard-fails.',
      'safe createdAt / backupId override positive coverage is present in K-242.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('documents failure, privacy/security, attachment, and K-243 decisions', () => {
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      '## Failure Behavior Audit',
      'credentials/tokens/secrets detected.',
      'destructiveWholeVaultReplaceAllowed true.',
      'Level 2/3/4 scope escalation.',
      'unsafe override escalation.',
      'checksums not computed.',
      'optional domain gaps.',
      '## Privacy/Security Audit',
      'key-level forbidden guard remains.',
      'value-level secret guard remains.',
      'nested arrays/objects recursively inspected.',
      'errors do not leak sensitive values.',
      'no Supabase imports.',
      'no Google Drive/OAuth imports.',
      'no fetch/network calls.',
      'no IndexedDB/localStorage reads/writes.',
      '## Attachment Boundary Audit',
      'attachment metadata markers are diagnostic-only.',
      'no attachment blob movement.',
      'Level 3 hard-fail protects against overclaim.',
      'Google Drive appDataFolder QA remains separate and externally blocked.',
      '## K-243 Decision',
      'K-243 Local Backup Manifest Export Diagnostic Hook Plan',
      'docs/plan only.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('keeps the helper isolated from export, import, restore, persistence, and remote services', () => {
    const helper = readFileSync(helperPath, 'utf8');

    for (const forbidden of [
      'from ' + "'./importVaultBackup'",
      'from ' + "'./vaultRestorePipeline'",
      'from ' + "'./vaultBackupZip'",
      'from ' + "'./notePersistence'",
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
      expect(helper).not.toContain(forbidden);
    }
    expect(helper).not.toMatch(/from\s+['"][^'"]*supabase/i);
    expect(helper).not.toMatch(/import\s*\([^)]*supabase/i);
  });

  it('confirms the diagnostic helper is not wired into export, ZIP, import, or restore paths', () => {
    const sources = [
      readFileSync(exportSourcePath, 'utf8'),
      readFileSync(zipSourcePath, 'utf8'),
      readFileSync(importSourcePath, 'utf8'),
      readFileSync(restoreSourcePath, 'utf8'),
    ];

    for (const source of sources) {
      expect(source).not.toContain('localBackupManifestExportDiagnostic');
      expect(source).not.toContain('createLocalBackupManifestExportDiagnostic');
    }
  });

  it('confirms K-241 tests cover unsafe overrides and K-242 adds safe override coverage', () => {
    const helperTest = readFileSync(helperTestPath, 'utf8');

    expect(helperTest).toContain('prevents manifestInputOverrides from escalating to higher-scope blob support');
    expect(helperTest).toContain('unsupported_k241_diagnostic_override:backupKind');
    expect(helperTest).toContain('unsupported_k241_diagnostic_override:scopeLevel');
    expect(helperTest).toContain('unsupported_k241_diagnostic_override:attachments');
    expect(helperTest).toContain('accepts safe createdAt and backupId overrides without widening diagnostic scope');
    expect(helperTest).toContain('local-first-export-diagnostic-safe-override');
  });
});
