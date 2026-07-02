import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  createLocalBackupManifestDiagnosticSummary,
  type LocalBackupManifestDiagnosticHarnessInput,
} from './localBackupManifestDiagnosticHarness';

const sourcePath = join(process.cwd(), 'src', 'lib', 'localBackupManifestDiagnosticHarness.ts');
const docPath = join(process.cwd(), 'docs', 'K-248-local-backup-manifest-diagnostic-harness-prototype.md');

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

describe('local backup manifest diagnostic harness', () => {
  it('returns pass status when there are no hard failures or warnings', () => {
    const summary = createLocalBackupManifestDiagnosticSummary({
      manifest: {
        backupKind: 'diagnostic-manifest',
        scopeLevel: 0,
        counts: { notes: 2, noteMetadata: 1, noteRelationships: 3 },
        attachments: { attachmentMetadataIncluded: false, attachmentBlobPayloadIncluded: false },
      },
    });

    expect(summary).toMatchObject({
      status: 'pass',
      hardFailureCount: 0,
      warningCount: 0,
      hardFailureCategories: [],
      warningCategories: [],
      scopeSummary: { backupKind: 'diagnostic-manifest', scopeLevel: 0 },
      sourceCounts: { noteCount: 2, folderCount: 1, relationCount: 3 },
      attachmentSummary: { metadataOnly: true, blobPayloadIncluded: false },
      compatibilitySummary: { hasWarnings: false, warningCount: 0 },
    });
  });

  it('returns warning status when only warnings exist', () => {
    const summary = createLocalBackupManifestDiagnosticSummary({
      warnings: [
        'manifest_checksum_not_computed',
        'optional-domain-gaps-unresolved',
        'attachment-blob-payload-not-included',
      ],
    });

    expect(summary.status).toBe('warning');
    expect(summary.hardFailureCount).toBe(0);
    expect(summary.warningCount).toBe(3);
    expect(summary.warningCategories).toEqual([
      'checksumGap',
      'optionalDomainMissing',
      'attachmentMetadataOnly',
    ]);
  });

  it('returns blocked status when hard failures exist', () => {
    const summary = createLocalBackupManifestDiagnosticSummary({
      hardFailureReasons: [
        'unsupported_k241_diagnostic_scope:full-content-with-blobs:3',
        'credential_like_value:warnings[3]',
        'raw_blob_payload_value:domains[0].payload',
      ],
      warnings: ['manifest_checksum_not_computed'],
    });

    expect(summary.status).toBe('blocked');
    expect(summary.hardFailureCount).toBe(3);
    expect(summary.warningCount).toBe(1);
    expect(summary.hardFailureCategories).toEqual([
      'unsupportedScope',
      'credentialLeak',
      'rawBlobPayload',
    ]);
  });

  it('deduplicates categories while preserving message counts', () => {
    const summary = createLocalBackupManifestDiagnosticSummary({
      hardFailureReasons: [
        'credential_like_value:warnings[0]',
        'credential_like_value:warnings[1]',
        'forbidden_key:privacy.accessToken',
      ],
      warnings: ['provider metadata unresolved', 'provider unavailable'],
    });

    expect(summary.hardFailureCount).toBe(3);
    expect(summary.warningCount).toBe(2);
    expect(summary.hardFailureCategories).toEqual(['credentialLeak', 'forbiddenField']);
    expect(summary.warningCategories).toEqual(['compatibility']);
  });

  it('copies source counts safely from sourceCounts before diagnostic counts', () => {
    const summary = createLocalBackupManifestDiagnosticSummary({
      sourceCounts: { noteCount: 5, folderCount: 2, relationCount: 9 },
      manifest: {
        counts: { notes: 99, folders: 99, relations: 99 },
      },
    });

    expect(summary.sourceCounts).toEqual({ noteCount: 5, folderCount: 2, relationCount: 9 });
  });

  it('keeps attachment summary metadata-only and never claims blob payload output', () => {
    const summary = createLocalBackupManifestDiagnosticSummary({
      manifest: {
        attachments: {
          attachmentMetadataIncluded: true,
          attachmentBlobPayloadIncluded: true,
        },
      },
    });

    expect(summary.status).toBe('warning');
    expect(summary.warningCategories).toContain('attachmentMetadataOnly');
    expect(summary.attachmentSummary).toEqual({
      metadataOnly: false,
      blobPayloadIncluded: false,
    });
  });

  it('does not return raw token, secret, credential, provider, path, stack, note, blob, manifest, or zip data', () => {
    const sensitiveInput = {
      hardFailureReasons: [
        'access_token=secret-token-value refresh_token=secret-refresh client_secret=secret-client',
        'C:\\Users\\Sensitive\\vault\\notes.md: Error: stack\n    at runSecret(C:\\Users\\Sensitive\\app.ts:1:1)',
        'data:image/png;base64,AAA111SECRETSECRETSECRETSECRET',
      ],
      warnings: [
        '# Private Note\n\nThis is raw note content that must never appear.',
        '{"manifestVersion":"secret-manifest-json"}',
        'provider session data: googleDriveSession=secret',
        'PK\u0003\u0004 raw zip payload bytes',
      ],
    } satisfies LocalBackupManifestDiagnosticHarnessInput;

    const summary = createLocalBackupManifestDiagnosticSummary(sensitiveInput);
    const output = serialized(summary);

    for (const forbidden of [
      'secret-token-value',
      'secret-refresh',
      'secret-client',
      'Sensitive',
      'runSecret',
      'AAA111SECRET',
      'Private Note',
      'raw note content',
      'secret-manifest-json',
      'googleDriveSession=secret',
      'PK',
      'raw zip payload',
    ]) {
      expect(output).not.toContain(forbidden);
    }
    expect(summary.hardFailureCategories).toEqual([
      'credentialLeak',
      'compatibility',
      'rawBlobPayload',
    ]);
  });

  it('does not mutate input objects', () => {
    const input = deepFreeze({
      hardFailureReasons: ['credential_like_value:warnings[0]'],
      warnings: ['manifest_checksum_not_computed'],
      manifest: {
        backupKind: 'diagnostic-manifest',
        scopeLevel: 0,
        counts: { notes: 1, noteMetadata: 2, noteRelationships: 3 },
        attachments: { attachmentMetadataIncluded: false, attachmentBlobPayloadIncluded: false },
      },
    } satisfies LocalBackupManifestDiagnosticHarnessInput);
    const before = serialized(input);

    createLocalBackupManifestDiagnosticSummary(input);

    expect(serialized(input)).toBe(before);
  });

  it('does not log to console', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    createLocalBackupManifestDiagnosticSummary({
      hardFailureReasons: ['credential_like_value:warnings[0]'],
      warnings: ['manifest_checksum_not_computed'],
    });

    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('keeps the harness isolated from export, import, restore, ZIP, persistence, provider, blob, UI, and routing modules', () => {
    const source = readFileSync(sourcePath, 'utf8');

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

  it('documents prototype boundaries and status semantics', () => {
    const doc = readFileSync(docPath, 'utf8');

    for (const required of [
      'K-248 Local Backup Manifest Diagnostic Harness Prototype',
      'pure developer/test-only harness prototype',
      'no UI',
      'no console logging',
      'no ZIP output',
      'no `manifest.json` change',
      'no sidecar',
      'no export result shape change',
      'no import/restore wiring',
      'no persistence/network/remote/blob behavior',
      'redacted category/count summary only',
      'raw values/content/tokens/secrets/blob payloads/provider data are forbidden',
      'blocked for hard failures',
      'warning for warnings only',
      'pass only for no hard failures and no warnings',
      'K-249 should be a closure audit or harness integration boundary plan',
    ]) {
      expect(doc).toContain(required);
    }
  });
});
