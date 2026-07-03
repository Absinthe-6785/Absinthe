import {
  createLocalBackupManifestDiagnosticSummary,
  type LocalBackupManifestDiagnosticCategory,
  type LocalBackupManifestDiagnosticSummaryBackupKind,
  type LocalBackupManifestDiagnosticSummaryScopeLevel,
} from './localBackupManifestDiagnosticHarness';

export type LocalBackupExportPreflightDiagnosticStatus = 'pass' | 'warning' | 'hard-fail';

export interface LocalBackupExportPreflightDiagnosticTestHarnessInput {
  hardFailureCodes?: readonly string[];
  warningCodes?: readonly string[];
  manifestScope?: {
    backupKind?: unknown;
    scopeLevel?: unknown;
    counts?: Readonly<Record<string, number>>;
  } | null;
  sourceCounts?: {
    noteCount?: number;
    folderCount?: number;
    relationCount?: number;
  };
  attachmentFixture?: {
    attachmentMetadataIncluded?: boolean;
    attachmentBlobPayloadIncluded?: boolean;
  } | null;
  compatibilityFixture?: {
    unsupportedDomains?: readonly string[];
    attachmentPayloadMissing?: boolean;
    providerUnavailable?: boolean;
    requiresMigration?: boolean;
  } | null;
}

export interface LocalBackupExportPreflightDiagnosticTestHarnessSummary {
  status: LocalBackupExportPreflightDiagnosticStatus;
  counts: {
    hardFailures: number;
    warnings: number;
  };
  summary: {
    backupKind: LocalBackupManifestDiagnosticSummaryBackupKind;
    scopeLevel: LocalBackupManifestDiagnosticSummaryScopeLevel;
    sourceCounts: {
      noteCount?: number;
      folderCount?: number;
      relationCount?: number;
    };
  };
  hardFailures: LocalBackupManifestDiagnosticCategory[];
  warnings: LocalBackupManifestDiagnosticCategory[];
  attachmentSummary: {
    metadataOnly: boolean;
    blobPayloadIncluded: false;
  };
  compatibilitySummary: {
    hasWarnings: boolean;
    warningCount: number;
  };
  metadata: {
    generatedFor: 'test-harness';
    persisted: false;
    artifactWritten: false;
    exportRuntimeWired: false;
  };
}

function toPreflightStatus(status: 'pass' | 'warning' | 'blocked'): LocalBackupExportPreflightDiagnosticStatus {
  return status === 'blocked' ? 'hard-fail' : status;
}

function safeBackupKind(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

/**
 * Dev/test-only preflight diagnostic harness. It accepts synthetic fixture
 * input and returns a redacted category/count summary without calling export,
 * import, ZIP, UI, persistence, provider, network, or blob runtime paths.
 */
export function createLocalBackupExportPreflightDiagnosticTestHarnessSummary(
  input: LocalBackupExportPreflightDiagnosticTestHarnessInput = {},
): LocalBackupExportPreflightDiagnosticTestHarnessSummary {
  const diagnostic = createLocalBackupManifestDiagnosticSummary({
    hardFailureReasons: input.hardFailureCodes,
    warnings: input.warningCodes,
    manifest: {
      backupKind: safeBackupKind(input.manifestScope?.backupKind),
      scopeLevel: input.manifestScope?.scopeLevel,
      counts: input.manifestScope?.counts,
      attachments: input.attachmentFixture,
      compatibility: input.compatibilityFixture,
    },
    sourceCounts: input.sourceCounts,
  });

  return {
    status: toPreflightStatus(diagnostic.status),
    counts: {
      hardFailures: diagnostic.hardFailureCount,
      warnings: diagnostic.warningCount,
    },
    summary: {
      backupKind: diagnostic.scopeSummary.backupKind,
      scopeLevel: diagnostic.scopeSummary.scopeLevel,
      sourceCounts: diagnostic.sourceCounts,
    },
    hardFailures: diagnostic.hardFailureCategories,
    warnings: diagnostic.warningCategories,
    attachmentSummary: diagnostic.attachmentSummary,
    compatibilitySummary: diagnostic.compatibilitySummary,
    metadata: {
      generatedFor: 'test-harness',
      persisted: false,
      artifactWritten: false,
      exportRuntimeWired: false,
    },
  };
}
