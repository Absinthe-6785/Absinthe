import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const docPath = join(
  process.cwd(),
  'docs',
  'K-258-local-backup-export-adjacent-preflight-integration-boundary-plan.md',
);
const exportSourcePath = join(process.cwd(), 'src', 'lib', 'exportVaultBackup.ts');
const zipSourcePath = join(process.cwd(), 'src', 'lib', 'vaultBackupZip.ts');
const importSourcePath = join(process.cwd(), 'src', 'lib', 'importVaultBackup.ts');
const restoreSourcePath = join(process.cwd(), 'src', 'lib', 'vaultRestorePipeline.ts');

describe('K-258 local backup export-adjacent preflight integration boundary plan', () => {
  it('documents plan-only scope and current state', () => {
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      'K-258 Local Backup Export-adjacent Preflight Integration Boundary Plan',
      'K-258 plans the boundary for future export-adjacent preflight integration.',
      'K-258 is docs/plan plus audit test only.',
      'K-258 does not implement export-adjacent preflight integration',
      'K-258 does not wire preflight into production export runtime',
      'K-258 does not expose diagnostics',
      'K-258 does not add UI/logging',
      'K-258 does not change ZIP/manifest/export/import/restore behavior',
      'K-258 chooses the K-259 next path',
      '## Current State Summary',
      'K-256 implemented the pure/dev-test-only preflight diagnostic harness prototype.',
      'K-257 closed the K-256 prototype.',
      'diagnostic summary remains category/count-only.',
      'backupKind is `diagnostic-manifest` / `core-data` / `unknown`.',
      'scopeLevel is numeric `0` / `1` / `unknown`.',
      'Level 2 / 3 / 4 remain unsupported.',
      'preflight helper is not production export runtime wired.',
      'preflight result is not written to ZIP.',
      'preflight result is not written to `manifest.json`.',
      'preflight result is not sidecar output.',
      'preflight result is not returned in export result shape.',
      'preflight result is not connected to import/restore validation.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('documents the boundary choice and allowed export-adjacent metadata categories', () => {
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      '## Boundary Choice',
      'export-adjacent metadata may be used only in explicit dev/test harness contexts first.',
      'no automatic production export runtime.',
      'no user-facing preflight yet.',
      'no logging/visibility yet.',
      'no export blocking yet.',
      'no import/restore validation yet.',
      '## Allowed Export-adjacent Metadata',
      'manifest-level counts.',
      'note/folder/relation counts.',
      'diagnostic status category/counts.',
      'allowlisted backupKind.',
      'allowlisted scopeLevel.',
      'attachment metadata-only flags.',
      'compatibility warning counts/categories.',
      'lifecycle flags.',
      'Allowed metadata must be explicitly constructed in tests or dev/test harness code.',
      'It must not require live export runtime execution, live storage reads, network/provider calls, or attachment blob reads.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('documents forbidden raw values and output-neutrality requirements', () => {
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      '## Forbidden Export-adjacent Data',
      'raw note content.',
      'raw attachment blob payloads.',
      'raw manifest JSON.',
      'raw ZIP payloads.',
      'tokens.',
      'secrets.',
      'credentials.',
      'provider session data.',
      'sensitive paths.',
      'stack traces.',
      'raw warning/failure messages.',
      'raw file contents.',
      'live provider data.',
      'live storage dumps.',
      'OAuth/session material.',
      'Supabase session material.',
      'Unknown, malformed, future, or adversarial metadata values must become `unknown` or category-only summaries rather than raw output.',
      '## Output-neutrality Requirements',
      'ZIP output.',
      'ZIP `manifest.json`.',
      'sidecar output.',
      'export result shape.',
      'import behavior.',
      'restore behavior.',
      'provider/blob behavior.',
      'backup/export payloads.',
      '`VaultBackupManifest` shape.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('documents runtime, visibility, export/import/ZIP, and attachment/provider boundaries', () => {
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      '## Runtime Boundary',
      'production export auto-run.',
      'export blocking.',
      'UI.',
      'logs.',
      'console output.',
      'storage writes.',
      'network/provider calls.',
      'attachment blob reads.',
      'import/restore validation.',
      'restore blocking.',
      'background jobs.',
      'auto backup.',
      'The production export path may be inspected by tests for source boundaries',
      'the preflight harness must not be called from production export runtime in K-258 or K-259',
      '## Visibility Boundary',
      'no UI exposure.',
      'no developer panel exposure.',
      'no maintenance UI.',
      'no export modal changes.',
      'no notification/toast.',
      'no console logging.',
      'no logger output.',
      'no public API exposure.',
      'no route/navigation change.',
      '## Export/Import/ZIP Boundary',
      '`exportVaultBackup` behavior remains unchanged.',
      'ZIP output remains unchanged.',
      '`manifest.json` remains unchanged.',
      'sidecar remains absent.',
      'export result shape remains unchanged.',
      '`importVaultBackup` remains unchanged.',
      '`vaultRestorePipeline` remains unchanged.',
      '`backupBeforeRestore` remains unchanged.',
      'no restore/import mutation.',
      'no restore validation connection.',
      '## Attachment/Provider Boundary',
      'no attachment blob export claim.',
      'no Level 3 support claim.',
      '`full-content-with-blobs` remains unsupported.',
      '`provider-aware-recovery` remains unsupported.',
      'no blob movement/copy/upload/download.',
      'no attachment sync change.',
      'no Supabase behavior change.',
      'no Google Drive/OAuth behavior change.',
      'no Google Drive QA work.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('documents test-only integration shape, security boundary, K-259 recommendation, and non-goals', () => {
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      '## Test-only Integration Shape',
      'test-only fixture builder.',
      'explicit export-adjacent metadata object.',
      'no production export call.',
      'no export payload mutation.',
      'no import/restore call.',
      'no ZIP creation.',
      'no file write.',
      'no storage read/write.',
      'no network/provider/blob work.',
      'redacted category/count-only output.',
      'must not parse raw `manifest.json`, ZIP bytes, note bodies, attachment blobs, or provider sessions.',
      '## Security/Privacy Boundary',
      'hard failures remain category-only.',
      'warnings remain category/count-only.',
      'raw adversarial values must not appear in output.',
      'raw backupKind and scopeLevel values must not be echoed.',
      'no real credentials/tokens/secrets may be introduced.',
      'no raw diagnostic/message/content/blob/path/stack leakage is allowed.',
      'no raw file contents may be captured.',
      'no live storage dump may be captured.',
      'no provider session value may be captured.',
      '## K-259 Recommendation',
      'K-259 Local Backup Export-adjacent Preflight Test Harness Prototype',
      'test-only prototype.',
      'explicit export-adjacent metadata fixture builder.',
      'feed only allowed metadata into the existing test-only preflight harness.',
      'remain pure/test-only and output-neutral.',
      'no production export runtime wiring.',
      'no UI/logging.',
      'no ZIP/manifest/output changes.',
      'no import/restore validation.',
      'K-259 Local Backup Export-adjacent Preflight Boundary Closure Audit',
      'Not recommended yet:',
      'production export preflight.',
      'user-facing UI.',
      'logging/console output.',
      'export result metadata.',
      'ZIP sidecar.',
      '`manifest.json` extension.',
      'import/restore validation.',
      '## Non-Goals',
      'no export-adjacent preflight integration implementation in K-258.',
      'no helper behavior change.',
      'no production export runtime wiring.',
      'no diagnostic exposure.',
      'no UI implementation.',
      'no developer console/logging implementation.',
      'no export result shape change.',
      'no ZIP output change.',
      'no `manifest.json` replacement/change.',
      'no ZIP sidecar.',
      'no persistence/network/remote/blob behavior change.',
      'no package.json change.',
      'no vite config change.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('confirms K-258 did not wire preflight into export, ZIP, import, or restore paths', () => {
    const outputSources = [
      readFileSync(exportSourcePath, 'utf8'),
      readFileSync(zipSourcePath, 'utf8'),
      readFileSync(importSourcePath, 'utf8'),
      readFileSync(restoreSourcePath, 'utf8'),
    ];

    for (const source of outputSources) {
      expect(source).not.toContain('localBackupExportAdjacentPreflightIntegrationBoundaryPlan');
      expect(source).not.toContain('localBackupExportPreflightDiagnosticTestHarness');
      expect(source).not.toContain('createLocalBackupExportPreflightDiagnosticTestHarnessSummary');
      expect(source).not.toContain('local-backup-export-preflight-diagnostic-summary.json');
      expect(source).not.toContain('preflight-diagnostic-summary.json');
    }
  });
});
