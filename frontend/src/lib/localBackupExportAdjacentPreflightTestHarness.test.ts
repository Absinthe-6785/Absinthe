import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  createLocalBackupExportAdjacentPreflightTestHarnessSummary,
  type LocalBackupExportAdjacentPreflightTestHarnessInput,
} from './localBackupExportAdjacentPreflightTestHarness';

const sourcePath = join(process.cwd(), 'src', 'lib', 'localBackupExportAdjacentPreflightTestHarness.ts');
const docPath = join(
  process.cwd(),
  'docs',
  'K-259-local-backup-export-adjacent-preflight-test-harness-prototype.md',
);

function serialized(input: unknown): string {
  return JSON.stringify(input);
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    for (const nested of Object.values(value)) {
      deepFreeze(nested);
    }
  }
  return value;
}

describe('local backup export-adjacent preflight test harness', () => {
  it('returns pass status for clean export-adjacent metadata', () => {
    const summary = createLocalBackupExportAdjacentPreflightTestHarnessSummary({
      counts: { noteCount: 3, folderCount: 2, relationCount: 5 },
      scope: { backupKind: 'diagnostic-manifest', scopeLevel: 0 },
      attachments: { metadataOnly: false, blobPayloadIncluded: false },
      lifecycle: { persisted: false, artifactWritten: false, exportRuntimeWired: false },
    });

    expect(summary).toMatchObject({
      status: 'pass',
      counts: { hardFailures: 0, warnings: 0 },
      summary: {
        backupKind: 'diagnostic-manifest',
        scopeLevel: 0,
        sourceCounts: { noteCount: 3, folderCount: 2, relationCount: 5 },
      },
      hardFailures: [],
      warnings: [],
      attachmentSummary: { metadataOnly: true, blobPayloadIncluded: false },
      metadata: {
        generatedFor: 'test-harness',
        persisted: false,
        artifactWritten: false,
        exportRuntimeWired: false,
      },
    });
  });

  it('returns warning status for warning-only category/count metadata', () => {
    const summary = createLocalBackupExportAdjacentPreflightTestHarnessSummary({
      diagnostics: {
        warningCategories: ['checksumGap', 'optionalDomainMissing'],
        warningCount: 3,
      },
      compatibility: {
        warningCategories: ['compatibility'],
        warningCount: 1,
      },
    });

    expect(summary.status).toBe('warning');
    expect(summary.counts).toEqual({ hardFailures: 0, warnings: 4 });
    expect(summary.hardFailures).toEqual([]);
    expect(summary.warnings).toEqual([
      'checksumGap',
      'optionalDomainMissing',
      'compatibility',
    ]);
  });

  it('returns hard-fail status when hard failure metadata exists', () => {
    const summary = createLocalBackupExportAdjacentPreflightTestHarnessSummary({
      diagnostics: {
        hardFailureCategories: ['credentialLeak', 'rawBlobPayload', 'unsupportedScope'],
        hardFailureCount: 4,
        warningCategories: ['checksumGap'],
        warningCount: 1,
      },
    });

    expect(summary.status).toBe('hard-fail');
    expect(summary.counts).toEqual({ hardFailures: 4, warnings: 1 });
    expect(summary.hardFailures).toEqual([
      'credentialLeak',
      'rawBlobPayload',
      'unsupportedScope',
      'unknown',
    ]);
    expect(summary.warnings).toEqual(['checksumGap']);
  });

  it('copies counts safely and ignores invalid source counts', () => {
    const summary = createLocalBackupExportAdjacentPreflightTestHarnessSummary({
      counts: {
        noteCount: 7,
        folderCount: Number.NaN,
        relationCount: -1,
      },
    });

    expect(summary.summary.sourceCounts).toEqual({
      noteCount: 7,
      folderCount: undefined,
      relationCount: undefined,
    });
  });

  it('preserves backupKind redaction through the K-256 harness', () => {
    expect(
      createLocalBackupExportAdjacentPreflightTestHarnessSummary({
        scope: { backupKind: 'diagnostic-manifest' },
      }).summary.backupKind,
    ).toBe('diagnostic-manifest');
    expect(
      createLocalBackupExportAdjacentPreflightTestHarnessSummary({
        scope: { backupKind: 'core-data' },
      }).summary.backupKind,
    ).toBe('core-data');

    const adversarialBackupKinds = [
      'full-content-metadata',
      'full-content-with-blobs',
      'provider-aware-recovery',
      'accessToken=FAKE_SECRET',
      'refreshToken=FAKE_SECRET',
      'client_secret=FAKE_SECRET',
      '{"backupKind":"core-data","secret":"FAKE"}',
      ['core-data'],
      { backupKind: 'core-data' },
      null,
      undefined,
    ];

    for (const backupKind of adversarialBackupKinds) {
      const summary = createLocalBackupExportAdjacentPreflightTestHarnessSummary({
        scope: { backupKind },
      });
      const output = serialized(summary);

      expect(summary.summary.backupKind).toBe('unknown');
      if (typeof backupKind === 'string' && backupKind.length > 0) {
        expect(output).not.toContain(backupKind);
      }
    }
  });

  it('preserves scopeLevel redaction through the K-256 harness', () => {
    expect(
      createLocalBackupExportAdjacentPreflightTestHarnessSummary({
        scope: { scopeLevel: 0 },
      }).summary.scopeLevel,
    ).toBe(0);
    expect(
      createLocalBackupExportAdjacentPreflightTestHarnessSummary({
        scope: { scopeLevel: 1 },
      }).summary.scopeLevel,
    ).toBe(1);

    const adversarialScopeLevels = [
      2,
      3,
      4,
      -1,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      '0',
      '1',
      'accessToken=FAKE_SECRET',
      'C:\\Users\\Sensitive\\vault\\notes.md',
      { scopeLevel: 0 },
      [0],
      null,
      undefined,
    ];

    for (const scopeLevel of adversarialScopeLevels) {
      const summary = createLocalBackupExportAdjacentPreflightTestHarnessSummary({
        scope: { scopeLevel },
      });
      const output = serialized(summary);

      expect(summary.summary.scopeLevel).toBe('unknown');
      if (typeof scopeLevel === 'string' && scopeLevel !== '0' && scopeLevel !== '1') {
        expect(output).not.toContain(scopeLevel);
      }
    }
  });

  it('keeps attachment metadata-only and never returns raw blob-like values', () => {
    const summary = createLocalBackupExportAdjacentPreflightTestHarnessSummary({
      attachments: {
        metadataOnly: true,
        blobPayloadIncluded: 'data:image/png;base64,AAA111SECRETSECRETSECRETSECRET',
      },
    });
    const output = serialized(summary);

    expect(summary.status).toBe('pass');
    expect(summary.attachmentSummary).toEqual({
      metadataOnly: true,
      blobPayloadIncluded: false,
    });
    expect(output).not.toContain('AAA111SECRET');
    expect(output).not.toContain('data:image/png');
  });

  it('keeps compatibility metadata category/count-only', () => {
    const summary = createLocalBackupExportAdjacentPreflightTestHarnessSummary({
      compatibility: {
        warningCategories: ['compatibility'],
        warningCount: 2,
      },
    });

    expect(summary.status).toBe('warning');
    expect(summary.counts.warnings).toBe(2);
    expect(summary.warnings).toEqual(['compatibility']);
    expect(summary.compatibilitySummary).toEqual({
      hasWarnings: true,
      warningCount: 2,
    });
  });

  it('keeps lifecycle flags false regardless of input lifecycle values', () => {
    const summary = createLocalBackupExportAdjacentPreflightTestHarnessSummary({
      lifecycle: {
        persisted: true,
        artifactWritten: true,
        exportRuntimeWired: true,
      },
    });

    expect(summary.metadata).toEqual({
      generatedFor: 'test-harness',
      persisted: false,
      artifactWritten: false,
      exportRuntimeWired: false,
    });
  });

  it('does not return raw token, secret, provider, path, note, blob, manifest, zip, or session values', () => {
    const input = {
      diagnostics: {
        hardFailureCategories: ['credentialLeak'],
        hardFailureCount: 1,
        warningCategories: ['compatibility'],
        warningCount: 1,
      },
      scope: {
        backupKind: 'provider-aware-recovery accessToken=FAKE_SECRET',
        scopeLevel: 'C:\\Users\\Sensitive\\vault\\notes.md',
      },
      attachments: {
        metadataOnly: true,
        blobPayloadIncluded: 'data:image/png;base64,AAA111SECRETSECRETSECRETSECRET',
      },
      compatibility: {
        warningCategories: ['compatibility'],
        warningCount: 1,
      },
      lifecycle: {
        persisted: 'localStorage dump: # Private Note',
        artifactWritten: 'PK\u0003\u0004 raw zip payload bytes',
        exportRuntimeWired: 'googleDriveSession=secret refreshToken=secret',
      },
    } satisfies LocalBackupExportAdjacentPreflightTestHarnessInput;

    const summary = createLocalBackupExportAdjacentPreflightTestHarnessSummary(input);
    const output = serialized(summary);

    for (const forbidden of [
      'FAKE_SECRET',
      'Sensitive',
      'Private Note',
      'AAA111SECRET',
      'data:image/png',
      'raw zip payload',
      'googleDriveSession=secret',
      'refreshToken=secret',
      'provider-aware-recovery',
      'localStorage dump',
    ]) {
      expect(output).not.toContain(forbidden);
    }
  });

  it('does not mutate input objects', () => {
    const input = deepFreeze({
      counts: { noteCount: 1, folderCount: 2, relationCount: 3 },
      diagnostics: {
        hardFailureCategories: ['credentialLeak'],
        warningCategories: ['checksumGap'],
        hardFailureCount: 1,
        warningCount: 1,
      },
      scope: { backupKind: 'diagnostic-manifest', scopeLevel: 0 },
      attachments: { metadataOnly: true, blobPayloadIncluded: false },
      compatibility: { warningCategories: ['compatibility'], warningCount: 1 },
      lifecycle: { persisted: false, artifactWritten: false, exportRuntimeWired: false },
    } satisfies LocalBackupExportAdjacentPreflightTestHarnessInput);
    const before = serialized(input);

    createLocalBackupExportAdjacentPreflightTestHarnessSummary(input);

    expect(serialized(input)).toBe(before);
  });

  it('does not log to console', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    createLocalBackupExportAdjacentPreflightTestHarnessSummary({
      diagnostics: { warningCategories: ['checksumGap'], warningCount: 1 },
    });

    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('keeps source imports isolated from export, import, restore, ZIP, persistence, provider, blob, UI, and routing modules', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).toContain('from ' + "'./localBackupExportPreflightDiagnosticTestHarness'");
    for (const forbidden of [
      'from ' + "'./exportVaultBackup'",
      'buildVaultBackupManifestV3',
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
    expect(source).not.toMatch(/from\s+['"][^'"]*supabase/i);
    expect(source).not.toMatch(/from\s+['"][^'"]*attachment.*blob/i);
  });

  it('documents prototype boundaries and output neutrality', () => {
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      'K-259 Local Backup Export-adjacent Preflight Test Harness Prototype',
      'pure/test-only export-adjacent metadata fixture builder',
      'feeds safe metadata into the existing K-256 preflight harness',
      'no production export runtime wiring',
      'no export blocking',
      'no UI',
      'no logging',
      'no ZIP output changes',
      'no `manifest.json` changes',
      'no sidecar',
      'no export result shape changes',
      'no import/restore validation',
      'no provider/blob behavior',
      'Allowed metadata categories',
      'Forbidden raw values',
      'persisted false',
      'artifactWritten false',
      'exportRuntimeWired false',
      'status semantics',
      'K-260 should be closure audit or export-adjacent integration boundary closure',
    ]) {
      expect(doc).toContain(required);
    }
  });
});
