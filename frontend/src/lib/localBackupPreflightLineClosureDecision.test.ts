import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const docPath = join(
  process.cwd(),
  'docs',
  'K-261-local-backup-preflight-line-closure-and-product-surface-return-decision.md',
);
const exportSourcePath = join(process.cwd(), 'src', 'lib', 'exportVaultBackup.ts');
const zipSourcePath = join(process.cwd(), 'src', 'lib', 'vaultBackupZip.ts');
const importSourcePath = join(process.cwd(), 'src', 'lib', 'importVaultBackup.ts');
const restoreSourcePath = join(process.cwd(), 'src', 'lib', 'vaultRestorePipeline.ts');
const adjacentAdapterPath = join(
  process.cwd(),
  'src',
  'lib',
  'localBackupExportAdjacentPreflightTestHarness.ts',
);
const preflightHarnessPath = join(
  process.cwd(),
  'src',
  'lib',
  'localBackupExportPreflightDiagnosticTestHarness.ts',
);

describe('K-261 local backup preflight line closure and product surface return decision', () => {
  it('documents title, status, scope, risk, and no runtime behavior changes', () => {
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      'K-261 Local Backup Preflight Line Closure and Product Surface Return Decision',
      'Status: decision / closure.',
      'Scope: docs/decision plus audit test only.',
      'Risk: Low.',
      'K-261 makes no runtime behavior changes.',
      'Production export preflight runtime wiring is deferred.',
      'The recommended next direction is returning to product/UI surface work',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('documents K-235 through K-260 completed line summary grouped by milestone phase', () => {
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      'K-235 through K-260 now form the completed local backup/preflight diagnostic foundation.',
      '### Boundary/spec foundation',
      'K-235 defined local-first backup/restore boundaries.',
      'K-236 defined the local-first backup manifest spec.',
      'K-237 added the manifest audit fixture spec.',
      'K-238 added the manifest generator/validator prototype with privacy/security validation.',
      'K-239 audited the manifest integration boundary.',
      'K-240 planned export integration.',
      '### Export diagnostic hook',
      'K-241 added the output-neutral export diagnostic helper.',
      'K-242 closed the export diagnostic wiring boundary.',
      'K-243 planned the export diagnostic hook.',
      'K-244 added the output-neutral export diagnostic hook.',
      'K-245 closed the hook.',
      '### Diagnostic visibility/harness',
      'K-246 planned diagnostic visibility.',
      'K-247 planned the diagnostic harness.',
      'K-248 added the redacted diagnostic harness prototype.',
      'K-249 closed K-248.',
      'K-250 planned the harness integration boundary.',
      'K-251 added scopeLevel redaction.',
      'K-252 closed scopeLevel redaction.',
      'K-253 closed the K-248 through K-252 hardening line.',
      '### Export preflight planning/prototype',
      'K-254 planned the export preflight diagnostic boundary.',
      'K-255 planned the export preflight diagnostic test harness.',
      'K-256 added the pure dev/test-only preflight diagnostic harness.',
      'K-257 closed K-256.',
      '### Export-adjacent preflight adapter',
      'K-258 planned the export-adjacent preflight integration boundary.',
      'K-259 added the pure test/dev-only export-adjacent metadata fixture adapter.',
      'K-260 closed K-259 and documented `attachmentMetadataOnly` as informational current behavior.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('documents current capability and explicit non-goals', () => {
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      'local-first backup/restore boundary documentation.',
      'manifest generator/validator foundation.',
      'output-neutral export diagnostic hook.',
      'redacted diagnostic summary harness.',
      'backupKind and scopeLevel redaction.',
      'dev/test-only preflight diagnostic harness.',
      'export-adjacent metadata fixture adapter.',
      'source/import boundary audit coverage.',
      'no raw value leakage policy.',
      'no production runtime wiring.',
      'K-261 does not implement:',
      'production export preflight runtime wiring.',
      'export blocking.',
      'user-facing UI.',
      'console logging.',
      'default log writing.',
      'ZIP sidecar.',
      '`manifest.json` mutation.',
      'export result shape change.',
      'import/restore validation.',
      'restore preview/dry-run.',
      'restore blocking.',
      'attachment blob backup.',
      'provider-aware recovery.',
      'Supabase/Google Drive/OAuth behavior.',
      'persistence/network/blob behavior.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('documents deferred future lines and separate-plan requirement', () => {
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      'Each future line requires a separate plan before implementation.',
      '### Production export preflight runtime wiring',
      'Production export preflight runtime wiring is deferred.',
      '### Restore preview / dry-run safety',
      'Restore preview/dry-run safety is deferred.',
      '### Attachment blob backup policy',
      'Attachment blob backup is deferred.',
      '### Data Safety / Backup Health UI',
      'User-facing Data Safety / Backup Health UI is deferred.',
      'Any new UI that references backup safety must remain informational unless separately scoped.',
      '### Provider-aware recovery',
      'Provider-aware recovery is deferred.',
      '### attachmentMetadataOnly warning escalation',
      '`attachmentMetadataOnly` warning escalation is deferred.',
      'The current behavior remains informational.',
      'Any future change that makes it warning-producing must be separately scoped and tested.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('documents product/UI surface return decision and safety guardrail carry-forward', () => {
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      'The backup/preflight safety foundation is stable enough to pause.',
      'The recommended next direction is product/UI surface work.',
      'Product/UI work must not weaken backup/preflight guardrails.',
      'Any new UI that references backup safety must remain informational unless separately scoped.',
      'content-first workspace flow.',
      'calm desktop-first surfaces.',
      'Notes/Cosmos clarity.',
      'no backup runtime expansion unless explicitly planned.',
      'Future work must preserve:',
      'local-first source of truth.',
      'no destructive whole-vault restore as default.',
      'no raw token/secret/content/blob leakage.',
      'no silent provider/blob behavior changes.',
      'no ZIP/manifest/export shape changes without explicit migration plan.',
      'no production preflight blocking without explicit UX/product plan.',
      'no restore/import behavior changes without dry-run/preview plan.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('documents runtime boundary confirmation and K-262 product/UI recommendation', () => {
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      'K-261 does not:',
      'call `exportVaultBackup`.',
      'call ZIP writers.',
      'call `importVaultBackup`.',
      'call `vaultRestorePipeline`.',
      'call the K-256 preflight harness from export runtime.',
      'call the K-259 export-adjacent adapter from export runtime.',
      'read/write localStorage.',
      'read/write IndexedDB.',
      'call fetch/network/provider APIs.',
      'read attachment blob payloads.',
      'expose diagnostics to UI/logs/ZIP/manifest/export result/import/restore.',
      'K-262: Product Surface Return Plan after Backup Preflight Foundation.',
      'K-262: Notes/Cosmos Product Surface Planning after Backup Preflight Closure.',
      'K-262 should be product/UI-focused, not backup runtime wiring.',
      'K-262 should be docs/plan only unless explicitly approved.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('confirms K-261 symbols are not referenced from runtime export, ZIP, import, restore, or harness sources', () => {
    const sources = [
      readFileSync(exportSourcePath, 'utf8'),
      readFileSync(zipSourcePath, 'utf8'),
      readFileSync(importSourcePath, 'utf8'),
      readFileSync(restoreSourcePath, 'utf8'),
      readFileSync(adjacentAdapterPath, 'utf8'),
      readFileSync(preflightHarnessPath, 'utf8'),
    ];

    for (const source of sources) {
      expect(source).not.toContain('localBackupPreflightLineClosureDecision');
      expect(source).not.toContain('K-261 Local Backup Preflight Line Closure');
      expect(source).not.toContain('Product Surface Return Decision');
      expect(source).not.toContain('local-backup-preflight-line-closure');
      expect(source).not.toContain('K-262: Product Surface Return Plan');
    }
  });

  it('confirms production export/import/restore sources do not call K-256 or K-259 preflight helpers', () => {
    const runtimeSources = [
      readFileSync(exportSourcePath, 'utf8'),
      readFileSync(zipSourcePath, 'utf8'),
      readFileSync(importSourcePath, 'utf8'),
      readFileSync(restoreSourcePath, 'utf8'),
    ];

    for (const source of runtimeSources) {
      expect(source).not.toContain('localBackupExportAdjacentPreflightTestHarness');
      expect(source).not.toContain('createLocalBackupExportAdjacentPreflightTestHarnessSummary');
      expect(source).not.toContain('localBackupExportPreflightDiagnosticTestHarness');
      expect(source).not.toContain('createLocalBackupExportPreflightDiagnosticTestHarnessSummary');
      expect(source).not.toContain('preflight-diagnostic-summary.json');
      expect(source).not.toContain('local-backup-export-preflight-diagnostic-summary.json');
      expect(source).not.toContain('local-backup-export-adjacent-preflight-summary.json');
    }
  });
});
