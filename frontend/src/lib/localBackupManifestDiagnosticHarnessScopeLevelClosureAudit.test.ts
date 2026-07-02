import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const docPath = join(
  process.cwd(),
  'docs',
  'K-252-local-backup-manifest-diagnostic-harness-scopelevel-redaction-closure-audit.md',
);
const harnessPath = join(process.cwd(), 'src', 'lib', 'localBackupManifestDiagnosticHarness.ts');
const harnessTestPath = join(process.cwd(), 'src', 'lib', 'localBackupManifestDiagnosticHarness.test.ts');
const exportSourcePath = join(process.cwd(), 'src', 'lib', 'exportVaultBackup.ts');
const zipSourcePath = join(process.cwd(), 'src', 'lib', 'vaultBackupZip.ts');
const importSourcePath = join(process.cwd(), 'src', 'lib', 'importVaultBackup.ts');
const restoreSourcePath = join(process.cwd(), 'src', 'lib', 'vaultRestorePipeline.ts');

describe('K-252 local backup manifest diagnostic harness scopeLevel closure audit', () => {
  it('documents closure scope and non-goals', () => {
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      'K-252 Local Backup Manifest Diagnostic Harness scopeLevel Redaction Closure Audit',
      'K-252 closes the K-251 scopeLevel redaction patch.',
      'K-252 is docs/audit plus audit test only.',
      'K-252 does not change helper behavior',
      'K-252 does not expose diagnostics',
      'K-252 does not add runtime wiring',
      'K-252 does not change ZIP output',
      'K-252 does not change `manifest.json`',
      'K-252 does not add sidecar output',
      'K-252 does not change import/restore validation',
      'K-252 does not change export result shape',
      '## Non-Goals',
      'no helper behavior change in K-252',
      'no backupKind allowlist expansion',
      'no scopeLevel allowlist expansion',
      'no diagnostic exposure',
      'no UI implementation',
      'no developer console/logging implementation',
      'no ZIP output change',
      'no `manifest.json` replacement/change',
      'no ZIP sidecar',
      'no Google Drive QA work',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('documents current state and scopeLevel redaction behavior', () => {
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      '## Current State Summary',
      'K-248 diagnostic harness/helper exists',
      'K-248 backupKind redaction patch is merged.',
      'K-249 closed the backupKind redaction patch.',
      'K-250 identified scopeLevel as the remaining summary-hardening question.',
      'K-251 scopeLevel redaction patch is merged.',
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
      '## scopeLevel Redaction Audit',
      '`scopeSummary.scopeLevel` no longer passes through raw input.',
      'numeric `0`',
      'numeric `1`',
      'numeric `2` becomes `unknown`.',
      'numeric `3` becomes `unknown`.',
      'numeric `4` becomes `unknown`.',
      'negative numbers become `unknown`.',
      'NaN/Infinity become `unknown`.',
      'string values become `unknown`.',
      'object/array/null/undefined values become `unknown`.',
      'malformed/adversarial values become `unknown`.',
      'raw scopeLevel is not included in summary/errors/warnings.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('documents backupKind preservation, summary contract, and security boundaries', () => {
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      '## backupKind Redaction Preservation Audit',
      'The backupKind allowlist remains:',
      '`diagnostic-manifest`',
      '`core-data`',
      '`full-content-metadata` becomes `unknown`.',
      '`full-content-with-blobs` becomes `unknown`.',
      '`provider-aware-recovery` becomes `unknown`.',
      'future/adversarial backupKind values become `unknown`.',
      'raw backupKind echo path remains closed.',
      'K-251 did not regress backupKind behavior.',
      '## Summary Contract Audit',
      '`scopeSummary.backupKind` is redacted by allowlist.',
      '`scopeSummary.scopeLevel` is redacted by allowlist.',
      '`unknown` is the fallback for unsupported/future/adversarial values.',
      'summary does not claim Level 2 / 3 / 4 support.',
      'summary does not claim `full-content-with-blobs` support.',
      'summary does not claim `provider-aware-recovery` support.',
      'summary remains category/count-only.',
      'no raw user content, token, secret, blob, path, stack, or manifest payload should be returned.',
      '## Security/Privacy Audit',
      'scopeLevel raw input redaction is fixed.',
      'backupKind raw input redaction remains fixed.',
      'key-level forbidden guard remains if applicable.',
      'value-level secret guard remains if applicable.',
      'nested arrays/objects are recursively inspected where applicable.',
      'raw adversarial values do not appear in summary output.',
      'errors/warnings do not leak raw scopeLevel or backupKind.',
      'no real secrets in tests.',
      'no credentials/tokens/secrets are introduced.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('documents helper purity, visibility wiring, export/import/ZIP, and attachment/provider boundaries', () => {
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
      'no generated artifacts.',
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
      '## Attachment/Provider Boundary',
      'no attachment blob export claim.',
      'no Level 3 support claim.',
      '`full-content-with-blobs` remains unknown in current harness summary.',
      '`provider-aware-recovery` remains unknown in current harness summary.',
      'no blob movement/copy/upload/download.',
      'no attachment sync change.',
      'no provider-aware recovery.',
      'Google Drive appDataFolder QA remains separate and externally blocked.',
      'no Google Drive QA work.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('documents test coverage, K-253 recommendation, and closure statement', () => {
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      '## Test Coverage Audit',
      'allowed scopeLevel values are tested.',
      'future scopeLevel values 2 / 3 / 4 are tested as unknown.',
      'malformed/adversarial scopeLevel values are tested.',
      'allowed backupKind values still pass.',
      'future/adversarial backupKind values still become unknown.',
      'raw values are absent from stringified summary output.',
      'related local backup diagnostic tests still pass.',
      '## K-253 Decision',
      'K-253 Local Backup Manifest Diagnostic Harness Integration Closure Audit',
      'docs/audit only.',
      'close the harness hardening line and decide whether to pause visibility/integration work.',
      'no UI.',
      'no logging.',
      'no ZIP/manifest output.',
      'no export result shape change.',
      'no import/restore validation.',
      'K-253 Local Backup Manifest Developer Harness Plan',
      'K-253 Local Backup Manifest Diagnostic Test Hardening',
      'Not recommended yet:',
      'user-facing UI.',
      'logging/console output.',
      'export result metadata.',
      'ZIP sidecar.',
      '`manifest.json` extension.',
      'import/restore validation.',
      '## Closure Statement',
      'K-252 closes K-251 if audit checks pass.',
      'The backupKind summary is redacted by allowlist.',
      'The scopeLevel summary is redacted by allowlist.',
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

  it('confirms K-251 scopeLevel and backupKind redaction coverage remains present in source', () => {
    const harness = readFileSync(harnessPath, 'utf8');
    const harnessTest = readFileSync(harnessTestPath, 'utf8');

    expect(harness).toContain("export type LocalBackupManifestDiagnosticSummaryScopeLevel = 0 | 1 | 'unknown';");
    expect(harness).toContain('function sanitizeScopeLevelForSummary(value: unknown)');
    expect(harness).toContain('if (value === 0 || value === 1) return value;');
    expect(harness).toContain('scopeLevel: sanitizeScopeLevelForSummary(input.manifest?.scopeLevel)');
    expect(harness).not.toContain('scopeLevel: input.manifest?.scopeLevel');
    expect(harness).toContain("export type LocalBackupManifestDiagnosticSummaryBackupKind = 'diagnostic-manifest' | 'core-data' | 'unknown';");
    expect(harness).toContain('function sanitizeBackupKindForSummary(value: unknown)');
    expect(harness).toContain("if (value === 'diagnostic-manifest' || value === 'core-data') return value;");
    expect(harness).toContain('backupKind: sanitizeBackupKindForSummary(input.manifest?.backupKind)');
    expect(harness).not.toContain('backupKind: input.manifest?.backupKind');

    for (const required of [
      'summaryForScopeLevel(0)',
      'summaryForScopeLevel(1)',
      '2,',
      '3,',
      '4,',
      '-1,',
      'Number.NaN',
      'Number.POSITIVE_INFINITY',
      'Number.NEGATIVE_INFINITY',
      "'0'",
      "'arbitrary-scope-level'",
      "'accessToken=FAKE_SECRET'",
      "'C:\\\\Users\\\\Sensitive\\\\vault\\\\notes.md'",
      'expect(summary.scopeSummary.scopeLevel).toBe',
      "expect(summary.scopeSummary.scopeLevel).toBe('unknown')",
      "summaryForBackupKind('diagnostic-manifest')",
      "summaryForBackupKind('core-data')",
      "'full-content-metadata'",
      "'full-content-with-blobs'",
      "'provider-aware-recovery'",
      "expect(summary.scopeSummary.backupKind).toBe('unknown')",
    ]) {
      expect(harnessTest).toContain(required);
    }
  });

  it('confirms K-252 did not wire the harness into export, ZIP, import, or restore output paths', () => {
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
