import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const docPath = join(process.cwd(), 'docs', 'K-237-local-first-backup-manifest-audit-test-fixture-spec.md');

const forbiddenKeys = [
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'idToken',
  'id_token',
  'clientSecret',
  'client_secret',
  'supabaseServiceRoleKey',
  'serviceRoleKey',
  'sessionCookie',
  'password',
  'rawCredential',
  'oauthCredential',
] as const;

const fixture = {
  manifestVersion: '0.1-fixture',
  formatVersion: 'local-first-backup-fixture-v0',
  createdAt: '2026-07-02T00:00:00.000Z',
  appVersion: 'fixture-app-version',
  schemaVersion: 'fixture-schema-version',
  backupId: 'fixture-backup-001',
  backupKind: 'diagnostic-manifest',
  scopeLevel: 1,
  domains: [
    { id: 'notes', included: true, count: 2, payload: 'sidecar-or-existing-vault-manifest' },
    { id: 'attachmentMetadata', included: true, count: 1, payload: 'metadata-marker-only' },
    { id: 'attachmentBlobs', included: false, count: 0, payload: 'not-included' },
    { id: 'generatedDevTestArtifacts', included: false, count: 0, payload: 'excluded' },
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
  integrity: {
    manifestChecksum: 'placeholder:not-generated-in-k237',
    domainChecksums: {},
    attachmentBlobChecksums: {},
    byteCounts: {
      declaredTotalBytes: 0,
      attachmentBlobBytes: 0,
    },
    recordCountsValidated: false,
    warnings: ['fixture-only-counts-not-generated'],
  },
  compatibility: {
    restorePreviewRequired: true,
    destructiveWholeVaultReplaceAllowed: false,
    requiresMigration: false,
    unsupportedDomains: [],
    partialRestoreOnly: true,
    attachmentPayloadMissing: true,
    providerUnavailable: false,
    conflictPolicyRequired: true,
    sourceSchemaVersion: 'fixture-schema-version',
    targetSchemaVersion: 'unknown',
    minimumSupportedAppVersion: 'unknown',
  },
  privacy: {
    excludesCredentials: true,
    excludesGeneratedArtifacts: true,
    containsUserContent: false,
    containsAttachmentNames: false,
    containsProviderRecordIds: false,
    privacySensitiveFields: ['createdAt', 'counts', 'attachment byte estimates'],
  },
  warnings: ['fixture-only-no-runtime-generator'],
  limitations: ['metadata-only-example', 'no-blob-payloads'],
} as const;

function readDoc(): string {
  return readFileSync(docPath, 'utf8');
}

function collectKeys(value: unknown, keys = new Set<string>()): Set<string> {
  if (!value || typeof value !== 'object') return keys;
  for (const [key, nested] of Object.entries(value)) {
    keys.add(key);
    if (nested && typeof nested === 'object') collectKeys(nested, keys);
  }
  return keys;
}

function fixtureText(): string {
  return JSON.stringify(fixture);
}

describe('K-237 local-first backup manifest fixture spec', () => {
  it('adds the K-237 fixture spec and preserves local-first boundaries', () => {
    expect(existsSync(docPath)).toBe(true);

    const doc = readDoc();
    for (const required of [
      'K-237 Local-first Backup Manifest Audit Test / Fixture Spec',
      'K-237 is docs/spec or fixture-only.',
      'K-237 does not implement manifest generation.',
      'K-237 does not implement backup/export/restore/import mutation.',
      'local runtime data remains source of truth.',
      'remote systems are support layers.',
      'Supabase is not runtime source of truth.',
      'Google Drive/remote providers are not runtime source of truth.',
      'credentials/tokens/secrets must never be included in backup manifests or fixtures.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('documents implementation relationships and safety context', () => {
    const doc = readDoc();
    for (const required of [
      '## Existing Implementation Relationship',
      '### VaultBackupManifest',
      'existing `VaultBackupManifest` is the current implementation-facing concept.',
      '### ZIP manifest.json',
      '`vaultBackupZip.ts` writes `manifest.json` into ZIP backups.',
      '### importVaultBackup',
      '`importVaultBackup.ts` defines `VaultRestoreConflictStrategy` as `skip`, `replace`, or `duplicate`.',
      '### vaultRestorePipeline',
      '`VaultRestorePipelineOptions` includes `strategy`, `selection`, `restoreCore`, `restoreExtensions`, `restoreCloud`, and `backupBeforeRestore`.',
      'vaultRestorePipeline preview/snapshot/backupBeforeRestore behavior is safety-related context.',
      'backupBeforeRestore is not a reason to allow silent destructive restore.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('defines fixture strategy and example manifest fixture shape', () => {
    const doc = readDoc();
    for (const required of [
      '## Fixture Strategy',
      '**Option B: docs-only example plus audit-test-local fixture object.**',
      'K-237 does not add a dedicated runtime fixture file.',
      '## Example Manifest Fixture Shape',
      'manifestVersion',
      'formatVersion',
      'createdAt',
      'appVersion',
      'schemaVersion',
      'backupId',
      'backupKind',
      'scopeLevel',
      'domains',
      'counts',
      'attachments',
      'integrity',
      'compatibility',
      'privacy',
      'warnings',
      'limitations',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('defines required, optional, and forbidden fields', () => {
    const doc = readDoc();
    for (const required of [
      '## Required Fields',
      '`manifestVersion`.',
      '`formatVersion`.',
      '`createdAt`.',
      '`appVersion` or explicit unknown marker.',
      '`schemaVersion` or explicit unknown marker.',
      '`backupKind`.',
      '`scopeLevel`.',
      '`privacy.excludesCredentials`.',
      '`privacy.excludesGeneratedArtifacts`.',
      '`compatibility.restorePreviewRequired`.',
      '`compatibility.destructiveWholeVaultReplaceAllowed`.',
      '## Optional Fields',
      '`backupId`.',
      '`source.deviceLabel`.',
      '`integrity.manifestChecksum`.',
      'provider metadata must not include credentials.',
      '## Forbidden Fields',
      '`accessToken`.',
      '`refreshToken`.',
      '`clientSecret`.',
      '`client_secret`.',
      '`supabaseServiceRoleKey`.',
      '`sessionCookie`.',
      '`password`.',
      '`rawCredential`.',
      '`oauthCredential`.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('defines ZIP, VaultBackupManifest, attachment, domain, integrity, and compatibility boundaries', () => {
    const doc = readDoc();
    for (const required of [
      '## ZIP manifest.json Relationship',
      'ZIP `manifest.json` may contain or wrap the future `LocalFirstBackupManifest` shape.',
      'K-237 does not change ZIP creation/import behavior.',
      '## VaultBackupManifest Relationship',
      'Existing `VaultBackupManifest`, if present, remains the current implementation contract.',
      '## Attachment Metadata/Blob Fixture Boundary',
      '`attachmentMetadataIncluded`: true/false.',
      '`attachmentBlobPayloadIncluded`: true/false.',
      'raw blob data must not be inside manifest JSON.',
      'Google Drive provider references are not proof that blobs are available locally.',
      '## Domain Inventory/Count Fixture Boundary',
      '`generatedDevTestArtifacts` count should be 0 or excluded.',
      'credentials/tokens count should not exist.',
      '## Integrity Marker Placeholders',
      'K-237 does not implement checksum generation.',
      'restore preview must show integrity warnings.',
      '## Compatibility Hints Fixture Boundary',
      '`restorePreviewRequired`: true.',
      '`destructiveWholeVaultReplaceAllowed`: false.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('documents audit expectations, recommends K-238, lists non-goals, and closes the boundary', () => {
    const doc = readDoc();
    for (const required of [
      '## Audit-test Expectations',
      'fixture excludes forbidden fields.',
      'fixture marks destructive whole-vault restore as false.',
      'fixture does not include credentials/tokens/secrets.',
      '## Recommended K-238',
      '**K-238 Local Backup Manifest Generator Prototype**',
      'generate manifest only.',
      'no restore/import mutation.',
      'no destructive restore.',
      '## Non-Goals',
      'no runtime implementation.',
      'no manifest generator implementation.',
      'no backup/export implementation.',
      'no restore/import implementation.',
      'no ZIP creation changes.',
      'no importVaultBackup changes.',
      'no vaultRestorePipeline changes.',
      'no Supabase sync changes.',
      'no Google Drive changes.',
      'no OAuth changes.',
      'no attachment remote upload/recovery changes.',
      'no Health/Schedule behavior changes.',
      'no Notes/Cosmos changes.',
      'no Google Drive QA work.',
      'K-237 makes the manifest concept auditable before implementation.',
      'First implementation should generate or validate manifest metadata only.',
    ]) {
      expect(doc).toContain(required);
    }
  });

  it('keeps the test-local fixture required fields present and safe', () => {
    for (const key of [
      'manifestVersion',
      'formatVersion',
      'createdAt',
      'appVersion',
      'schemaVersion',
      'backupKind',
      'scopeLevel',
      'domains',
      'counts',
      'privacy',
      'compatibility',
    ]) {
      expect(fixture).toHaveProperty(key);
    }

    expect(fixture.privacy.excludesCredentials).toBe(true);
    expect(fixture.privacy.excludesGeneratedArtifacts).toBe(true);
    expect(fixture.compatibility.restorePreviewRequired).toBe(true);
    expect(fixture.compatibility.destructiveWholeVaultReplaceAllowed).toBe(false);
  });

  it('keeps forbidden keys and sensitive payloads out of the test-local fixture', () => {
    const keys = collectKeys(fixture);
    for (const forbidden of forbiddenKeys) {
      expect(keys.has(forbidden)).toBe(false);
    }

    const text = fixtureText();
    for (const forbiddenValue of [
      'access_token',
      'refresh_token',
      'client_secret',
      'supabase',
      'sessionCookie',
      'data:image',
      'data:application',
      '<html',
      'generated static HTML content',
    ]) {
      expect(text).not.toContain(forbiddenValue);
    }
  });

  it('keeps domain counts and attachment metadata/blob markers separate', () => {
    expect(fixture.counts.generatedDevTestArtifacts).toBe(0);
    expect(fixture.counts.syncQueue).toBe(0);
    expect(fixture.counts.remoteProviderMetadata).toBe(0);
    expect(fixture.counts.attachmentMetadata).toBe(1);
    expect(fixture.counts.attachmentBlobReferences).toBe(1);
    expect(fixture.counts.attachmentBlobs).toBe(0);

    expect(fixture.attachments.attachmentMetadataIncluded).toBe(true);
    expect(fixture.attachments.attachmentBlobPayloadIncluded).toBe(false);
    expect(fixture.attachments.blobReferenceCount).toBe(1);
    expect(fixture.attachments.blobPayloadCount).toBe(0);
    expect(fixture.attachments.missingBlobCount).toBe(1);

    const generatedArtifacts = fixture.domains.find(domain => domain.id === 'generatedDevTestArtifacts');
    expect(generatedArtifacts?.included).toBe(false);
    expect(generatedArtifacts?.count).toBe(0);
  });
});
