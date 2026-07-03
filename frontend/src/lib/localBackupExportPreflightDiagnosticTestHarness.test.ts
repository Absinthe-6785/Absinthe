import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  createLocalBackupExportPreflightDiagnosticTestHarnessSummary,
  type LocalBackupExportPreflightDiagnosticTestHarnessInput,
} from './localBackupExportPreflightDiagnosticTestHarness';

const sourcePath = join(process.cwd(), 'src', 'lib', 'localBackupExportPreflightDiagnosticTestHarness.ts');
const docPath = join(process.cwd(), 'docs', 'K-256-local-backup-export-preflight-diagnostic-test-harness-prototype.md');

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

describe('local backup export preflight diagnostic test harness', () => {
  it('returns pass status for a clean synthetic fixture', () => {
    const summary = createLocalBackupExportPreflightDiagnosticTestHarnessSummary({
      manifestScope: {
        backupKind: 'diagnostic-manifest',
        scopeLevel: 0,
        counts: { notes: 2, folders: 1, relations: 3 },
      },
      sourceCounts: { noteCount: 2, folderCount: 1, relationCount: 3 },
      attachmentFixture: {
        attachmentMetadataIncluded: false,
        attachmentBlobPayloadIncluded: false,
      },
    });

    expect(summary).toMatchObject({
      status: 'pass',
      counts: { hardFailures: 0, warnings: 0 },
      summary: {
        backupKind: 'diagnostic-manifest',
        scopeLevel: 0,
        sourceCounts: { noteCount: 2, folderCount: 1, relationCount: 3 },
      },
      hardFailures: [],
      warnings: [],
      attachmentSummary: { metadataOnly: true, blobPayloadIncluded: false },
      compatibilitySummary: { hasWarnings: false, warningCount: 0 },
      metadata: {
        generatedFor: 'test-harness',
        persisted: false,
        artifactWritten: false,
        exportRuntimeWired: false,
      },
    });
  });

  it('returns warning status with category-only warning output', () => {
    const summary = createLocalBackupExportPreflightDiagnosticTestHarnessSummary({
      warningCodes: [
        'manifest_checksum_not_computed',
        'optional-domain-gaps-unresolved',
        'provider metadata unresolved',
      ],
    });

    expect(summary.status).toBe('warning');
    expect(summary.counts).toEqual({ hardFailures: 0, warnings: 3 });
    expect(summary.warnings).toEqual([
      'checksumGap',
      'optionalDomainMissing',
      'compatibility',
    ]);
    expect(summary.hardFailures).toEqual([]);
  });

  it('returns hard-fail status when hard failures exist and keeps warnings category-only', () => {
    const summary = createLocalBackupExportPreflightDiagnosticTestHarnessSummary({
      hardFailureCodes: [
        'credential_like_value:warnings[0]',
        'raw_blob_payload_value:domains[0].payload',
        'unsupported_k241_diagnostic_scope:scopeLevel:3',
      ],
      warningCodes: ['manifest_checksum_not_computed'],
    });

    expect(summary.status).toBe('hard-fail');
    expect(summary.counts).toEqual({ hardFailures: 3, warnings: 1 });
    expect(summary.hardFailures).toEqual([
      'credentialLeak',
      'rawBlobPayload',
      'unsupportedScope',
    ]);
    expect(summary.warnings).toEqual(['checksumGap']);
  });

  it('redacts unsupported and adversarial backupKind values', () => {
    expect(
      createLocalBackupExportPreflightDiagnosticTestHarnessSummary({
        manifestScope: { backupKind: 'diagnostic-manifest' },
      }).summary.backupKind,
    ).toBe('diagnostic-manifest');
    expect(
      createLocalBackupExportPreflightDiagnosticTestHarnessSummary({
        manifestScope: { backupKind: 'core-data' },
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
      null,
      undefined,
      42,
      ['core-data'],
      { backupKind: 'core-data' },
    ];

    for (const backupKind of adversarialBackupKinds) {
      const summary = createLocalBackupExportPreflightDiagnosticTestHarnessSummary({
        manifestScope: { backupKind },
      });
      const output = serialized(summary);

      expect(summary.summary.backupKind).toBe('unknown');
      if (typeof backupKind === 'string' && backupKind.length > 0) {
        expect(output).not.toContain(backupKind);
      }
    }
  });

  it('redacts future, malformed, and adversarial scopeLevel values', () => {
    expect(
      createLocalBackupExportPreflightDiagnosticTestHarnessSummary({
        manifestScope: { scopeLevel: 0 },
      }).summary.scopeLevel,
    ).toBe(0);
    expect(
      createLocalBackupExportPreflightDiagnosticTestHarnessSummary({
        manifestScope: { scopeLevel: 1 },
      }).summary.scopeLevel,
    ).toBe(1);

    const adversarialScopeLevels = [
      2,
      3,
      4,
      -1,
      0.5,
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
      const summary = createLocalBackupExportPreflightDiagnosticTestHarnessSummary({
        manifestScope: { scopeLevel },
      });
      const output = serialized(summary);

      expect(summary.summary.scopeLevel).toBe('unknown');
      if (typeof scopeLevel === 'string' && scopeLevel.length > 0 && scopeLevel !== '0' && scopeLevel !== '1') {
        expect(output).not.toContain(scopeLevel);
      }
    }
  });

  it('copies source counts from sourceCounts before synthetic manifest counts', () => {
    const summary = createLocalBackupExportPreflightDiagnosticTestHarnessSummary({
      manifestScope: {
        counts: { notes: 99, folders: 99, relations: 99 },
      },
      sourceCounts: { noteCount: 4, folderCount: 2, relationCount: 7 },
    });

    expect(summary.summary.sourceCounts).toEqual({
      noteCount: 4,
      folderCount: 2,
      relationCount: 7,
    });
  });

  it('keeps attachment and compatibility summaries count-only', () => {
    const summary = createLocalBackupExportPreflightDiagnosticTestHarnessSummary({
      attachmentFixture: {
        attachmentMetadataIncluded: true,
        attachmentBlobPayloadIncluded: false,
      },
      compatibilityFixture: {
        unsupportedDomains: ['private-domain-name'],
        attachmentPayloadMissing: true,
        providerUnavailable: true,
      },
    });
    const output = serialized(summary);

    expect(summary.status).toBe('warning');
    expect(summary.attachmentSummary).toEqual({
      metadataOnly: true,
      blobPayloadIncluded: false,
    });
    expect(summary.compatibilitySummary).toEqual({
      hasWarnings: true,
      warningCount: 3,
    });
    expect(summary.warnings).toEqual(['compatibility', 'attachmentMetadataOnly']);
    expect(output).not.toContain('private-domain-name');
  });

  it('never claims attachment blob payload output even when an unsafe fixture asks for it', () => {
    const summary = createLocalBackupExportPreflightDiagnosticTestHarnessSummary({
      attachmentFixture: {
        attachmentMetadataIncluded: true,
        attachmentBlobPayloadIncluded: true,
      },
    });

    expect(summary.status).toBe('warning');
    expect(summary.attachmentSummary.blobPayloadIncluded).toBe(false);
    expect(summary.warnings).toContain('attachmentMetadataOnly');
  });

  it('keeps lifecycle flags ephemeral and unwired', () => {
    const summary = createLocalBackupExportPreflightDiagnosticTestHarnessSummary();

    expect(summary.metadata).toEqual({
      generatedFor: 'test-harness',
      persisted: false,
      artifactWritten: false,
      exportRuntimeWired: false,
    });
  });

  it('does not return raw token, secret, provider, path, note, blob, manifest, or zip values', () => {
    const sensitiveInput = {
      hardFailureCodes: [
        'access_token=secret-token-value refresh_token=secret-refresh client_secret=secret-client',
        'C:\\Users\\Sensitive\\vault\\notes.md: Error: stack',
        'data:image/png;base64,AAA111SECRETSECRETSECRETSECRET',
      ],
      warningCodes: [
        '# Private Note\n\nThis is raw note content that must never appear.',
        '{"manifestVersion":"secret-manifest-json"}',
        'provider session data: googleDriveSession=secret',
        'PK\u0003\u0004 raw zip payload bytes',
      ],
      manifestScope: {
        backupKind: 'full-content-with-blobs\naccessToken=FAKE_SECRET',
        scopeLevel: 'provider-aware-recovery',
      },
      compatibilityFixture: {
        unsupportedDomains: ['secret-domain-name'],
      },
    } satisfies LocalBackupExportPreflightDiagnosticTestHarnessInput;

    const summary = createLocalBackupExportPreflightDiagnosticTestHarnessSummary(sensitiveInput);
    const output = serialized(summary);

    for (const forbidden of [
      'secret-token-value',
      'secret-refresh',
      'secret-client',
      'Sensitive',
      'AAA111SECRET',
      'Private Note',
      'raw note content',
      'secret-manifest-json',
      'googleDriveSession=secret',
      'raw zip payload',
      'full-content-with-blobs',
      'FAKE_SECRET',
      'provider-aware-recovery',
      'secret-domain-name',
    ]) {
      expect(output).not.toContain(forbidden);
    }
  });

  it('does not mutate input objects', () => {
    const input = deepFreeze({
      hardFailureCodes: ['credential_like_value:warnings[0]'],
      warningCodes: ['manifest_checksum_not_computed'],
      manifestScope: {
        backupKind: 'diagnostic-manifest',
        scopeLevel: 0,
        counts: { notes: 1, folders: 2, relations: 3 },
      },
      sourceCounts: { noteCount: 1, folderCount: 2, relationCount: 3 },
      attachmentFixture: {
        attachmentMetadataIncluded: true,
        attachmentBlobPayloadIncluded: false,
      },
    } satisfies LocalBackupExportPreflightDiagnosticTestHarnessInput);
    const before = serialized(input);

    createLocalBackupExportPreflightDiagnosticTestHarnessSummary(input);

    expect(serialized(input)).toBe(before);
  });

  it('does not log to console', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    createLocalBackupExportPreflightDiagnosticTestHarnessSummary({
      hardFailureCodes: ['credential_like_value:warnings[0]'],
      warningCodes: ['manifest_checksum_not_computed'],
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

    expect(source).toContain('from ' + "'./localBackupManifestDiagnosticHarness'");
    for (const forbidden of [
      'from ' + "'./exportVaultBackup'",
      'from ' + "'./vaultBackupZip'",
      'from ' + "'./importVaultBackup'",
      'from ' + "'./vaultRestorePipeline'",
      'from ' + "'./notePersistence'",
      'from ' + "'@/store/",
      'from ' + "'@/components/",
      'from ' + "'react'",
      'from ' + "'react-router",
      'localStorage',
      'indexedDB',
      'fetch(',
      'JSZip',
      'Google' + 'Drive',
      'O' + 'Auth',
      'Supabase',
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
      'K-256 Local Backup Export Preflight Diagnostic Test Harness Prototype',
      'pure dev/test-only preflight diagnostic test harness prototype',
      'synthetic fixture input first',
      'redacted category/count-only output',
      'status: `"pass" | "warning" | "hard-fail"`',
      'backupKind: `"diagnostic-manifest" | "core-data" | "unknown"`',
      'scopeLevel: `0 | 1 | "unknown"`',
      'generatedFor: `"test-harness"`',
      'persisted: `false`',
      'artifactWritten: `false`',
      'exportRuntimeWired: `false`',
      'no production export runtime wiring',
      'no UI',
      'no logging',
      'no ZIP output change',
      'no `manifest.json` change',
      'no sidecar output',
      'no export return shape change',
      'no import/restore behavior change',
      'no persistence/network/provider/blob behavior',
      'K-257 should be a closure audit or integration boundary audit',
    ]) {
      expect(doc).toContain(required);
    }
  });
});
