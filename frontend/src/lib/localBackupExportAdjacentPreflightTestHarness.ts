import {
  createLocalBackupExportPreflightDiagnosticTestHarnessSummary,
  type LocalBackupExportPreflightDiagnosticTestHarnessSummary,
} from './localBackupExportPreflightDiagnosticTestHarness';

type ExportAdjacentPreflightCategory =
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

export interface LocalBackupExportAdjacentPreflightTestHarnessInput {
  counts?: {
    noteCount?: number;
    folderCount?: number;
    relationCount?: number;
  };
  diagnostics?: {
    hardFailureCategories?: readonly ExportAdjacentPreflightCategory[];
    warningCategories?: readonly ExportAdjacentPreflightCategory[];
    hardFailureCount?: number;
    warningCount?: number;
  };
  scope?: {
    backupKind?: unknown;
    scopeLevel?: unknown;
  };
  attachments?: {
    metadataOnly?: boolean;
    blobPayloadIncluded?: unknown;
  };
  compatibility?: {
    warningCategories?: readonly ExportAdjacentPreflightCategory[];
    warningCount?: number;
  };
  lifecycle?: {
    persisted?: unknown;
    artifactWritten?: unknown;
    exportRuntimeWired?: unknown;
  };
}

export type LocalBackupExportAdjacentPreflightTestHarnessSummary =
  LocalBackupExportPreflightDiagnosticTestHarnessSummary;

const CATEGORY_CODE_PREFIX = 'export_adjacent_category';

function safeCount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return 0;
  return Math.floor(value);
}

function safeSourceCount(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return undefined;
  return value;
}

function categoryCode(category: ExportAdjacentPreflightCategory): string {
  switch (category) {
    case 'privacy':
      return `${CATEGORY_CODE_PREFIX}:privacy`;
    case 'credentialLeak':
      return `${CATEGORY_CODE_PREFIX}:credential_like_value`;
    case 'forbiddenField':
      return `${CATEGORY_CODE_PREFIX}:forbiddenField`;
    case 'rawBlobPayload':
      return `${CATEGORY_CODE_PREFIX}:raw_blob_payload`;
    case 'destructiveRestoreFlag':
      return `${CATEGORY_CODE_PREFIX}:destructiveRestore`;
    case 'unsupportedScope':
      return `${CATEGORY_CODE_PREFIX}:unsupportedScope`;
    case 'compatibility':
      return `${CATEGORY_CODE_PREFIX}:provider compatibility`;
    case 'checksumGap':
      return `${CATEGORY_CODE_PREFIX}:checksum`;
    case 'attachmentMetadataOnly':
      return `${CATEGORY_CODE_PREFIX}:attachment metadata-only`;
    case 'optionalDomainMissing':
      return `${CATEGORY_CODE_PREFIX}:optional-domain`;
    case 'unknown':
      return `${CATEGORY_CODE_PREFIX}:unknown`;
  }
}

function expandCategoryCodes(
  categories: readonly ExportAdjacentPreflightCategory[] | undefined,
  requestedCount: unknown,
): string[] {
  const safeCategories = [...(categories ?? [])];
  const count = Math.max(safeCount(requestedCount), safeCategories.length);
  if (count === 0) return [];

  return Array.from({ length: count }, (_, index) => {
    const category = safeCategories[index] ?? 'unknown';
    return categoryCode(category);
  });
}

function attachmentMetadataIncluded(attachments: LocalBackupExportAdjacentPreflightTestHarnessInput['attachments']): boolean {
  return attachments?.metadataOnly === true || attachments?.blobPayloadIncluded === true;
}

/**
 * Pure/dev-test-only export-adjacent metadata fixture adapter. This helper
 * accepts safe count/category/allowlist/lifecycle metadata and delegates to the
 * existing K-256 preflight harness. It is not production export runtime wiring.
 */
export function createLocalBackupExportAdjacentPreflightTestHarnessSummary(
  input: LocalBackupExportAdjacentPreflightTestHarnessInput = {},
): LocalBackupExportAdjacentPreflightTestHarnessSummary {
  const hardFailureCodes = expandCategoryCodes(
    input.diagnostics?.hardFailureCategories,
    input.diagnostics?.hardFailureCount,
  );
  const warningCodes = [
    ...expandCategoryCodes(input.diagnostics?.warningCategories, input.diagnostics?.warningCount),
    ...expandCategoryCodes(input.compatibility?.warningCategories, input.compatibility?.warningCount),
  ];

  return createLocalBackupExportPreflightDiagnosticTestHarnessSummary({
    hardFailureCodes,
    warningCodes,
    manifestScope: {
      backupKind: input.scope?.backupKind,
      scopeLevel: input.scope?.scopeLevel,
    },
    sourceCounts: {
      noteCount: safeSourceCount(input.counts?.noteCount),
      folderCount: safeSourceCount(input.counts?.folderCount),
      relationCount: safeSourceCount(input.counts?.relationCount),
    },
    attachmentFixture: {
      attachmentMetadataIncluded: attachmentMetadataIncluded(input.attachments),
      attachmentBlobPayloadIncluded: false,
    },
    compatibilityFixture: null,
  });
}
