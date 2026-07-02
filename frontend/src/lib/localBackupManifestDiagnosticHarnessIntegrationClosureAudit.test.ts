import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createLocalBackupManifestDiagnosticSummary } from './localBackupManifestDiagnosticHarness';

const docPath = join(
  process.cwd(),
  'docs',
  'K-253-local-backup-manifest-diagnostic-harness-integration-closure-audit.md',
);
const harnessPath = join(process.cwd(), 'src', 'lib', 'localBackupManifestDiagnosticHarness.ts');
const harnessTestPath = join(process.cwd(), 'src', 'lib', 'localBackupManifestDiagnosticHarness.test.ts');
const exportSourcePath = join(process.cwd(), 'src', 'lib', 'exportVaultBackup.ts');
const zipSourcePath = join(process.cwd(), 'src', 'lib', 'vaultBackupZip.ts');
const importSourcePath = join(process.cwd(), 'src', 'lib', 'importVaultBackup.ts');
const restoreSourcePath = join(process.cwd(), 'src', 'lib', 'vaultRestorePipeline.ts');

describe('K-253 local backup manifest diagnostic harness integration closure audit', () => {
  it('documents closure scope and non-goals', () => {
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      'K-253 Local Backup Manifest Diagnostic Harness Integration Closure Audit',
      'K-253 closes the K-248 through K-252 diagnostic harness hardening line.',
      'K-253 is docs/audit plus audit test only.',
      'K-253 does not change helper behavior',
      'K-253 does not expose diagnostics',
      'K-253 does not add runtime wiring',
      'K-253 does not change ZIP output',
      'K-253 does not change `manifest.json`',
      'K-253 does not add sidecar output',
      'K-253 does not change export result shape',
      'K-253 does not change import/restore validation',
      'K-253 does not implement export preflight behavior',
      '## Non-Goals',
      'no helper behavior change in K-253',
      'no backupKind allowlist expansion',
      'no scopeLevel allowlist expansion',
      'no diagnostic exposure',
      'no UI implementation',
      'no developer console/logging implementation',
      'no ZIP output change',
      'no `manifest.json` replacement/change',
      'no ZIP sidecar',
      'no export preflight implementation',
      'no Google Drive QA work',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('documents current state and consolidated summary contract', () => {
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      '## Current State Summary',
      'K-248 diagnostic harness/helper exists',
      'The backupKind redaction patch is merged and closed by K-249.',
      'K-250 planned integration boundaries.',
      'K-251 scopeLevel redaction patch is merged.',
      'K-252 closed scopeLevel redaction.',
      'The helper remains pure/isolated.',
      'The helper is not runtime-wired.',
      'Diagnostic output is not shown in UI.',
      'Diagnostic output is not logged.',
      'Diagnostic output is not written to ZIP.',
      'Diagnostic output is not written to `manifest.json`.',
      'Diagnostic output is not sidecar output.',
      'Diagnostic output is not returned in export result shape.',
      'Diagnostic output is not connected to import/restore validation.',
      'Local runtime data remains source of truth.',
      'Remote systems remain support layers.',
      '## Consolidated Summary Contract Audit',
      'harness summary is redacted category/count-only.',
      '`diagnostic-manifest`',
      '`core-data`',
      '`unknown`',
      '`0`',
      '`1`',
      '`unknown` is the fallback for unsupported/future/adversarial values.',
      'no raw user content is returned.',
      'no raw note content is returned.',
      'no raw attachment content is returned.',
      'no raw manifest payload is returned.',
      'no token/secret/provider credential values are returned.',
      'no blob/data URL payloads are returned.',
      'no path/stack/raw-looking diagnostic strings are returned.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('documents backupKind, scopeLevel, and future-scope closure audits', () => {
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      '## backupKind Closure Audit',
      '`diagnostic-manifest` remains allowed.',
      '`core-data` remains allowed.',
      '`full-content-metadata` becomes `unknown`.',
      '`full-content-with-blobs` becomes `unknown`.',
      '`provider-aware-recovery` becomes `unknown`.',
      'arbitrary/adversarial backupKind values become `unknown`.',
      'raw backupKind echo path remains closed.',
      'K-251/K-252 did not regress backupKind behavior.',
      '## scopeLevel Closure Audit',
      'numeric `0` remains allowed.',
      'numeric `1` remains allowed.',
      'string `"0"` and `"1"` are rejected.',
      'numeric `2` becomes `unknown`.',
      'numeric `3` becomes `unknown`.',
      'numeric `4` becomes `unknown`.',
      'negative numbers become `unknown`.',
      'NaN/Infinity become `unknown`.',
      'string/object/array/null/undefined values become `unknown`.',
      'malformed/adversarial scopeLevel values become `unknown`.',
      'raw scopeLevel echo path remains closed.',
      '## Future-Scope Non-Claim Audit',
      'current harness summary does not claim Level 2.',
      'current harness summary does not claim Level 3.',
      'current harness summary does not claim Level 4.',
      'current harness summary does not claim `full-content-metadata` support.',
      'current harness summary does not claim `full-content-with-blobs` support.',
      'current harness summary does not claim `provider-aware-recovery` support.',
      'current harness summary does not claim attachment blob export.',
      'current harness summary does not claim provider-aware recovery.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('documents helper purity, visibility wiring, export/import/ZIP, and security boundaries', () => {
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
      'no public API exposure.',
      'no ZIP artifact exposure.',
      'no `manifest.json` exposure.',
      'no sidecar exposure.',
      'no import/restore validation connection.',
      'no export preflight behavior.',
      'no runtime blocking behavior.',
      '## Export/Import/ZIP Boundary Audit',
      '`exportVaultBackup` behavior unchanged.',
      'ZIP output unchanged.',
      '`manifest.json` unchanged.',
      'sidecar absent.',
      'export result shape unchanged.',
      '`importVaultBackup` unchanged.',
      '`vaultRestorePipeline` unchanged.',
      '`backupBeforeRestore` unchanged.',
      'no restore/import mutation.',
      'no restore validation connection.',
      '## Security/Privacy Audit',
      'backupKind raw input redaction is fixed.',
      'scopeLevel raw input redaction is fixed.',
      'key-level forbidden guard remains if applicable.',
      'value-level secret guard remains if applicable.',
      'nested arrays/objects are recursively inspected where applicable.',
      'raw adversarial values do not appear in summary output.',
      'errors/warnings do not leak raw backupKind or scopeLevel.',
      'no real secrets in tests.',
      'no credentials/tokens/secrets are introduced.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('documents attachment/provider boundary, test coverage, K-254 decision, and closure statement', () => {
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
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
      '## Test Coverage Audit',
      'allowed backupKind values are tested.',
      'future/adversarial backupKind values are tested as unknown.',
      'allowed scopeLevel values are tested.',
      'string `"0"` / `"1"` rejection is tested by K-253 audit coverage.',
      'future scopeLevel values 2 / 3 / 4 are tested as unknown.',
      'malformed/adversarial scopeLevel values are tested.',
      'raw values are absent from stringified summary output.',
      'related local backup diagnostic tests still pass.',
      '## K-254 Decision',
      'K-254 Local Backup Export Preflight Diagnostic Boundary Plan',
      'docs/plan only.',
      'decide whether the redacted diagnostic harness should inform export preflight checks.',
      'no implementation.',
      'no UI.',
      'no logging.',
      'no ZIP/manifest output.',
      'no export result shape change.',
      'no import/restore validation.',
      'K-254 Local Backup Manifest Developer Harness Plan',
      'K-254 Local Backup Manifest Diagnostic Harness Test Hardening',
      'Not recommended yet:',
      'user-facing UI.',
      'logging/console output.',
      'export result metadata.',
      'ZIP sidecar.',
      '`manifest.json` extension.',
      'import/restore validation.',
      '## Closure Statement',
      'K-253 closes the K-248 through K-252 diagnostic harness hardening line if audit checks pass.',
      'The backupKind summary is redacted by allowlist.',
      'The scopeLevel summary is redacted by allowlist.',
      'Unsupported/future/adversarial values become `unknown`.',
      'The helper remains pure/isolated and not runtime-wired.',
      'Diagnostics remain unexposed to UI/logs/ZIP/manifest/export result/import/restore.',
      'Any future preflight, visibility, or integration requires a separate plan.',
      'Local runtime data remains source of truth.',
      'Remote systems remain support layers.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('confirms backupKind and scopeLevel redaction coverage remains present in source and behavior', () => {
    const harness = readFileSync(harnessPath, 'utf8');
    const harnessTest = readFileSync(harnessTestPath, 'utf8');

    expect(harness).toContain("export type LocalBackupManifestDiagnosticSummaryBackupKind = 'diagnostic-manifest' | 'core-data' | 'unknown';");
    expect(harness).toContain("export type LocalBackupManifestDiagnosticSummaryScopeLevel = 0 | 1 | 'unknown';");
    expect(harness).toContain('function sanitizeBackupKindForSummary(value: unknown)');
    expect(harness).toContain('function sanitizeScopeLevelForSummary(value: unknown)');
    expect(harness).toContain("if (value === 'diagnostic-manifest' || value === 'core-data') return value;");
    expect(harness).toContain('if (value === 0 || value === 1) return value;');
    expect(harness).toContain('backupKind: sanitizeBackupKindForSummary(input.manifest?.backupKind)');
    expect(harness).toContain('scopeLevel: sanitizeScopeLevelForSummary(input.manifest?.scopeLevel)');
    expect(harness).not.toContain('backupKind: input.manifest?.backupKind');
    expect(harness).not.toContain('scopeLevel: input.manifest?.scopeLevel');

    for (const required of [
      "summaryForBackupKind('diagnostic-manifest')",
      "summaryForBackupKind('core-data')",
      "'full-content-metadata'",
      "'full-content-with-blobs'",
      "'provider-aware-recovery'",
      "expect(summary.scopeSummary.backupKind).toBe('unknown')",
      'summaryForScopeLevel(0)',
      'summaryForScopeLevel(1)',
      '2,',
      '3,',
      '4,',
      "'0'",
      "'arbitrary-scope-level'",
      "expect(summary.scopeSummary.scopeLevel).toBe('unknown')",
    ]) {
      expect(harnessTest).toContain(required);
    }

    expect(createLocalBackupManifestDiagnosticSummary({ manifest: { scopeLevel: '0' } }).scopeSummary.scopeLevel).toBe('unknown');
    expect(createLocalBackupManifestDiagnosticSummary({ manifest: { scopeLevel: '1' } }).scopeSummary.scopeLevel).toBe('unknown');
  });

  it('confirms K-253 did not wire the harness into export, ZIP, import, or restore output paths', () => {
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
      expect(source).not.toContain('exportPreflightDiagnostic');
    }
  });
});
