export const LOCAL_FIRST_BACKUP_MANIFEST_VERSION = '0.1-prototype';
export const LOCAL_FIRST_BACKUP_FORMAT_VERSION = 'local-first-backup-manifest-v0';

export const LOCAL_FIRST_BACKUP_KIND_SCOPE_LEVEL = {
  'diagnostic-manifest': 0,
  'core-data': 1,
  'full-content-metadata': 2,
  'full-content-with-blobs': 3,
  'provider-aware-recovery': 4,
} as const;

export type LocalFirstBackupKind = keyof typeof LOCAL_FIRST_BACKUP_KIND_SCOPE_LEVEL;
export type LocalFirstBackupScopeLevel = typeof LOCAL_FIRST_BACKUP_KIND_SCOPE_LEVEL[LocalFirstBackupKind];

export const LOCAL_FIRST_BACKUP_CONFLICT_BOUNDARY =
  'Per-item skip/replace/duplicate conflict strategies are distinct from whole-vault destructive replace restore.';

export interface LocalFirstBackupDomainEntry {
  id: string;
  included: boolean;
  count: number;
  payload: 'none' | 'inline-metadata' | 'sidecar' | 'existing-vault-manifest' | 'placeholder';
  schemaVersion?: string | number;
  restoreEligibility?: 'not-eligible' | 'preview-only' | 'policy-required';
  privacyLevel?: 'safe-metadata' | 'sensitive-metadata' | 'sensitive-content' | 'binary-content' | 'excluded';
  warnings?: string[];
}

export interface LocalFirstBackupAttachmentMarkers {
  attachmentMetadataIncluded: boolean;
  attachmentBlobPayloadIncluded: boolean;
  blobReferenceCount: number;
  blobPayloadCount: number;
  missingBlobCount: number;
  orphanedBlobCount: number;
  totalBytesEstimate: number;
  checksumAvailable: boolean;
  providerReferenceIncluded: boolean;
}

export interface LocalFirstBackupIntegrityMarkers {
  manifestChecksum: string | null;
  domainChecksums: Record<string, string>;
  attachmentBlobChecksums: Record<string, string>;
  byteCounts: {
    declaredTotalBytes: number;
    attachmentBlobBytes: number;
    [key: string]: number;
  };
  recordCountsValidated: boolean;
  warnings: string[];
}

export interface LocalFirstBackupCompatibilityHints {
  restorePreviewRequired: true;
  destructiveWholeVaultReplaceAllowed: false;
  conflictPolicyRequired: boolean;
  partialRestoreOnly: boolean;
  requiresMigration: boolean;
  unsupportedDomains: string[];
  attachmentPayloadMissing: boolean;
  providerUnavailable: boolean;
  sourceSchemaVersion: string | number;
  targetSchemaVersion: string | number | 'unknown';
  minimumSupportedAppVersion: string | 'unknown';
}

export interface LocalFirstBackupPrivacyMarkers {
  excludesCredentials: true;
  excludesTokens: true;
  excludesSecrets: true;
  excludesGeneratedArtifacts: true;
  containsUserContent: boolean;
  containsAttachmentNames: boolean;
  containsProviderRecordIds: boolean;
  privacySensitiveFields: string[];
}

export interface LocalFirstBackupManifest {
  manifestVersion: string;
  formatVersion: string;
  createdAt: string;
  appVersion: string;
  schemaVersion: string | number;
  backupId: string;
  backupKind: LocalFirstBackupKind;
  scopeLevel: LocalFirstBackupScopeLevel;
  domains: LocalFirstBackupDomainEntry[];
  counts: Record<string, number>;
  attachments: LocalFirstBackupAttachmentMarkers;
  integrity: LocalFirstBackupIntegrityMarkers;
  compatibility: LocalFirstBackupCompatibilityHints;
  privacy: LocalFirstBackupPrivacyMarkers;
  warnings: string[];
  limitations: string[];
}

export interface CreateLocalFirstBackupManifestInput {
  appVersion: string;
  schemaVersion: string | number;
  backupKind: LocalFirstBackupKind;
  scopeLevel: LocalFirstBackupScopeLevel;
  domains: LocalFirstBackupDomainEntry[];
  counts: Record<string, number>;
  attachments?: Partial<LocalFirstBackupAttachmentMarkers>;
  createdAt?: string;
  backupId?: string;
  integrity?: Partial<LocalFirstBackupIntegrityMarkers>;
  compatibility?: Partial<LocalFirstBackupCompatibilityHints>;
  privacy?: Partial<LocalFirstBackupPrivacyMarkers>;
  warnings?: string[];
  limitations?: string[];
}

export interface LocalFirstBackupManifestValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

const REQUIRED_TOP_LEVEL_FIELDS = [
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
] as const;

const FORBIDDEN_NORMALIZED_KEYS = new Set([
  'accesstoken',
  'refreshtoken',
  'idtoken',
  'clientsecret',
  'supabaseservicerolekey',
  'servicerolekey',
  'sessioncookie',
  'password',
  'rawcredential',
  'oauthcredential',
  'token',
  'secret',
  'credential',
  'rawblobpayload',
  'blobpayload',
  'generatedhtml',
  'statichtmlartifact',
]);

const ALLOWED_SECURITY_EXCLUSION_KEYS = new Set([
  'excludesCredentials',
  'excludesTokens',
  'excludesSecrets',
  'excludesGeneratedArtifacts',
]);

const RAW_BLOB_VALUE_PATTERN = /\bdata:[^;,\s)"']+(?:;[^,\s)"']*)*;base64,/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidDateString(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}

function normalizeKey(key: string): string {
  return key.replace(/[_\-\s]/g, '').toLowerCase();
}

function isForbiddenKey(key: string): boolean {
  if (ALLOWED_SECURITY_EXCLUSION_KEYS.has(key)) return false;
  const normalized = normalizeKey(key);
  if (FORBIDDEN_NORMALIZED_KEYS.has(normalized)) return true;
  return normalized.endsWith('token')
    || normalized.endsWith('secret')
    || normalized.endsWith('credential');
}

function defaultBackupId(createdAt: string, backupKind: LocalFirstBackupKind): string {
  return `local-first-${backupKind}-${createdAt.replace(/[^0-9A-Za-z]/g, '').slice(0, 20)}`;
}

function defaultAttachmentMarkers(): LocalFirstBackupAttachmentMarkers {
  return {
    attachmentMetadataIncluded: false,
    attachmentBlobPayloadIncluded: false,
    blobReferenceCount: 0,
    blobPayloadCount: 0,
    missingBlobCount: 0,
    orphanedBlobCount: 0,
    totalBytesEstimate: 0,
    checksumAvailable: false,
    providerReferenceIncluded: false,
  };
}

function createIntegrityMarkers(
  input: CreateLocalFirstBackupManifestInput,
): LocalFirstBackupIntegrityMarkers {
  const attachmentBlobBytes = input.attachments?.attachmentBlobPayloadIncluded
    ? input.attachments.totalBytesEstimate ?? 0
    : 0;
  return {
    manifestChecksum: null,
    domainChecksums: {},
    attachmentBlobChecksums: {},
    byteCounts: {
      declaredTotalBytes: input.attachments?.totalBytesEstimate ?? 0,
      attachmentBlobBytes,
      ...(input.integrity?.byteCounts ?? {}),
    },
    recordCountsValidated: input.integrity?.recordCountsValidated ?? true,
    warnings: [...(input.integrity?.warnings ?? [])],
    ...input.integrity,
  };
}

function createCompatibilityHints(
  input: CreateLocalFirstBackupManifestInput,
): LocalFirstBackupCompatibilityHints {
  const compatibility = {
    restorePreviewRequired: true,
    destructiveWholeVaultReplaceAllowed: false,
    conflictPolicyRequired: true,
    partialRestoreOnly: input.scopeLevel < 3,
    requiresMigration: false,
    unsupportedDomains: [],
    attachmentPayloadMissing: Boolean(input.attachments?.missingBlobCount),
    providerUnavailable: false,
    sourceSchemaVersion: input.schemaVersion,
    targetSchemaVersion: 'unknown',
    minimumSupportedAppVersion: 'unknown',
    ...input.compatibility,
  };
  return {
    ...compatibility,
    restorePreviewRequired: true,
    destructiveWholeVaultReplaceAllowed: false,
  };
}

function createPrivacyMarkers(
  input: CreateLocalFirstBackupManifestInput,
): LocalFirstBackupPrivacyMarkers {
  const privacy = {
    excludesCredentials: true,
    excludesTokens: true,
    excludesSecrets: true,
    excludesGeneratedArtifacts: true,
    containsUserContent: false,
    containsAttachmentNames: false,
    containsProviderRecordIds: false,
    privacySensitiveFields: ['createdAt', 'counts'],
    ...input.privacy,
  };
  return {
    ...privacy,
    excludesCredentials: true,
    excludesTokens: true,
    excludesSecrets: true,
    excludesGeneratedArtifacts: true,
  };
}

function scanForbiddenFields(
  value: unknown,
  path: string,
  errors: string[],
): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanForbiddenFields(item, `${path}[${index}]`, errors));
    return;
  }

  if (!isRecord(value)) {
    if (typeof value === 'string' && RAW_BLOB_VALUE_PATTERN.test(value)) {
      errors.push(`raw_blob_payload_value:${path}`);
    }
    return;
  }

  for (const [key, nested] of Object.entries(value)) {
    const childPath = path ? `${path}.${key}` : key;
    if (isForbiddenKey(key)) {
      errors.push(`forbidden_key:${childPath}`);
    }
    scanForbiddenFields(nested, childPath, errors);
  }
}

export function createLocalFirstBackupManifest(
  input: CreateLocalFirstBackupManifestInput,
): LocalFirstBackupManifest {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const attachments = {
    ...defaultAttachmentMarkers(),
    ...(input.attachments ?? {}),
  };
  const manifest: LocalFirstBackupManifest = {
    manifestVersion: LOCAL_FIRST_BACKUP_MANIFEST_VERSION,
    formatVersion: LOCAL_FIRST_BACKUP_FORMAT_VERSION,
    createdAt,
    appVersion: input.appVersion,
    schemaVersion: input.schemaVersion,
    backupId: input.backupId ?? defaultBackupId(createdAt, input.backupKind),
    backupKind: input.backupKind,
    scopeLevel: input.scopeLevel,
    domains: input.domains.map(domain => ({ ...domain, warnings: [...(domain.warnings ?? [])] })),
    counts: { ...input.counts },
    attachments,
    integrity: createIntegrityMarkers({ ...input, attachments }),
    compatibility: createCompatibilityHints({ ...input, attachments }),
    privacy: createPrivacyMarkers(input),
    warnings: [...(input.warnings ?? [])],
    limitations: [...(input.limitations ?? [])],
  };

  return manifest;
}

export function validateLocalFirstBackupManifest(
  manifest: unknown,
): LocalFirstBackupManifestValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isRecord(manifest)) {
    return { ok: false, errors: ['manifest_not_object'], warnings };
  }

  for (const field of REQUIRED_TOP_LEVEL_FIELDS) {
    if (!(field in manifest)) errors.push(`missing_required_field:${field}`);
  }

  if (!isNonEmptyString(manifest.manifestVersion)) errors.push('invalid_manifestVersion');
  if (!isNonEmptyString(manifest.formatVersion)) errors.push('invalid_formatVersion');
  if (!isNonEmptyString(manifest.createdAt) || !isValidDateString(manifest.createdAt)) {
    errors.push('invalid_createdAt');
  }
  if (!isNonEmptyString(manifest.appVersion)) errors.push('invalid_appVersion');
  if (!isNonEmptyString(String(manifest.schemaVersion ?? ''))) errors.push('invalid_schemaVersion');
  if (!isNonEmptyString(manifest.backupId)) errors.push('invalid_backupId');

  const backupKind = manifest.backupKind as LocalFirstBackupKind;
  if (!(backupKind in LOCAL_FIRST_BACKUP_KIND_SCOPE_LEVEL)) {
    errors.push('invalid_backupKind');
  } else if (manifest.scopeLevel !== LOCAL_FIRST_BACKUP_KIND_SCOPE_LEVEL[backupKind]) {
    errors.push(`invalid_backupKind_scopeLevel:${backupKind}:${String(manifest.scopeLevel)}`);
  }

  if (!Array.isArray(manifest.domains) || manifest.domains.length === 0) {
    errors.push('invalid_domains');
  } else {
    for (const [index, domain] of manifest.domains.entries()) {
      if (!isRecord(domain)) {
        errors.push(`invalid_domain:${index}`);
        continue;
      }
      if (!isNonEmptyString(domain.id)) errors.push(`invalid_domain_id:${index}`);
      if (typeof domain.included !== 'boolean') errors.push(`invalid_domain_included:${index}`);
      if (typeof domain.count !== 'number' || domain.count < 0) errors.push(`invalid_domain_count:${index}`);
      if (domain.id === 'generatedDevTestArtifacts' && (domain.included !== false || domain.count !== 0)) {
        errors.push('generated_dev_test_artifacts_not_excluded');
      }
    }
  }

  if (!isRecord(manifest.counts)) {
    errors.push('invalid_counts');
  } else if (typeof manifest.counts.generatedDevTestArtifacts === 'number'
    && manifest.counts.generatedDevTestArtifacts !== 0) {
    errors.push('generated_dev_test_artifacts_count_nonzero');
  }

  if (!isRecord(manifest.attachments)) {
    errors.push('invalid_attachments');
  } else {
    for (const field of [
      'attachmentMetadataIncluded',
      'attachmentBlobPayloadIncluded',
      'checksumAvailable',
      'providerReferenceIncluded',
    ]) {
      if (typeof manifest.attachments[field] !== 'boolean') errors.push(`invalid_attachment_marker:${field}`);
    }
    for (const field of [
      'blobReferenceCount',
      'blobPayloadCount',
      'missingBlobCount',
      'orphanedBlobCount',
      'totalBytesEstimate',
    ]) {
      if (typeof manifest.attachments[field] !== 'number' || manifest.attachments[field] < 0) {
        errors.push(`invalid_attachment_marker:${field}`);
      }
    }
    if (manifest.attachments.attachmentBlobPayloadIncluded === true
      && typeof manifest.scopeLevel === 'number'
      && manifest.scopeLevel < LOCAL_FIRST_BACKUP_KIND_SCOPE_LEVEL['full-content-with-blobs']) {
      errors.push('attachment_blob_payload_requires_scope_3');
    }
  }

  if (!isRecord(manifest.integrity)) {
    errors.push('invalid_integrity');
  } else {
    if (!isRecord(manifest.integrity.domainChecksums)) errors.push('invalid_integrity_domainChecksums');
    if (!isRecord(manifest.integrity.attachmentBlobChecksums)) errors.push('invalid_integrity_attachmentBlobChecksums');
    if (typeof manifest.integrity.recordCountsValidated !== 'boolean') {
      errors.push('invalid_integrity_recordCountsValidated');
    }
    if (!Array.isArray(manifest.integrity.warnings)) errors.push('invalid_integrity_warnings');
  }

  if (!isRecord(manifest.compatibility)) {
    errors.push('invalid_compatibility');
  } else {
    if (manifest.compatibility.restorePreviewRequired !== true) errors.push('restore_preview_not_required');
    if (manifest.compatibility.destructiveWholeVaultReplaceAllowed !== false) {
      errors.push('destructive_whole_vault_replace_allowed');
    }
    if (typeof manifest.compatibility.conflictPolicyRequired !== 'boolean') {
      errors.push('invalid_conflictPolicyRequired');
    }
  }

  if (!isRecord(manifest.privacy)) {
    errors.push('invalid_privacy');
  } else {
    for (const field of [
      'excludesCredentials',
      'excludesTokens',
      'excludesSecrets',
      'excludesGeneratedArtifacts',
    ]) {
      if (manifest.privacy[field] !== true) errors.push(`privacy_exclusion_not_true:${field}`);
    }
  }

  if (!Array.isArray(manifest.warnings)) errors.push('invalid_warnings');
  if (!Array.isArray(manifest.limitations)) errors.push('invalid_limitations');

  scanForbiddenFields(manifest, '', errors);

  if (isRecord(manifest.integrity) && manifest.integrity.manifestChecksum == null) {
    warnings.push('manifest_checksum_not_computed');
  }

  return { ok: errors.length === 0, errors, warnings };
}
