export type LocalBackupManifestDiagnosticStatus = 'pass' | 'warning' | 'blocked';

export type LocalBackupManifestDiagnosticCategory =
  | 'privacy'
  | 'credentialLeak'
  | 'forbiddenField'
  | 'rawBlobPayload'
  | 'destructiveRestoreFlag'
  | 'unsupportedScope'
  | 'compatibility'
  | 'checksumGap'
  | 'attachmentMetadataOnly'
  | 'optionalDomainMissing'
  | 'unknown';

export interface LocalBackupManifestDiagnosticHarnessInput {
  hardFailureReasons?: readonly string[];
  warnings?: readonly string[];
  validation?: {
    ok?: boolean;
    errors?: readonly string[];
    warnings?: readonly string[];
  } | null;
  manifest?: {
    backupKind?: string;
    scopeLevel?: number;
    counts?: Readonly<Record<string, number>>;
    attachments?: {
      attachmentMetadataIncluded?: boolean;
      attachmentBlobPayloadIncluded?: boolean;
    } | null;
    compatibility?: {
      unsupportedDomains?: readonly string[];
      attachmentPayloadMissing?: boolean;
      providerUnavailable?: boolean;
      requiresMigration?: boolean;
    } | null;
    warnings?: readonly string[];
    limitations?: readonly string[];
  } | null;
  sourceCounts?: {
    noteCount?: number;
    folderCount?: number;
    relationCount?: number;
  };
}

export interface LocalBackupManifestDiagnosticSummary {
  status: LocalBackupManifestDiagnosticStatus;
  hardFailureCount: number;
  warningCount: number;
  hardFailureCategories: LocalBackupManifestDiagnosticCategory[];
  warningCategories: LocalBackupManifestDiagnosticCategory[];
  scopeSummary: {
    backupKind?: string;
    scopeLevel?: number;
  };
  sourceCounts: {
    noteCount?: number;
    folderCount?: number;
    relationCount?: number;
  };
  attachmentSummary: {
    metadataOnly: boolean;
    blobPayloadIncluded: false;
  };
  compatibilitySummary: {
    hasWarnings: boolean;
    warningCount: number;
  };
}

const CREDENTIAL_PATTERN =
  /\b(access[_\s-]?token|refresh[_\s-]?token|id[_\s-]?token|auth[_\s-]?token|oauth[_\s-]?token|client[_\s-]?secret|api[_\s-]?key|bearer|password|session|supabase|google\s+oauth|google\s+drive\s+token)\b/i;
const RAW_BLOB_PATTERN = /\bdata:[^;,\s)"']+(?:;[^,\s)"']*)*;base64,|base64[,:\s]+[A-Za-z0-9+/=]{24,}/i;
const STACK_TRACE_PATTERN = /\bat\s+[\w$.<>]+\s*\(|\b[A-Za-z]:\\[^:*?"<>|\r\n]+/;

function compactStrings(values: readonly string[] | undefined): string[] {
  return [...(values ?? [])].filter(value => value.trim().length > 0);
}

function uniqueCategories(
  categories: readonly LocalBackupManifestDiagnosticCategory[],
): LocalBackupManifestDiagnosticCategory[] {
  return [...new Set(categories)];
}

function asSafeCount(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : undefined;
}

function classifyDiagnosticCode(value: string, fallback: LocalBackupManifestDiagnosticCategory): LocalBackupManifestDiagnosticCategory {
  const normalized = value.toLowerCase();

  if (normalized.includes('forbidden_key') || normalized.includes('forbiddenfield')) return 'forbiddenField';
  if (CREDENTIAL_PATTERN.test(value) || normalized.includes('credential_like')) return 'credentialLeak';
  if (RAW_BLOB_PATTERN.test(value) || normalized.includes('raw_blob') || normalized.includes('blobpayload')) {
    return 'rawBlobPayload';
  }
  if (normalized.includes('destructive_whole_vault') || normalized.includes('destructiverestore')) {
    return 'destructiveRestoreFlag';
  }
  if (
    normalized.includes('unsupported_k241_diagnostic_scope')
    || normalized.includes('invalid_backupkind')
    || normalized.includes('scopelevel')
    || normalized.includes('unsupportedscope')
  ) {
    return 'unsupportedScope';
  }
  if (
    normalized.includes('privacy_exclusion')
    || normalized.includes('generated_dev_test')
    || normalized.includes('privacy')
    || normalized.includes('generated')
  ) {
    return 'privacy';
  }
  if (normalized.includes('checksum')) return 'checksumGap';
  if (normalized.includes('optional-domain') || normalized.includes('optionaldomain')) return 'optionalDomainMissing';
  if (normalized.includes('attachment') || normalized.includes('metadata-only')) return 'attachmentMetadataOnly';
  if (normalized.includes('provider') || normalized.includes('compatibility') || STACK_TRACE_PATTERN.test(value)) {
    return 'compatibility';
  }
  return fallback;
}

function chooseFailureMessages(input: LocalBackupManifestDiagnosticHarnessInput): string[] {
  const explicit = compactStrings(input.hardFailureReasons);
  if (explicit.length > 0) return explicit;
  return compactStrings(input.validation?.errors);
}

function chooseWarningMessages(input: LocalBackupManifestDiagnosticHarnessInput): string[] {
  const explicit = compactStrings(input.warnings);
  if (explicit.length > 0) return explicit;
  return [
    ...compactStrings(input.validation?.warnings),
    ...compactStrings(input.manifest?.warnings),
    ...compactStrings(input.manifest?.limitations),
  ];
}

function statusForCounts(hardFailureCount: number, warningCount: number): LocalBackupManifestDiagnosticStatus {
  if (hardFailureCount > 0) return 'blocked';
  if (warningCount > 0) return 'warning';
  return 'pass';
}

function sourceCounts(input: LocalBackupManifestDiagnosticHarnessInput): LocalBackupManifestDiagnosticSummary['sourceCounts'] {
  const counts = input.manifest?.counts ?? {};
  return {
    noteCount: asSafeCount(input.sourceCounts?.noteCount) ?? asSafeCount(counts.notes),
    folderCount: asSafeCount(input.sourceCounts?.folderCount) ?? asSafeCount(counts.folders) ?? asSafeCount(counts.noteMetadata),
    relationCount: asSafeCount(input.sourceCounts?.relationCount) ?? asSafeCount(counts.relations) ?? asSafeCount(counts.noteRelationships),
  };
}

/**
 * Conservative status semantics: hard failures block, warnings warn, and pass
 * is reserved for completely clean diagnostics. The returned shape deliberately
 * excludes raw diagnostic messages and values.
 */
export function createLocalBackupManifestDiagnosticSummary(
  input: LocalBackupManifestDiagnosticHarnessInput = {},
): LocalBackupManifestDiagnosticSummary {
  const hardFailureMessages = chooseFailureMessages(input);
  const warningMessages = chooseWarningMessages(input);
  const warningCategories = warningMessages.map(message => classifyDiagnosticCode(message, 'compatibility'));
  const hardFailureCategories = hardFailureMessages.map(message => classifyDiagnosticCode(message, 'unknown'));

  const attachmentBlobIncluded = input.manifest?.attachments?.attachmentBlobPayloadIncluded === true;
  const attachmentMetadataIncluded = input.manifest?.attachments?.attachmentMetadataIncluded === true;
  const compatibilityWarnings = [
    input.manifest?.compatibility?.attachmentPayloadMissing,
    input.manifest?.compatibility?.providerUnavailable,
    input.manifest?.compatibility?.requiresMigration,
    Boolean(input.manifest?.compatibility?.unsupportedDomains?.length),
  ].filter(Boolean).length;
  const warningCount = warningMessages.length + compatibilityWarnings + (attachmentBlobIncluded ? 1 : 0);
  const warningCategoryList = [
    ...warningCategories,
    ...(compatibilityWarnings > 0 ? ['compatibility' as const] : []),
    ...(attachmentBlobIncluded || attachmentMetadataIncluded ? ['attachmentMetadataOnly' as const] : []),
  ];

  return {
    status: statusForCounts(hardFailureMessages.length, warningCount),
    hardFailureCount: hardFailureMessages.length,
    warningCount,
    hardFailureCategories: uniqueCategories(hardFailureCategories),
    warningCategories: uniqueCategories(warningCategoryList),
    scopeSummary: {
      backupKind: input.manifest?.backupKind,
      scopeLevel: input.manifest?.scopeLevel,
    },
    sourceCounts: sourceCounts(input),
    attachmentSummary: {
      metadataOnly: !attachmentBlobIncluded,
      blobPayloadIncluded: false,
    },
    compatibilitySummary: {
      hasWarnings: warningCount > 0,
      warningCount,
    },
  };
}
