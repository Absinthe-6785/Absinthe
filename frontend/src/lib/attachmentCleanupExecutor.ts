import {
  buildAttachmentCleanupReview,
  type AttachmentCleanupReviewCandidate,
  type AttachmentCleanupReviewReport,
} from './attachmentCleanupReview';
import {
  findAttachmentReferencesInText,
  type AttachmentMetadata,
  type AttachmentRepository,
  type BlobStorageAdapter,
} from './attachmentRepository';
import type { EmbeddedAttachmentMigrationNote } from './embeddedAttachmentMigration';

export type AttachmentCleanupResultStatus = 'deleted' | 'skipped' | 'failed' | 'blocked';

export interface AttachmentCleanupExecutorInput {
  reviewReport: AttachmentCleanupReviewReport;
  confirmationToken?: string;
  selectedCandidateIds: readonly string[];
  notes: readonly EmbeddedAttachmentMigrationNote[];
  repository: AttachmentRepository;
  blobAdapter: BlobStorageAdapter;
  now?: () => string;
  makeCleanupId?: (reviewReport: AttachmentCleanupReviewReport) => string;
}

export interface AttachmentCleanupExecutorResultItem {
  candidateId: string;
  candidateType: AttachmentCleanupReviewCandidate['type'];
  status: AttachmentCleanupResultStatus;
  reason: string;
  localBlobKey?: string;
  attachmentId?: string;
  estimatedBytes?: number;
}

export interface AttachmentCleanupExecutorReport {
  cleanupId: string;
  sourceReviewReportId: string;
  startedAt: string;
  completedAt: string;
  dryRun: false;
  confirmationVerified: boolean;
  requestedCandidateCount: number;
  eligibleCandidateCount: number;
  deletedBlobCount: number;
  deletedAttachmentMetadataCount: number;
  skippedCandidateCount: number;
  failedCandidateCount: number;
  blockedCandidateCount: number;
  bytesRecoveredEstimate: number;
  results: AttachmentCleanupExecutorResultItem[];
  warnings: string[];
  errors: string[];
}

type EligibleCleanupCandidate = AttachmentCleanupReviewCandidate & {
  type: 'unreferencedBlob' | 'unreferencedAttachmentMetadata';
};

function defaultNow(): string {
  return new Date().toISOString();
}

function stableHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function sortedCandidate(candidate: AttachmentCleanupReviewCandidate): Record<string, unknown> {
  return {
    type: candidate.type,
    attachmentId: candidate.attachmentId,
    localBlobKey: candidate.localBlobKey,
    noteId: candidate.noteId,
    backupKey: candidate.backupKey,
    migrationId: candidate.migrationId,
    estimatedBytes: candidate.estimatedBytes,
  };
}

function reviewHashPayload(report: AttachmentCleanupReviewReport): string {
  return JSON.stringify({
    reportId: report.reportId,
    createdAt: report.createdAt,
    dryRun: report.dryRun,
    inventoryAvailable: report.inventoryAvailable,
    inventoryPartial: report.inventoryPartial,
    candidates: report.candidates.map(sortedCandidate),
  });
}

export function hashAttachmentCleanupReviewReport(report: AttachmentCleanupReviewReport): string {
  return stableHash(reviewHashPayload(report));
}

export function createAttachmentCleanupConfirmationToken(report: AttachmentCleanupReviewReport): string {
  return `confirm-cleanup:${hashAttachmentCleanupReviewReport(report)}`;
}

export function attachmentCleanupCandidateId(
  candidate: AttachmentCleanupReviewCandidate,
  index = 0,
): string {
  return [
    candidate.type,
    candidate.attachmentId ?? '',
    candidate.localBlobKey ?? '',
    candidate.noteId ?? '',
    candidate.backupKey ?? '',
    candidate.migrationId ?? '',
    String(index),
  ].join('|');
}

function baseReport(input: AttachmentCleanupExecutorInput, startedAt: string): AttachmentCleanupExecutorReport {
  return {
    cleanupId: input.makeCleanupId?.(input.reviewReport) ?? `attachment-cleanup-${startedAt}`,
    sourceReviewReportId: input.reviewReport.reportId,
    startedAt,
    completedAt: startedAt,
    dryRun: false,
    confirmationVerified: false,
    requestedCandidateCount: input.selectedCandidateIds.length,
    eligibleCandidateCount: 0,
    deletedBlobCount: 0,
    deletedAttachmentMetadataCount: 0,
    skippedCandidateCount: 0,
    failedCandidateCount: 0,
    blockedCandidateCount: 0,
    bytesRecoveredEstimate: 0,
    results: [],
    warnings: [],
    errors: [],
  };
}

function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/\bdata:([^;,\s)"']+)(?:;[^,\s)"']*)*;base64,[A-Za-z0-9+/=]+/gi, 'data:$1;base64,[omitted]');
}

function candidateMaps(report: AttachmentCleanupReviewReport): Map<string, AttachmentCleanupReviewCandidate> {
  return new Map(report.candidates.map((candidate, index) => [attachmentCleanupCandidateId(candidate, index), candidate]));
}

function isEligibleType(candidate: AttachmentCleanupReviewCandidate): candidate is EligibleCleanupCandidate {
  return candidate.type === 'unreferencedBlob' || candidate.type === 'unreferencedAttachmentMetadata';
}

function addResult(report: AttachmentCleanupExecutorReport, result: AttachmentCleanupExecutorResultItem): void {
  report.results.push(result);
  if (result.status === 'deleted') {
    report.bytesRecoveredEstimate += result.estimatedBytes ?? 0;
    if (result.candidateType === 'unreferencedBlob') report.deletedBlobCount += 1;
    if (result.candidateType === 'unreferencedAttachmentMetadata') report.deletedAttachmentMetadataCount += 1;
  } else if (result.status === 'failed') {
    report.failedCandidateCount += 1;
  } else if (result.status === 'blocked') {
    report.blockedCandidateCount += 1;
  } else {
    report.skippedCandidateCount += 1;
  }
}

function currentAttachmentReferenceSet(notes: readonly EmbeddedAttachmentMigrationNote[]): ReadonlySet<string> {
  const references = new Set<string>();
  for (const note of notes) {
    for (const text of [note.body ?? '', note.content ?? '']) {
      for (const attachmentId of findAttachmentReferencesInText(text)) references.add(attachmentId);
    }
  }
  return references;
}

async function deleteBlobCandidate(input: {
  candidateId: string;
  candidate: EligibleCleanupCandidate;
  report: AttachmentCleanupExecutorReport;
  currentAttachments: readonly AttachmentMetadata[];
  blobAdapter: BlobStorageAdapter;
}): Promise<void> {
  const localBlobKey = input.candidate.localBlobKey;
  if (!localBlobKey) {
    addResult(input.report, {
      candidateId: input.candidateId,
      candidateType: input.candidate.type,
      status: 'skipped',
      reason: 'Blob candidate has no local blob key.',
    });
    return;
  }

  if (input.currentAttachments.some(metadata => metadata.localBlobKey === localBlobKey)) {
    addResult(input.report, {
      candidateId: input.candidateId,
      candidateType: input.candidate.type,
      status: 'skipped',
      reason: 'Current attachment metadata now references this blob.',
      localBlobKey,
      estimatedBytes: input.candidate.estimatedBytes,
    });
    return;
  }

  const exists = input.blobAdapter.hasBlob
    ? await input.blobAdapter.hasBlob(localBlobKey)
    : Boolean(await input.blobAdapter.getBlob(localBlobKey));
  if (!exists) {
    addResult(input.report, {
      candidateId: input.candidateId,
      candidateType: input.candidate.type,
      status: 'skipped',
      reason: 'Blob no longer exists in current inventory.',
      localBlobKey,
      estimatedBytes: input.candidate.estimatedBytes,
    });
    return;
  }

  try {
    await input.blobAdapter.deleteBlob(localBlobKey);
    addResult(input.report, {
      candidateId: input.candidateId,
      candidateType: input.candidate.type,
      status: 'deleted',
      reason: 'Deleted revalidated unreferenced local blob.',
      localBlobKey,
      estimatedBytes: input.candidate.estimatedBytes,
    });
  } catch (error) {
    addResult(input.report, {
      candidateId: input.candidateId,
      candidateType: input.candidate.type,
      status: 'failed',
      reason: safeError(error),
      localBlobKey,
      estimatedBytes: input.candidate.estimatedBytes,
    });
  }
}

async function deleteMetadataCandidate(input: {
  candidateId: string;
  candidate: EligibleCleanupCandidate;
  report: AttachmentCleanupExecutorReport;
  currentAttachmentReferences: ReadonlySet<string>;
  repository: AttachmentRepository;
}): Promise<void> {
  const attachmentId = input.candidate.attachmentId;
  if (!attachmentId) {
    addResult(input.report, {
      candidateId: input.candidateId,
      candidateType: input.candidate.type,
      status: 'skipped',
      reason: 'Attachment metadata candidate has no attachment id.',
    });
    return;
  }

  if (input.currentAttachmentReferences.has(attachmentId)) {
    addResult(input.report, {
      candidateId: input.candidateId,
      candidateType: input.candidate.type,
      status: 'skipped',
      reason: 'Current notes now reference this attachment.',
      attachmentId,
      localBlobKey: input.candidate.localBlobKey,
      estimatedBytes: input.candidate.estimatedBytes,
    });
    return;
  }

  const current = await input.repository.getAttachment(attachmentId);
  if (!current) {
    addResult(input.report, {
      candidateId: input.candidateId,
      candidateType: input.candidate.type,
      status: 'skipped',
      reason: 'Attachment metadata no longer exists.',
      attachmentId,
      estimatedBytes: input.candidate.estimatedBytes,
    });
    return;
  }

  if (current.syncStatus && current.syncStatus !== 'local') {
    addResult(input.report, {
      candidateId: input.candidateId,
      candidateType: input.candidate.type,
      status: 'skipped',
      reason: 'Attachment metadata is not local-only; explicit sync-aware cleanup is required.',
      attachmentId,
      localBlobKey: current.localBlobKey,
      estimatedBytes: input.candidate.estimatedBytes,
    });
    return;
  }

  try {
    await input.repository.deleteAttachmentMetadata(attachmentId);
    addResult(input.report, {
      candidateId: input.candidateId,
      candidateType: input.candidate.type,
      status: 'deleted',
      reason: 'Deleted revalidated unreferenced local attachment metadata.',
      attachmentId,
      localBlobKey: current.localBlobKey,
      estimatedBytes: input.candidate.estimatedBytes,
    });
  } catch (error) {
    addResult(input.report, {
      candidateId: input.candidateId,
      candidateType: input.candidate.type,
      status: 'failed',
      reason: safeError(error),
      attachmentId,
      localBlobKey: current.localBlobKey,
      estimatedBytes: input.candidate.estimatedBytes,
    });
  }
}

export async function executeAttachmentCleanup(
  input: AttachmentCleanupExecutorInput,
): Promise<AttachmentCleanupExecutorReport> {
  const now = input.now ?? defaultNow;
  const startedAt = now();
  const report = baseReport(input, startedAt);

  if (input.reviewReport.dryRun !== true || !input.reviewReport.reportId || !Array.isArray(input.reviewReport.candidates)) {
    report.errors.push('Cleanup review report is invalid.');
    report.completedAt = now();
    return report;
  }

  const expectedToken = createAttachmentCleanupConfirmationToken(input.reviewReport);
  if (!input.confirmationToken || input.confirmationToken !== expectedToken) {
    report.errors.push('Cleanup confirmation token is missing or mismatched.');
    report.completedAt = now();
    return report;
  }
  report.confirmationVerified = true;

  if (input.selectedCandidateIds.length === 0) {
    report.errors.push('No cleanup candidates were explicitly selected.');
    report.completedAt = now();
    return report;
  }

  const originalCandidates = candidateMaps(input.reviewReport);
  const currentReview = await buildAttachmentCleanupReview({
    notes: input.notes,
    repository: input.repository,
    blobAdapter: input.blobAdapter,
  });
  const currentCandidates = candidateMaps(currentReview);
  const currentAttachments = await input.repository.listAttachments();
  const currentAttachmentReferences = currentAttachmentReferenceSet(input.notes);

  for (const candidateId of input.selectedCandidateIds) {
    const candidate = originalCandidates.get(candidateId);
    if (!candidate) {
      addResult(report, {
        candidateId,
        candidateType: 'duplicateCandidate',
        status: 'blocked',
        reason: 'Selected candidate was not present in the source review report.',
      });
      continue;
    }

    if (!isEligibleType(candidate)) {
      addResult(report, {
        candidateId,
        candidateType: candidate.type,
        status: 'blocked',
        reason: 'Candidate type is not eligible for K-155 cleanup.',
        attachmentId: candidate.attachmentId,
        localBlobKey: candidate.localBlobKey,
        estimatedBytes: candidate.estimatedBytes,
      });
      continue;
    }

    const currentCandidate = currentCandidates.get(candidateId);
    if (!currentCandidate || !isEligibleType(currentCandidate)) {
      addResult(report, {
        candidateId,
        candidateType: candidate.type,
        status: 'skipped',
        reason: 'Candidate is stale or no longer revalidates as unreferenced.',
        attachmentId: candidate.attachmentId,
        localBlobKey: candidate.localBlobKey,
        estimatedBytes: candidate.estimatedBytes,
      });
      continue;
    }

    report.eligibleCandidateCount += 1;
    if (candidate.type === 'unreferencedBlob') {
      await deleteBlobCandidate({
        candidateId,
        candidate,
        report,
        currentAttachments,
        blobAdapter: input.blobAdapter,
      });
    } else {
      await deleteMetadataCandidate({
        candidateId,
        candidate,
        report,
        currentAttachmentReferences,
        repository: input.repository,
      });
    }
  }

  report.completedAt = now();
  return report;
}
