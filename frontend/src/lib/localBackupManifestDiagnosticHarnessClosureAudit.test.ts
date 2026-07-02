import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const docPath = join(process.cwd(), 'docs', 'K-249-local-backup-manifest-diagnostic-harness-closure-audit.md');
const harnessPath = join(process.cwd(), 'src', 'lib', 'localBackupManifestDiagnosticHarness.ts');
const harnessTestPath = join(process.cwd(), 'src', 'lib', 'localBackupManifestDiagnosticHarness.test.ts');
const exportSourcePath = join(process.cwd(), 'src', 'lib', 'exportVaultBackup.ts');
const zipSourcePath = join(process.cwd(), 'src', 'lib', 'vaultBackupZip.ts');
const importSourcePath = join(process.cwd(), 'src', 'lib', 'importVaultBackup.ts');
const restoreSourcePath = join(process.cwd(), 'src', 'lib', 'vaultRestorePipeline.ts');

describe('K-249 local backup manifest diagnostic harness closure audit', () => {
  it('documents closure scope and non-goals', () => {
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      'K-249 Local Backup Manifest Diagnostic Harness Closure Audit',
      'K-249 closes the K-248 diagnostic harness/helper milestone after the backupKind redaction patch.',
      'K-249 is docs/audit plus audit test only.',
      'K-249 does not change helper behavior',
      'K-249 does not expose diagnostics',
      'K-249 does not add runtime wiring',
      'K-249 does not change ZIP output',
      'K-249 does not change `manifest.json`',
      'K-249 does not add sidecar output',
      'K-249 does not change import/restore validation',
      'K-249 does not change export result shape',
      'no Google Drive QA work',
      '## Non-Goals',
      'no helper behavior change in K-249',
      'no backupKind allowlist expansion',
      'no diagnostic exposure',
      'no UI implementation',
      'no developer console/logging implementation',
      'no export result shape change',
      'no ZIP output change',
      'no `manifest.json` replacement/change',
      'no restore/import validation',
      'no Google Drive QA work',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('documents current state, backupKind redaction, and shape tightening', () => {
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      '## Current State Summary',
      'K-248 diagnostic harness/helper exists',
      'The helper remains pure/isolated.',
      'The helper is not runtime-wired.',
      'Diagnostic output is not shown in UI.',
      'Diagnostic output is not logged.',
      'Diagnostic output is not written to ZIP.',
      'Diagnostic output is not written to `manifest.json`.',
      'Diagnostic output is not sidecar output.',
      'Diagnostic output is not connected to import/restore.',
      'Export result shape remains unchanged.',
      'Local runtime data remains source of truth.',
      'Remote systems remain support layers.',
      '## backupKind Redaction Audit',
      '`scopeSummary.backupKind` no longer echoes unknown raw input.',
      '`diagnostic-manifest`',
      '`core-data`',
      '`full-content-metadata` becomes `unknown`.',
      '`full-content-with-blobs` becomes `unknown`.',
      '`provider-aware-recovery` becomes `unknown`.',
      'token-like values become `unknown` and raw value absent.',
      'secret-like values become `unknown` and raw value absent.',
      'blob/data-url-like values become `unknown` and raw value absent.',
      'path-like values become `unknown` and raw value absent.',
      'stack/raw-looking values become `unknown` and raw value absent.',
      'malformed/newline/control-character values become `unknown` and raw value absent.',
      'raw backupKind is not included in summary/errors/warnings.',
      '## Shape Tightening Audit',
      '`scopeSummary.backupKind` may now be always present as `diagnostic-manifest | core-data | unknown`.',
      'shape tightening is safer for redaction.',
      '`unknown` is a redacted fallback.',
      'no public API contract is widened.',
      'no export result shape changes.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('documents helper purity, visibility/wiring, export/import/ZIP, and privacy boundaries', () => {
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      '## Helper Purity Audit',
      'no IndexedDB reads/writes.',
      'no localStorage reads/writes.',
      'no fetch/network.',
      'no Supabase imports.',
      'no Google Drive/OAuth imports.',
      'no attachment blob movement.',
      'no file writes.',
      'no ZIP creation.',
      'no runtime UI imports.',
      'no route/navigation imports.',
      '## Visibility/Wiring Audit',
      'no UI exposure.',
      'no logging/console exposure.',
      'no developer panel exposure.',
      'no export result shape exposure.',
      'no ZIP artifact exposure.',
      'no `manifest.json` exposure.',
      'no sidecar exposure.',
      'no import/restore validation connection.',
      'no public API exposure.',
      '## Export/Import/ZIP Boundary Audit',
      '`exportVaultBackup` behavior unchanged.',
      'ZIP output unchanged.',
      '`manifest.json` unchanged.',
      'sidecar absent.',
      '`importVaultBackup` unchanged.',
      '`vaultRestorePipeline` unchanged.',
      '`backupBeforeRestore` unchanged.',
      'no restore/import mutation.',
      'no restore validation connection.',
      '## Security/Privacy Audit',
      'backupKind raw input redaction is fixed.',
      'key-level forbidden guard remains if applicable.',
      'value-level secret guard remains if applicable.',
      'nested arrays/objects are recursively inspected where applicable.',
      'raw adversarial values do not appear in summary output.',
      'errors/warnings do not leak raw backupKind.',
      'no real secrets in tests.',
      'no credentials/tokens/secrets are introduced.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('documents attachment/provider boundary, test coverage, K-250 decision, and closure', () => {
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      '## Attachment/Provider Boundary',
      'no attachment blob export claim.',
      'no Level 3 support claim.',
      '`full-content-with-blobs` is unknown in current harness summary.',
      '`provider-aware-recovery` is unknown in current harness summary.',
      'no blob movement/copy/upload/download.',
      'no attachment sync change.',
      'no provider-aware recovery.',
      'Google Drive appDataFolder QA remains separate and externally blocked.',
      '## Test Coverage Audit',
      'allowed backupKind values are tested.',
      'future-scoped backupKind values are tested as unknown.',
      'adversarial token/secret/blob/path/raw-looking values are tested.',
      'raw values are absent from stringified summary output.',
      'related local backup diagnostic tests still pass.',
      '## K-250 Decision',
      'K-250 Local Backup Manifest Diagnostic Harness Integration Boundary Plan',
      'docs/plan only.',
      'no UI.',
      'no logging.',
      'no ZIP/manifest output.',
      'no export result shape change.',
      'no import/restore validation.',
      '## Closure Statement',
      'K-249 closes K-248 plus the backupKind redaction patch if audit checks pass.',
      'The backupKind summary is redacted by allowlist.',
      'Unknown/future/adversarial values become `unknown`.',
      'The helper remains pure/isolated and not runtime-wired.',
      'Diagnostics remain unexposed to UI/logs/ZIP/manifest/import/restore.',
      'Any future visibility or integration requires a separate plan.',
      'Local runtime data remains source of truth.',
      'Remote systems remain support layers.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('confirms backupKind redaction coverage and helper isolation in source', () => {
    const harness = readFileSync(harnessPath, 'utf8');
    const harnessTest = readFileSync(harnessTestPath, 'utf8');

    expect(harness).toContain("export type LocalBackupManifestDiagnosticSummaryBackupKind = 'diagnostic-manifest' | 'core-data' | 'unknown';");
    expect(harness).toContain('function sanitizeBackupKindForSummary(value: unknown)');
    expect(harness).toContain("if (value === 'diagnostic-manifest' || value === 'core-data') return value;");
    expect(harness).toContain("backupKind: sanitizeBackupKindForSummary(input.manifest?.backupKind)");
    expect(harness).not.toContain('backupKind: input.manifest?.backupKind');

    for (const required of [
      "summaryForBackupKind('diagnostic-manifest')",
      "summaryForBackupKind('core-data')",
      "'full-content-metadata'",
      "'full-content-with-blobs'",
      "'provider-aware-recovery'",
      "'accessToken=FAKE_SECRET'",
      "'refreshToken:FAKE_SECRET'",
      "'client_secret=FAKE_SECRET'",
      "'data:application/octet-stream;base64,FAKE'",
      "'full-content-with-blobs\\naccessToken=FAKE_SECRET'",
      "'{\"backupKind\":\"core-data\",\"secret\":\"FAKE\"}'",
      "expect(summary.scopeSummary.backupKind).toBe('unknown')",
      'expect(output).not.toContain(backupKind)',
    ]) {
      expect(harnessTest).toContain(required);
    }

    for (const forbidden of [
      'from ' + "'./exportVaultBackup'",
      'from ' + "'./vaultBackupZip'",
      'from ' + "'./importVaultBackup'",
      'from ' + "'./vaultRestorePipeline'",
      'from ' + "'./notePersistence'",
      'localStorage',
      'indexedDB',
      'fetch(',
      'JSZip',
      'Google' + 'Drive',
      'O' + 'Auth',
      'Supabase',
      'console.log',
      'console.warn',
      'console.error',
    ]) {
      expect(harness).not.toContain(forbidden);
    }
  });

  it('confirms K-249 did not wire the harness into export, ZIP, import, or restore output paths', () => {
    const outputSources = [
      readFileSync(exportSourcePath, 'utf8'),
      readFileSync(zipSourcePath, 'utf8'),
      readFileSync(importSourcePath, 'utf8'),
      readFileSync(restoreSourcePath, 'utf8'),
    ];

    for (const source of outputSources) {
      expect(source).not.toContain('localBackupManifestDiagnosticHarness');
      expect(source).not.toContain('createLocalBackupManifestDiagnosticSummary');
      expect(source).not.toContain('local-backup-manifest-diagnostic-summary.json');
      expect(source).not.toContain('diagnostic-harness-summary.json');
    }
  });
});
