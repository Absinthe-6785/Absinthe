import type { VaultBackupManifest } from './exportVaultBackup';
import {
  createLocalFirstBackupManifest,
  validateLocalFirstBackupManifest,
  type CreateLocalFirstBackupManifestInput,
  type LocalFirstBackupKind,
  type LocalFirstBackupManifest,
  type LocalFirstBackupManifestValidationResult,
} from './localFirstBackupManifest';

export const LOCAL_BACKUP_MANIFEST_EXPORT_DIAGNOSTIC_GATE =
  'Gate A: output-neutral export-adjacent diagnostic helper';

export interface LocalBackupManifestExportDiagnosticInput {
  vaultManifest: VaultBackupManifest;
  backupKind?: LocalBackupManifestExportDiagnosticKind;
  scopeLevel?: LocalBackupManifestExportDiagnosticScopeLevel;
  warnings?: string[];
  limitations?: string[];
  manifestInputOverrides?: LocalBackupManifestExportDiagnosticOverrides;
}

export interface LocalBackupManifestExportDiagnosticResult {
  gate: typeof LOCAL_BACKUP_MANIFEST_EXPORT_DIAGNOSTIC_GATE;
  manifest: LocalFirstBackupManifest | null;
  validation: LocalFirstBackupManifestValidationResult;
  hardFailure: boolean;
  hardFailureReasons: string[];
  warnings: string[];
}

const HARD_FAILURE_PREFIXES = [
  'unsupported_k241_diagnostic_scope:',
  'unsupported_k241_diagnostic_override:',
  'credential_like_value:',
  'forbidden_key:',
  'raw_blob_payload_value:',
  'invalid_backupKind',
  'invalid_backupKind_scopeLevel:',
  'destructive_whole_vault_replace_allowed',
  'generated_dev_test_artifacts_not_excluded',
  'generated_dev_test_artifacts_count_nonzero',
  'privacy_exclusion_not_true:',
] as const;

const K241_SUPPORTED_KIND_SCOPE = {
  'diagnostic-manifest': 0,
  'core-data': 1,
} as const satisfies Partial<Record<LocalFirstBackupKind, number>>;

const K241_SAFE_OVERRIDE_KEYS = new Set(['createdAt', 'backupId']);

export type LocalBackupManifestExportDiagnosticKind = keyof typeof K241_SUPPORTED_KIND_SCOPE;
export type LocalBackupManifestExportDiagnosticScopeLevel =
  typeof K241_SUPPORTED_KIND_SCOPE[LocalBackupManifestExportDiagnosticKind];
export type LocalBackupManifestExportDiagnosticOverrides =
  Partial<Pick<CreateLocalFirstBackupManifestInput, 'createdAt' | 'backupId'>>;

function hasExtensionsDomain(manifest: VaultBackupManifest, domain: 'settings' | 'health'): boolean {
  if (domain === 'settings') return manifest.extensions?.settings != null;
  return manifest.extensions?.health != null;
}

function collectK241BoundaryErrors(input: LocalBackupManifestExportDiagnosticInput): string[] {
  const errors: string[] = [];
  const backupKind = input.backupKind ?? 'diagnostic-manifest';
  const scopeLevel = input.scopeLevel ?? 0;

  if (K241_SUPPORTED_KIND_SCOPE[backupKind] !== scopeLevel) {
    errors.push(`unsupported_k241_diagnostic_scope:${String(backupKind)}:${String(scopeLevel)}`);
  }

  for (const key of Object.keys(input.manifestInputOverrides ?? {})) {
    if (!K241_SAFE_OVERRIDE_KEYS.has(key)) {
      errors.push(`unsupported_k241_diagnostic_override:${key}`);
    }
  }

  return errors;
}

function buildDiagnosticInput(
  input: LocalBackupManifestExportDiagnosticInput,
): CreateLocalFirstBackupManifestInput {
  const { vaultManifest } = input;
  const settingsIncluded = hasExtensionsDomain(vaultManifest, 'settings');
  const healthIncluded = hasExtensionsDomain(vaultManifest, 'health');
  const backupKind = input.backupKind ?? 'diagnostic-manifest';
  const scopeLevel = input.scopeLevel ?? 0;
  const createdAt = input.manifestInputOverrides?.createdAt ?? vaultManifest.exportedAt;

  const diagnosticInput: CreateLocalFirstBackupManifestInput = {
    appVersion: vaultManifest.appVersion || 'unknown',
    schemaVersion: vaultManifest.schemaVersion,
    createdAt,
    backupId: input.manifestInputOverrides?.backupId
      ?? `local-first-export-diagnostic-${createdAt.replace(/[^0-9A-Za-z]/g, '').slice(0, 20)}`,
    backupKind,
    scopeLevel,
    domains: [
      {
        id: 'notes',
        included: vaultManifest.noteCount > 0,
        count: vaultManifest.noteCount,
        payload: 'existing-vault-manifest',
        restoreEligibility: 'preview-only',
        privacyLevel: 'sensitive-content',
      },
      {
        id: 'noteMetadata',
        included: vaultManifest.folderCount > 0,
        count: vaultManifest.folderCount,
        payload: 'existing-vault-manifest',
        restoreEligibility: 'preview-only',
        privacyLevel: 'sensitive-metadata',
      },
      {
        id: 'noteRelationships',
        included: vaultManifest.relationCount > 0,
        count: vaultManifest.relationCount,
        payload: 'existing-vault-manifest',
        restoreEligibility: 'preview-only',
        privacyLevel: 'sensitive-metadata',
      },
      {
        id: 'settings',
        included: settingsIncluded,
        count: settingsIncluded ? 1 : 0,
        payload: settingsIncluded ? 'existing-vault-manifest' : 'none',
        restoreEligibility: settingsIncluded ? 'policy-required' : 'not-eligible',
        privacyLevel: settingsIncluded ? 'sensitive-metadata' : 'excluded',
      },
      {
        id: 'health',
        included: healthIncluded,
        count: healthIncluded ? 1 : 0,
        payload: healthIncluded ? 'existing-vault-manifest' : 'none',
        restoreEligibility: healthIncluded ? 'policy-required' : 'not-eligible',
        privacyLevel: healthIncluded ? 'sensitive-metadata' : 'excluded',
      },
      {
        id: 'attachmentMetadata',
        included: false,
        count: 0,
        payload: 'none',
        restoreEligibility: 'not-eligible',
        privacyLevel: 'excluded',
        warnings: ['attachment metadata inventory is not exported by current VaultBackupManifest v3'],
      },
      {
        id: 'attachmentBlobs',
        included: false,
        count: 0,
        payload: 'none',
        restoreEligibility: 'not-eligible',
        privacyLevel: 'binary-content',
        warnings: ['attachment blob payload is not included by this metadata-only diagnostic'],
      },
      {
        id: 'generatedDevTestArtifacts',
        included: false,
        count: 0,
        payload: 'none',
        restoreEligibility: 'not-eligible',
        privacyLevel: 'excluded',
      },
    ],
    counts: {
      notes: vaultManifest.noteCount,
      noteMetadata: vaultManifest.folderCount,
      noteRelationships: vaultManifest.relationCount,
      settings: settingsIncluded ? 1 : 0,
      health: healthIncluded ? 1 : 0,
      attachmentMetadata: 0,
      attachmentBlobReferences: 0,
      attachmentBlobs: 0,
      remoteProviderMetadata: 0,
      diagnostics: 1,
      generatedDevTestArtifacts: 0,
    },
    attachments: {
      attachmentMetadataIncluded: false,
      attachmentBlobPayloadIncluded: false,
      blobReferenceCount: 0,
      blobPayloadCount: 0,
      missingBlobCount: 0,
      orphanedBlobCount: 0,
      totalBytesEstimate: 0,
      checksumAvailable: false,
      providerReferenceIncluded: false,
    },
    integrity: {
      recordCountsValidated: true,
      warnings: ['manifest checksum is not computed by diagnostic integration'],
    },
    warnings: [
      'diagnostic-only:no-zip-output-change',
      'optional-domain-gaps-unresolved',
      'attachment-blob-payload-not-included',
      ...(input.warnings ?? []),
    ],
    limitations: [
      'local-first manifest is diagnostic metadata only',
      'existing VaultBackupManifest v3 remains the export artifact contract',
      ...(input.limitations ?? []),
    ],
  };

  return diagnosticInput;
}

export function isLocalBackupManifestExportDiagnosticHardFailure(error: string): boolean {
  return HARD_FAILURE_PREFIXES.some(prefix => error.startsWith(prefix));
}

export function classifyLocalBackupManifestExportDiagnosticValidation(
  validation: LocalFirstBackupManifestValidationResult,
): Pick<LocalBackupManifestExportDiagnosticResult, 'hardFailure' | 'hardFailureReasons' | 'warnings'> {
  const hardFailureReasons = validation.errors.filter(isLocalBackupManifestExportDiagnosticHardFailure);
  const warningErrors = validation.errors.filter(error => !isLocalBackupManifestExportDiagnosticHardFailure(error));
  const warnings = [
    ...validation.warnings,
    ...warningErrors.map(error => `validation_warning:${error}`),
  ];

  return {
    hardFailure: hardFailureReasons.length > 0,
    hardFailureReasons,
    warnings,
  };
}

export function createLocalBackupManifestExportDiagnostic(
  input: LocalBackupManifestExportDiagnosticInput,
): LocalBackupManifestExportDiagnosticResult {
  const boundaryErrors = collectK241BoundaryErrors(input);
  const diagnosticInput = buildDiagnosticInput(input);
  const manifest = createLocalFirstBackupManifest(diagnosticInput);
  const manifestValidation = validateLocalFirstBackupManifest(manifest);
  const validation = {
    ...manifestValidation,
    ok: manifestValidation.ok && boundaryErrors.length === 0,
    errors: [...boundaryErrors, ...manifestValidation.errors],
  };
  const classification = classifyLocalBackupManifestExportDiagnosticValidation(validation);

  return {
    gate: LOCAL_BACKUP_MANIFEST_EXPORT_DIAGNOSTIC_GATE,
    manifest: classification.hardFailure ? null : manifest,
    validation,
    ...classification,
  };
}
