import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  LOCAL_FIRST_BACKUP_CONFLICT_BOUNDARY,
  LOCAL_FIRST_BACKUP_KIND_SCOPE_LEVEL,
  createLocalFirstBackupManifest,
  validateLocalFirstBackupManifest,
  type CreateLocalFirstBackupManifestInput,
  type LocalFirstBackupManifest,
} from './localFirstBackupManifest';

const modulePath = join(process.cwd(), 'src', 'lib', 'localFirstBackupManifest.ts');

function baseInput(overrides: Partial<CreateLocalFirstBackupManifestInput> = {}): CreateLocalFirstBackupManifestInput {
  return {
    appVersion: 'test-app-version',
    schemaVersion: 3,
    backupKind: 'diagnostic-manifest',
    scopeLevel: 0,
    createdAt: '2026-07-02T00:00:00.000Z',
    backupId: 'test-backup-id',
    domains: [
      { id: 'notes', included: true, count: 2, payload: 'placeholder', restoreEligibility: 'preview-only' },
      { id: 'attachmentMetadata', included: true, count: 1, payload: 'inline-metadata', restoreEligibility: 'preview-only' },
      { id: 'attachmentBlobs', included: false, count: 0, payload: 'none', restoreEligibility: 'not-eligible' },
      { id: 'generatedDevTestArtifacts', included: false, count: 0, payload: 'none', restoreEligibility: 'not-eligible' },
    ],
    counts: {
      notes: 2,
      noteMetadata: 2,
      noteRelationships: 1,
      tags: 0,
      tasks: 0,
      schedule: 0,
      health: 0,
      settings: 1,
      attachmentMetadata: 1,
      attachmentBlobReferences: 1,
      attachmentBlobs: 0,
      remoteProviderMetadata: 0,
      diagnostics: 0,
      syncQueue: 0,
      localOnlyUiState: 0,
      generatedDevTestArtifacts: 0,
    },
    attachments: {
      attachmentMetadataIncluded: true,
      attachmentBlobPayloadIncluded: false,
      blobReferenceCount: 1,
      blobPayloadCount: 0,
      missingBlobCount: 1,
      orphanedBlobCount: 0,
      totalBytesEstimate: 0,
      checksumAvailable: false,
      providerReferenceIncluded: false,
    },
    warnings: ['test-only-manifest'],
    limitations: ['metadata-only'],
    ...overrides,
  };
}

function validManifest(overrides: Partial<CreateLocalFirstBackupManifestInput> = {}): LocalFirstBackupManifest {
  return createLocalFirstBackupManifest(baseInput(overrides));
}

function expectValid(manifest: LocalFirstBackupManifest): void {
  const result = validateLocalFirstBackupManifest(manifest);
  expect(result.errors).toEqual([]);
  expect(result.ok).toBe(true);
}

describe('localFirstBackupManifest', () => {
  it('creates a valid diagnostic manifest with scope level 0', () => {
    const manifest = validManifest();
    expect(manifest.backupKind).toBe('diagnostic-manifest');
    expect(manifest.scopeLevel).toBe(0);
    expect(LOCAL_FIRST_BACKUP_KIND_SCOPE_LEVEL['diagnostic-manifest']).toBe(0);
    expectValid(manifest);
  });

  it('creates a valid core-data manifest with scope level 1', () => {
    const manifest = validManifest({
      backupKind: 'core-data',
      scopeLevel: 1,
    });
    expect(manifest.backupKind).toBe('core-data');
    expect(manifest.scopeLevel).toBe(1);
    expect(LOCAL_FIRST_BACKUP_KIND_SCOPE_LEVEL['core-data']).toBe(1);
    expectValid(manifest);
  });

  it('accepts every valid backup kind and scope level mapping', () => {
    const validMappings = [
      ['diagnostic-manifest', 0],
      ['core-data', 1],
      ['full-content-metadata', 2],
      ['full-content-with-blobs', 3],
      ['provider-aware-recovery', 4],
    ] as const;

    for (const [backupKind, scopeLevel] of validMappings) {
      const manifest = validManifest({ backupKind, scopeLevel });
      expect(manifest.backupKind).toBe(backupKind);
      expect(manifest.scopeLevel).toBe(scopeLevel);
      expect(LOCAL_FIRST_BACKUP_KIND_SCOPE_LEVEL[backupKind]).toBe(scopeLevel);
      expectValid(manifest);
    }
  });

  it('rejects diagnostic-manifest with scope level 1', () => {
    const manifest = validManifest({
      backupKind: 'diagnostic-manifest',
      scopeLevel: 1,
    });
    const result = validateLocalFirstBackupManifest(manifest);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('invalid_backupKind_scopeLevel:diagnostic-manifest:1');
  });

  it('includes required version and identity fields', () => {
    const manifest = validManifest();
    expect(manifest).toMatchObject({
      manifestVersion: expect.any(String),
      formatVersion: expect.any(String),
      createdAt: '2026-07-02T00:00:00.000Z',
      appVersion: 'test-app-version',
      schemaVersion: 3,
      backupId: 'test-backup-id',
      backupKind: 'diagnostic-manifest',
      scopeLevel: 0,
    });
  });

  it('includes domains and counts', () => {
    const manifest = validManifest();
    expect(manifest.domains.map(domain => domain.id)).toEqual([
      'notes',
      'attachmentMetadata',
      'attachmentBlobs',
      'generatedDevTestArtifacts',
    ]);
    expect(manifest.counts.notes).toBe(2);
    expect(manifest.counts.attachmentMetadata).toBe(1);
    expect(manifest.counts.generatedDevTestArtifacts).toBe(0);
  });

  it('includes attachment metadata and blob markers separately', () => {
    const manifest = validManifest();
    expect(manifest.attachments.attachmentMetadataIncluded).toBe(true);
    expect(manifest.attachments.attachmentBlobPayloadIncluded).toBe(false);
    expect(manifest.attachments.blobReferenceCount).toBe(1);
    expect(manifest.attachments.blobPayloadCount).toBe(0);
    expect(manifest.attachments.missingBlobCount).toBe(1);
  });

  it('includes privacy exclusions for credentials, tokens, secrets, and generated artifacts', () => {
    const manifest = validManifest();
    expect(manifest.privacy.excludesCredentials).toBe(true);
    expect(manifest.privacy.excludesTokens).toBe(true);
    expect(manifest.privacy.excludesSecrets).toBe(true);
    expect(manifest.privacy.excludesGeneratedArtifacts).toBe(true);
    expectValid(manifest);
  });

  it('includes compatibility hints and keeps destructive whole-vault restore disabled', () => {
    const manifest = validManifest();
    expect(manifest.compatibility.restorePreviewRequired).toBe(true);
    expect(manifest.compatibility.destructiveWholeVaultReplaceAllowed).toBe(false);
    expect(manifest.compatibility.conflictPolicyRequired).toBe(true);
    expect(manifest.compatibility.partialRestoreOnly).toBe(true);
    expect(LOCAL_FIRST_BACKUP_CONFLICT_BOUNDARY).toContain('Per-item skip/replace/duplicate');
  });

  it('does not include credential, token, or secret fields recursively', () => {
    const manifest = validManifest();
    const serialized = JSON.stringify(manifest);
    expect(serialized).not.toContain('access_token');
    expect(serialized).not.toContain('refresh_token');
    expect(serialized).not.toContain('client_secret');
    expect(serialized).not.toContain('sessionCookie');
  });

  it('rejects forbidden credential-like keys', () => {
    const manifest = {
      ...validManifest(),
      metadata: {
        apiToken: 'redacted',
      },
    };
    const result = validateLocalFirstBackupManifest(manifest);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('forbidden_key:metadata.apiToken');
  });

  it('rejects credential-like string values inside allowed nested fields', () => {
    const cases = [
      [{ ...validManifest(), warnings: ['access_token=abc'] }, 'credential_like_value:warnings[0]'],
      [{ ...validManifest(), warnings: ['refresh_token=abc'] }, 'credential_like_value:warnings[0]'],
      [
        { ...validManifest(), metadata: { note: 'Bearer abc.def' } },
        'credential_like_value:metadata.note',
      ],
      [
        { ...validManifest(), diagnostics: [{ message: 'client_secret=abc' }] },
        'credential_like_value:diagnostics[0].message',
      ],
      [
        { ...validManifest(), metadata: { nested: { note: 'api_key=abc' } } },
        'credential_like_value:metadata.nested.note',
      ],
      [
        { ...validManifest(), diagnostics: ['oauth token: abc'] },
        'credential_like_value:diagnostics[0]',
      ],
      [
        { ...validManifest(), metadata: { note: 'google drive token unavailable' } },
        'credential_like_value:metadata.note',
      ],
    ] as const;

    for (const [manifest, expectedError] of cases) {
      const result = validateLocalFirstBackupManifest(manifest);
      expect(result.ok).toBe(false);
      expect(result.errors).toContain(expectedError);
    }
  });

  it('allows benign manifest warning and metadata strings', () => {
    const manifest = {
      ...validManifest({
        warnings: ['metadata-only manifest preview'],
        limitations: ['restore preview required'],
      }),
      metadata: {
        note: 'Domain counts are synthetic and safe for review.',
      },
    };

    expect(validateLocalFirstBackupManifest(manifest).errors).toEqual([]);
  });

  it('rejects raw blob payload fields and raw data URLs', () => {
    const withField = {
      ...validManifest(),
      attachments: {
        ...validManifest().attachments,
        rawBlobPayload: 'nope',
      },
    };
    expect(validateLocalFirstBackupManifest(withField).errors).toContain('forbidden_key:attachments.rawBlobPayload');

    const withValue = {
      ...validManifest(),
      warnings: ['data:image/png;base64,AAA111'],
    };
    expect(validateLocalFirstBackupManifest(withValue).errors).toContain('raw_blob_payload_value:warnings[0]');
  });

  it('rejects generated/dev-test artifacts when included or counted', () => {
    const included = validManifest({
      domains: [
        ...baseInput().domains.filter(domain => domain.id !== 'generatedDevTestArtifacts'),
        { id: 'generatedDevTestArtifacts', included: true, count: 1, payload: 'inline-metadata' },
      ],
      counts: { ...baseInput().counts, generatedDevTestArtifacts: 1 },
    });
    const result = validateLocalFirstBackupManifest(included);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('generated_dev_test_artifacts_not_excluded');
    expect(result.errors).toContain('generated_dev_test_artifacts_count_nonzero');
  });

  it('includes integrity placeholders', () => {
    const manifest = validManifest();
    expect(manifest.integrity.manifestChecksum).toBeNull();
    expect(manifest.integrity.domainChecksums).toEqual({});
    expect(manifest.integrity.attachmentBlobChecksums).toEqual({});
    expect(manifest.integrity.recordCountsValidated).toBe(true);
    expect(validateLocalFirstBackupManifest(manifest).warnings).toContain('manifest_checksum_not_computed');
  });

  it('rejects blob payload inclusion before scope level 3', () => {
    const manifest = validManifest({
      attachments: {
        ...baseInput().attachments,
        attachmentBlobPayloadIncluded: true,
        blobPayloadCount: 1,
        totalBytesEstimate: 10,
      },
    });
    expect(validateLocalFirstBackupManifest(manifest).errors).toContain('attachment_blob_payload_requires_scope_3');
  });

  it('accepts full-content-with-blobs at scope level 3 when blob markers are explicit', () => {
    const manifest = validManifest({
      backupKind: 'full-content-with-blobs',
      scopeLevel: 3,
      attachments: {
        ...baseInput().attachments,
        attachmentBlobPayloadIncluded: true,
        blobPayloadCount: 1,
        totalBytesEstimate: 10,
        checksumAvailable: true,
      },
      counts: { ...baseInput().counts, attachmentBlobs: 1 },
    });
    expectValid(manifest);
  });

  it('source text stays pure and avoids runtime service imports', () => {
    const source = readFileSync(modulePath, 'utf8');
    for (const forbidden of [
      'from ' + "'./importVaultBackup'",
      'from ' + "'./vaultRestorePipeline'",
      'Google' + 'Drive',
      'O' + 'Auth',
      'indexed' + 'DB',
      'local' + 'Storage',
      'fetch(',
      'JSZip',
      'Blob(',
    ]) {
      expect(source).not.toContain(forbidden);
    }
    expect(source).not.toMatch(/from\s+['"][^'"]*supabase/i);
    expect(source).not.toMatch(/import\s*\([^)]*supabase/i);
  });
});
