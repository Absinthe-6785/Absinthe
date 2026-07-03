import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const docPath = join(
  process.cwd(),
  'docs',
  'K-257-local-backup-export-preflight-diagnostic-test-harness-closure-audit.md',
);
const preflightHarnessPath = join(
  process.cwd(),
  'src',
  'lib',
  'localBackupExportPreflightDiagnosticTestHarness.ts',
);
const preflightHarnessTestPath = join(
  process.cwd(),
  'src',
  'lib',
  'localBackupExportPreflightDiagnosticTestHarness.test.ts',
);
const exportSourcePath = join(process.cwd(), 'src', 'lib', 'exportVaultBackup.ts');
const zipSourcePath = join(process.cwd(), 'src', 'lib', 'vaultBackupZip.ts');
const importSourcePath = join(process.cwd(), 'src', 'lib', 'importVaultBackup.ts');
const restoreSourcePath = join(process.cwd(), 'src', 'lib', 'vaultRestorePipeline.ts');

describe('K-257 local backup export preflight diagnostic test harness closure audit', () => {
  it('documents closure scope and non-goals', () => {
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      'K-257 Local Backup Export Preflight Diagnostic Test Harness Closure Audit',
      'K-257 closes the K-256 dev/test-only preflight diagnostic test harness prototype.',
      'K-257 is docs/audit plus audit test only.',
      'K-257 does not change helper behavior',
      'K-257 does not change preflight behavior',
      'K-257 does not wire preflight into production export runtime',
      'K-257 does not expose diagnostics',
      'K-257 does not add UI/logging implementation',
      'K-257 does not change ZIP output',
      'K-257 does not change `manifest.json`',
      'K-257 does not add sidecar output',
      'K-257 does not change export result shape',
      'K-257 does not change import/restore validation',
      'K-257 chooses the K-258 next path',
      '## Non-Goals',
      'no helper behavior change in K-257',
      'no preflight behavior change',
      'no production export runtime wiring',
      'no diagnostic exposure',
      'no UI implementation',
      'no developer console/logging implementation',
      'no export result shape change',
      'no public API change',
      'no ZIP output change',
      'no `manifest.json` replacement/change',
      'no Google Drive QA work',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('documents current state and helper purity', () => {
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      '## Current State Summary',
      'K-244 output-neutral export diagnostic hook exists and remains internal/ignored.',
      'K-245 closed the hook.',
      'K-248 diagnostic harness/helper exists.',
      'backupKind redaction is closed.',
      'scopeLevel redaction is closed.',
      'K-253 closed consolidated harness hardening.',
      'K-254 selected dev/test-only preflight first.',
      'K-255 planned the test harness.',
      'K-256 implemented the pure/dev-test-only prototype.',
      'diagnostic summary remains category/count-only.',
      'backupKind is `diagnostic-manifest` / `core-data` / `unknown`.',
      'scopeLevel is numeric `0` / `1` / `unknown`.',
      'Level 2 / 3 / 4 remain unsupported.',
      'preflight helper is not production export runtime wired.',
      'preflight result is not shown in UI.',
      'preflight result is not logged.',
      'preflight result is not written to ZIP.',
      'preflight result is not written to `manifest.json`.',
      'preflight result is not sidecar output.',
      'preflight result is not returned in export result shape.',
      'preflight result is not connected to import/restore validation.',
      'local runtime data remains source of truth.',
      'remote systems remain support layers.',
      '## Helper Purity And Scope Audit',
      'helper accepts synthetic fixture input.',
      'helper does not read live runtime data.',
      'helper does not call production export automatically.',
      'helper does not mutate input.',
      'helper does not write files.',
      'helper does not create ZIPs.',
      'helper does not use IndexedDB/localStorage.',
      'helper does not call fetch/network.',
      'helper does not import Supabase/Google Drive/OAuth.',
      'helper does not move/copy/delete/upload/download attachment blobs.',
      'helper does not import UI/route/navigation modules.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('documents summary reuse, output shape, status semantics, and lifecycle flags', () => {
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      '## Diagnostic Summary Reuse Audit',
      'helper reuses `createLocalBackupManifestDiagnosticSummary`.',
      'helper does not duplicate redaction logic unnecessarily.',
      'backupKind sanitizer remains preserved.',
      'scopeLevel sanitizer remains preserved.',
      'category/count-only output remains preserved.',
      'unsupported/future/adversarial values become `unknown`.',
      'no Level 2/3/4 support is claimed.',
      '## Output Shape Audit',
      'status shape is redacted.',
      'status values are `pass` / `warning` / `hard-fail`.',
      'summary is category/count-only.',
      'hard failures are category-only codes.',
      'warnings are category-only codes.',
      'metadata/lifecycle flags are explicit.',
      'no raw diagnostic messages.',
      'no raw user content.',
      'no raw note content.',
      'no raw attachment content.',
      'no raw manifest JSON.',
      'no raw backupKind unknown values.',
      'no raw scopeLevel malformed values.',
      'no path/stack output.',
      'no tokens/secrets/provider credentials.',
      '## Status Semantics Audit',
      'blocked maps to hard-fail.',
      'warning categories produce warning status.',
      'warnings do not pass.',
      'pass requires no hard failures and no warnings.',
      'hard failures remain privacy/security/scope-escalation category-only.',
      'warnings remain category/count-only and non-blocking.',
      'production blocking is not implemented.',
      '## Lifecycle Flags Audit',
      'persisted is `false`.',
      'artifactWritten is `false`.',
      'exportRuntimeWired is `false`.',
      'result is ephemeral.',
      'result is not stored in IndexedDB.',
      'result is not stored in localStorage.',
      'result is not written to files.',
      'result is not written to logs.',
      'result is not written to backup artifacts.',
      'result is not returned from production export.',
      'result is not stored in app state.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('documents visibility, export/import/ZIP, security, and attachment/provider boundaries', () => {
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      '## Visibility/Wiring Audit',
      'no UI exposure.',
      'no console logging.',
      'no logger output.',
      'no developer panel exposure.',
      'no maintenance UI.',
      'no export modal changes.',
      'no export result shape exposure.',
      'no public API exposure.',
      'no ZIP artifact exposure.',
      'no `manifest.json` exposure.',
      'no sidecar exposure.',
      'no import/restore validation connection.',
      'no production export runtime wiring.',
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
      'per-item `skip`, `duplicate`, and `replace` remains distinct from destructive whole-vault restore.',
      '## Security/Privacy Audit',
      'backupKind raw input redaction remains fixed.',
      'scopeLevel raw input redaction remains fixed.',
      'hard failures/warnings are category-only.',
      'raw adversarial values do not appear in output.',
      'errors/warnings do not leak raw backupKind or scopeLevel.',
      'no real secrets in tests.',
      'fake test values are limited to tests/docs.',
      'no credentials/tokens/secrets are introduced.',
      'no raw diagnostic/message/content/blob/path/stack leakage is allowed.',
      '## Attachment/Provider Boundary',
      'no attachment blob export claim.',
      'no Level 3 support claim.',
      '`full-content-with-blobs` remains unsupported.',
      '`provider-aware-recovery` remains unsupported.',
      'no blob movement/copy/upload/download.',
      'no attachment sync change.',
      'no Supabase behavior change.',
      'no Google Drive/OAuth behavior change.',
      'Google Drive appDataFolder QA remains separate and externally blocked.',
      'no Google Drive QA work.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('documents test coverage, K-258 recommendation, and closure statement', () => {
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      '## Test Coverage Audit',
      'synthetic pass fixture tested.',
      'synthetic warning fixture tested.',
      'synthetic hard-fail fixture tested.',
      'blocked => hard-fail tested.',
      'warnings do not pass tested.',
      'backupKind redaction tested or inherited from summary helper tests.',
      'scopeLevel redaction tested or inherited from summary helper tests.',
      'raw values absent from stringified output tested.',
      'lifecycle flags false tested.',
      'no mutation tested.',
      'no production export/import/ZIP wiring tested or source-audited.',
      'typecheck/build status is expected to pass for K-257.',
      'No blocking coverage gap remains for the K-256 dev/test-only preflight diagnostic test harness prototype.',
      '## K-258 Decision',
      'K-258 Local Backup Export-adjacent Preflight Integration Boundary Plan',
      'docs/plan only.',
      'decide whether export-adjacent metadata can be fed into the test-only preflight harness.',
      'no production runtime wiring.',
      'no UI/logging.',
      'no ZIP/manifest/output changes.',
      'no import/restore validation.',
      'K-258 Pause Backup Safety Line / Product Surface Return Note',
      'K-258 Local Backup Export Preflight Diagnostic Test Harness Hardening',
      'Not recommended yet:',
      'production export preflight.',
      'user-facing UI.',
      'logging/console output.',
      'export result metadata.',
      'ZIP sidecar.',
      '`manifest.json` extension.',
      'import/restore validation.',
      '## Closure Statement',
      'K-257 closes the K-256 dev/test-only preflight diagnostic test harness prototype if audit checks pass.',
      'The helper remains pure/dev-test-only.',
      'Output remains redacted category/count-only.',
      'Lifecycle flags remain false.',
      'Diagnostics remain unexposed to UI/logs/ZIP/manifest/export result/import/restore.',
      'Production export preflight, export-adjacent integration, UI, visibility, or artifact evolution requires a separate milestone.',
      'Local runtime data remains source of truth.',
      'Remote systems remain support layers.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('confirms K-256 source keeps the helper pure and dev/test-only', () => {
    const source = readFileSync(preflightHarnessPath, 'utf8');

    expect(source).toContain('createLocalBackupManifestDiagnosticSummary');
    expect(source).toContain("return status === 'blocked' ? 'hard-fail' : status;");
    expect(source).toContain("generatedFor: 'test-harness'");
    expect(source).toContain('persisted: false');
    expect(source).toContain('artifactWritten: false');
    expect(source).toContain('exportRuntimeWired: false');

    for (const forbidden of [
      'from ' + "'./exportVaultBackup'",
      'from ' + "'./vaultBackupZip'",
      'from ' + "'./importVaultBackup'",
      'from ' + "'./vaultRestorePipeline'",
      'from ' + "'@/store/",
      'from ' + "'@/components/",
      'from ' + "'react'",
      'from ' + "'react-router",
      'localStorage',
      'indexedDB',
      'fetch(',
      'JSZip',
      'Supabase',
      'Google' + 'Drive',
      'O' + 'Auth',
      'putBlob',
      'getBlob',
      'deleteBlob',
      'console.log',
      'console.warn',
      'console.error',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it('confirms K-256 tests cover status semantics, redaction, lifecycle flags, no mutation, and no logging', () => {
    const testSource = readFileSync(preflightHarnessTestPath, 'utf8');

    for (const required of [
      "expect(summary.status).toBe('warning')",
      "expect(summary.status).toBe('hard-fail')",
      "expect(summary.counts).toEqual({ hardFailures: 3, warnings: 1 })",
      "expect(summary.summary.backupKind).toBe('unknown')",
      "expect(summary.summary.scopeLevel).toBe('unknown')",
      "persisted: false",
      "artifactWritten: false",
      "exportRuntimeWired: false",
      "expect(serialized(input)).toBe(before)",
      "expect(logSpy).not.toHaveBeenCalled()",
      "expect(warnSpy).not.toHaveBeenCalled()",
      "expect(errorSpy).not.toHaveBeenCalled()",
      "expect(output).not.toContain(forbidden)",
      'no production export runtime wiring',
      'no `manifest.json` change',
    ]) {
      expect(testSource).toContain(required);
    }
  });

  it('confirms K-257 did not wire the preflight harness into export, ZIP, import, or restore paths', () => {
    const outputSources = [
      readFileSync(exportSourcePath, 'utf8'),
      readFileSync(zipSourcePath, 'utf8'),
      readFileSync(importSourcePath, 'utf8'),
      readFileSync(restoreSourcePath, 'utf8'),
    ];

    for (const source of outputSources) {
      expect(source).not.toContain('localBackupExportPreflightDiagnosticTestHarness');
      expect(source).not.toContain('createLocalBackupExportPreflightDiagnosticTestHarnessSummary');
      expect(source).not.toContain('local-backup-export-preflight-diagnostic-summary.json');
      expect(source).not.toContain('preflight-diagnostic-summary.json');
    }
  });
});
