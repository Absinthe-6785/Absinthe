import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createLocalBackupExportAdjacentPreflightTestHarnessSummary } from './localBackupExportAdjacentPreflightTestHarness';

const docPath = join(
  process.cwd(),
  'docs',
  'K-260-local-backup-export-adjacent-preflight-test-harness-closure-audit.md',
);
const adapterPath = join(
  process.cwd(),
  'src',
  'lib',
  'localBackupExportAdjacentPreflightTestHarness.ts',
);
const exportSourcePath = join(process.cwd(), 'src', 'lib', 'exportVaultBackup.ts');
const zipSourcePath = join(process.cwd(), 'src', 'lib', 'vaultBackupZip.ts');
const importSourcePath = join(process.cwd(), 'src', 'lib', 'importVaultBackup.ts');
const restoreSourcePath = join(process.cwd(), 'src', 'lib', 'vaultRestorePipeline.ts');

describe('K-260 local backup export-adjacent preflight test harness closure audit', () => {
  it('documents closure-only scope and K-259 helper boundary', () => {
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      'K-260 Local Backup Export-adjacent Preflight Test Harness Closure Audit',
      'K-260 is closure only.',
      'K-260 is docs/audit plus audit test only.',
      'K-260 does not change helper behavior',
      'K-260 does not change preflight behavior',
      'K-260 does not change export behavior',
      'K-259 adapter is pure/test-dev-only.',
      'K-259 adapter is deterministic.',
      'K-259 adapter is side-effect-free.',
      'K-259 adapter delegates to the existing K-256 harness.',
      'K-259 adapter calls `createLocalBackupExportPreflightDiagnosticTestHarnessSummary`.',
      'K-259 adapter does not duplicate or bypass backupKind redaction.',
      'K-259 adapter does not duplicate or bypass scopeLevel redaction.',
      'K-259 adapter does not duplicate or bypass status semantics.',
      'K-259 adapter does not duplicate or bypass lifecycle/output-neutrality flags.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('documents production wiring, visibility, export/import/ZIP, and persistence/provider boundaries', () => {
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      'no production export runtime wiring.',
      'no call from `exportVaultBackup`.',
      'no automatic export invocation.',
      'no export blocking.',
      'no UI.',
      'no route/navigation change.',
      'no console logging.',
      'no logger output.',
      'ZIP output remains unchanged.',
      'ZIP `manifest.json` remains unchanged.',
      'sidecar output remains absent.',
      'export result shape remains unchanged.',
      'import behavior remains unchanged.',
      'restore behavior remains unchanged.',
      '`importVaultBackup` remains unchanged.',
      '`vaultRestorePipeline` remains unchanged.',
      '`vaultBackupZip` remains unchanged.',
      'no persistence behavior change.',
      'no localStorage read/write.',
      'no IndexedDB read/write.',
      'no network call.',
      'no fetch call.',
      'no Supabase behavior change.',
      'no Google Drive/OAuth behavior change.',
      'no provider session access.',
      'no attachment blob repository access.',
      'no attachment blob reads.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('documents safe input boundary, forbidden raw values, and redacted output boundary', () => {
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      'Allowed safe export-adjacent metadata only:',
      'counts: noteCount, folderCount, relationCount.',
      'diagnostics: hardFailureCategories, warningCategories, hardFailureCount, warningCount.',
      'scope: allowlisted backupKind and allowlisted scopeLevel.',
      'attachments: metadataOnly and blobPayloadIncluded coerced to false.',
      'compatibility: warningCategories and warningCount.',
      'lifecycle: persisted false, artifactWritten false, exportRuntimeWired false.',
      'Forbidden raw values:',
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
      'K-259 returns the existing K-256 redacted preflight summary shape:',
      'status: `pass | warning | hard-fail`.',
      'hardFailures: category-only codes.',
      'warnings: category-only codes.',
      'Output remains category/count-only.',
      'No raw diagnostic values are returned.',
      'backupKind redaction is preserved.',
      'scopeLevel redaction is preserved.',
      'lifecycle flags remain false.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('documents attachmentMetadataOnly as informational current behavior and scopes future warning escalation separately', () => {
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      '## Attachment Metadata-only Note',
      '`attachmentMetadataOnly` may appear as an informational category.',
      '`attachmentMetadataOnly` can coexist with `warningCount: 0`.',
      '`attachmentMetadataOnly` can coexist with `status: pass`.',
      'K-260 documents this as informational metadata category behavior for now, not a warning and not a blocker.',
      'Any future change that makes `attachmentMetadataOnly` warning-producing must be separately scoped and tested.',
      'K-260 does not change this behavior.',
    ]) {
      expect(doc).toContain(required);
    }

    const summary = createLocalBackupExportAdjacentPreflightTestHarnessSummary({
      attachments: { metadataOnly: true, blobPayloadIncluded: false },
    });

    expect(summary.status).toBe('pass');
    expect(summary.counts.warnings).toBe(0);
    expect(summary.warnings).toContain('attachmentMetadataOnly');
    expect(summary.attachmentSummary).toEqual({
      metadataOnly: true,
      blobPayloadIncluded: false,
    });
  });

  it('documents test coverage and K-261 boundary-closure-or-pause recommendation', () => {
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      'K-260 audit coverage confirms:',
      'K-260 doc exists.',
      'closure-only scope is documented.',
      'K-259 helper purity is documented.',
      'K-259 delegates to K-256 harness.',
      'no production export wiring is documented and source-audited.',
      'no UI/logging is documented and source-audited.',
      'output-neutrality is documented.',
      'no ZIP/manifest/sidecar/export-shape/import/restore changes are documented and source-audited.',
      'no persistence/network/provider/blob behavior is documented and source-audited.',
      'allowed metadata and forbidden raw values are documented.',
      '`attachmentMetadataOnly` informational category behavior is documented.',
      'future warning escalation must be separately scoped.',
      'K-261 recommendation is boundary closure or pause decision, not production runtime.',
      'K-261 should be boundary closure or pause decision, not production runtime implementation.',
      'K-261 Local Backup Export-adjacent Preflight Integration Boundary Closure.',
      'K-261 Pause Backup Preflight Line / Product Surface Return Decision.',
      'Not recommended yet:',
      'production export preflight.',
      'production export runtime wiring.',
      'user-facing UI.',
      'logging/console output.',
      'export result metadata.',
      'ZIP sidecar.',
      '`manifest.json` extension.',
      'import/restore validation.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('confirms K-259 adapter imports only the K-256 harness and avoids runtime/source boundaries', () => {
    const source = readFileSync(adapterPath, 'utf8');

    expect(source).toContain('createLocalBackupExportPreflightDiagnosticTestHarnessSummary');
    expect(source).toContain("from './localBackupExportPreflightDiagnosticTestHarness'");
    expect(source).toContain('attachmentBlobPayloadIncluded: false');
    expect(source).toContain('Pure/dev-test-only export-adjacent metadata fixture adapter');

    for (const forbidden of [
      'from ' + "'./exportVaultBackup'",
      'exportVaultBackup',
      'buildVaultBackupManifestV3',
      'from ' + "'./vaultBackupZip'",
      'vaultBackupZip',
      'from ' + "'./importVaultBackup'",
      'importVaultBackup',
      'from ' + "'./vaultRestorePipeline'",
      'vaultRestorePipeline',
      'from ' + "'@/store/",
      'from ' + "'@/providers/",
      'from ' + "'@/components/",
      'from ' + "'react'",
      'from ' + "'react-router",
      'localStorage',
      'indexedDB',
      'fetch(',
      'JSZip',
      'Supabase',
      'supabase',
      'Google' + 'Drive',
      'googleDrive',
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

    expect(source).not.toMatch(/from\s+['"][^'"]*supabase/i);
    expect(source).not.toMatch(/from\s+['"][^'"]*provider/i);
    expect(source).not.toMatch(/from\s+['"][^'"]*attachment.*blob/i);
  });

  it('confirms K-260 did not wire K-259 into export, ZIP, import, or restore paths', () => {
    const outputSources = [
      readFileSync(exportSourcePath, 'utf8'),
      readFileSync(zipSourcePath, 'utf8'),
      readFileSync(importSourcePath, 'utf8'),
      readFileSync(restoreSourcePath, 'utf8'),
    ];

    for (const source of outputSources) {
      expect(source).not.toContain('localBackupExportAdjacentPreflightTestHarness');
      expect(source).not.toContain('createLocalBackupExportAdjacentPreflightTestHarnessSummary');
      expect(source).not.toContain('localBackupExportPreflightDiagnosticTestHarness');
      expect(source).not.toContain('createLocalBackupExportPreflightDiagnosticTestHarnessSummary');
      expect(source).not.toContain('local-backup-export-adjacent-preflight-summary.json');
      expect(source).not.toContain('local-backup-export-preflight-diagnostic-summary.json');
      expect(source).not.toContain('preflight-diagnostic-summary.json');
    }
  });
});
