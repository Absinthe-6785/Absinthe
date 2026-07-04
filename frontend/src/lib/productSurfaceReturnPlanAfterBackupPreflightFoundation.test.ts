import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const docPath = join(
  process.cwd(),
  'docs',
  'K-262-product-surface-return-plan-after-backup-preflight-foundation.md',
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

describe('K-262 product surface return plan after backup preflight foundation', () => {
  it('documents K-262 title, planning status, audit-test-only scope, low risk, and no runtime changes', () => {
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      'K-262 Product Surface Return Plan after Backup Preflight Foundation',
      'Status: product/UI planning.',
      'Scope: docs/plan plus audit test only.',
      'Risk: Low.',
      'K-262 plans the return from backup/preflight internals to product/UI surface work.',
      'K-262 makes no runtime behavior changes',
      'does not implement UI',
      'does not add routes',
      'does not change Notes/Cosmos runtime behavior',
      'does not change backup/export/import/restore runtime behavior',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('documents K-235 through K-261 backup/preflight foundation closure and K-261 decision', () => {
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      'K-235 through K-261 safely closed the local backup/preflight diagnostic foundation.',
      'local-first backup/restore boundary.',
      'manifest generator/validator foundation.',
      'output-neutral export diagnostic hook.',
      'redacted diagnostic harness.',
      'backupKind and scopeLevel redaction.',
      'dev/test-only preflight diagnostic harness.',
      'export-adjacent metadata adapter.',
      'preflight foundation closure decision.',
      'K-261 decided:',
      'backup/preflight foundation is stable enough to pause.',
      'production export preflight runtime is deferred.',
      'export blocking is deferred.',
      'restore preview/dry-run is deferred.',
      'attachment blob backup is deferred.',
      'provider-aware recovery is deferred.',
      'Data Safety / Backup Health UI is deferred.',
      'product/UI surface return is recommended.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('documents product/UI surface return decision and recommended direction without deeper backup runtime wiring', () => {
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      'The next direction is product/UI surface planning, not deeper backup runtime wiring.',
      'K-262 does not begin runtime implementation.',
      'Notes/Cosmos surface planning.',
      'Cosmos navigation and visual grammar planning.',
      'product surface information architecture.',
      'Pixel/Cosmos design grammar carry-forward.',
      'This remains planning only.',
      'K-262 does not change runtime UI, Notes/Cosmos behavior, navigation, routes, panels, storage, backup runtime, or import/restore behavior.',
      'which product surface to improve first.',
      'what user-facing concept should be visible.',
      'how Cosmos/pixel grammar should be applied.',
      'what remains static preview vs runtime.',
      'what implementation milestone should follow.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('documents backup guardrails carry-forward', () => {
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      'Product/UI work must preserve:',
      'local-first source of truth.',
      'no destructive whole-vault restore as default.',
      'no raw token/secret/content/blob leakage.',
      'no silent provider/blob behavior changes.',
      'no ZIP/manifest/export shape changes without explicit migration plan.',
      'no production preflight blocking without explicit UX/product plan.',
      'no restore/import behavior changes without dry-run/preview plan.',
      'no Data Safety UI claims before separate plan.',
      'no backup safety claims that exceed implemented behavior.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('documents product/UI non-goals and deferred backup lines', () => {
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      'K-262 does not implement:',
      'runtime UI.',
      'routes.',
      'Notes/Cosmos navigation changes.',
      'Notes/Cosmos runtime behavior changes.',
      'panels.',
      'backup UI.',
      'Data Safety / Backup Health UI.',
      'production preflight wiring.',
      'export/import/restore behavior.',
      'provider/blob behavior.',
      'persistence/network behavior.',
      'The following remain deferred and require separate plans before implementation:',
      'production export preflight runtime wiring.',
      'export blocking.',
      'restore preview/dry-run.',
      'import/restore validation.',
      'restore blocking.',
      'attachment blob backup.',
      'provider-aware recovery.',
      '`attachmentMetadataOnly` warning escalation.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('documents K-263 as product/UI planning, not backup runtime wiring', () => {
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      'K-263: Notes/Cosmos Product Surface Planning after Backup Foundation.',
      'K-263 should remain docs/plan only unless explicitly approved.',
      'K-263 should decide:',
      'which surface to improve first.',
      'what user-facing concept should be visible.',
      'how Cosmos/pixel grammar should be applied.',
      'what remains static preview vs runtime.',
      'what implementation milestone should follow.',
      'K-263 should be product/UI planning, not backup runtime wiring.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('confirms K-262 doc/test symbols are not referenced from backup runtime or preflight harness sources', () => {
    const sources = [
      readFileSync(exportSourcePath, 'utf8'),
      readFileSync(zipSourcePath, 'utf8'),
      readFileSync(importSourcePath, 'utf8'),
      readFileSync(restoreSourcePath, 'utf8'),
      readFileSync(adjacentAdapterPath, 'utf8'),
      readFileSync(preflightHarnessPath, 'utf8'),
    ];

    for (const source of sources) {
      expect(source).not.toContain('productSurfaceReturnPlanAfterBackupPreflightFoundation');
      expect(source).not.toContain('K-262 Product Surface Return Plan');
      expect(source).not.toContain('product-surface-return-plan-after-backup-preflight-foundation');
      expect(source).not.toContain('K-263: Notes/Cosmos Product Surface Planning');
    }
  });

  it('confirms production export/import/restore sources do not call preflight harnesses or adapters', () => {
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
