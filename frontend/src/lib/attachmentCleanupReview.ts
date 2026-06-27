import { createLocalAttachmentMetadataRepository } from './attachmentMetadataIndexedDb';
import { createLocalAttachmentBlobAdapter } from './attachmentBlobIndexedDb';
import {
  ATTACHMENT_REFERENCE_PREFIX,
  type AttachmentBlobInventoryRecord,
  type AttachmentBlobRecord,
  type AttachmentMetadata,
  type AttachmentRepository,
  type BlobStorageAdapter,
} from './attachmentRepository';
import type {
  EmbeddedAttachmentMigrationNote,
  EmbeddedAttachmentMigrationReport,
} from './embeddedAttachmentMigration';
import {
  listEmbeddedAttachmentMigrationBackups,
  type EmbeddedAttachmentMigrationBackupReader,
  type EmbeddedAttachmentMigrationBackupSummary,
  type EmbeddedAttachmentMigrationRestoreReport,
} from './embeddedAttachmentMigrationRestore';

export type AttachmentCleanupCandidateType =
  | 'referencedAttachment'
  | 'unreferencedAttachmentMetadata'
  | 'unreferencedBlob'
  | 'partialMigrationArtifact'
  | 'restoredMigrationArtifact'
  | 'backupRecord'
  | 'missingBlob'
  | 'missingMetadata'
  | 'duplicateCandidate';

export type AttachmentCleanupCandidateSeverity = 'info' | 'warning' | 'danger';

export interface AttachmentCleanupReviewCandidate {
  type: AttachmentCleanupCandidateType;
  severity: AttachmentCleanupCandidateSeverity;
  attachmentId?: string;
  localBlobKey?: string;
  noteId?: string;
  backupKey?: string;
  migrationId?: string;
  reason: string;
  safeActionRecommendation: string;
  estimatedBytes?: number;
}

export interface AttachmentCleanupReviewReport {
  reportId: string;
  createdAt: string;
  dryRun: true;
  notesScanned: number;
  attachmentsScanned: number;
  blobsScanned: number;
  inventoryAvailable: boolean;
  inventoryPartial: boolean;
  backupsScanned: number;
  referencedAttachmentCount: number;
  unreferencedAttachmentMetadataCount: number;
  unreferencedBlobCount: number;
  partialMigrationArtifactCount: number;
  restoredMigrationArtifactCount: number;
  missingBlobCount: number;
  missingMetadataCount: number;
  duplicateCandidateCount: number;
  backupRecordCount: number;
  estimatedRecoverableBytes: number;
  candidates: AttachmentCleanupReviewCandidate[];
  warnings: string[];
  errors: string[];
}

export interface AttachmentCleanupReviewInput {
  notes: readonly EmbeddedAttachmentMigrationNote[];
  attachments?: readonly AttachmentMetadata[];
  repository?: AttachmentRepository;
  blobInventory?: readonly AttachmentBlobInventoryRecord[];
  blobAdapter?: BlobStorageAdapter;
  localBlobs?: readonly AttachmentBlobRecord[];
  backupReader?: EmbeddedAttachmentMigrationBackupReader;
  migrationReports?: readonly EmbeddedAttachmentMigrationReport[];
  restoreReports?: readonly EmbeddedAttachmentMigrationRestoreReport[];
  now?: () => string;
}

const ATTACHMENT_REFERENCE_PATTERN = /\battachment:\/\/([A-Za-z0-9][A-Za-z0-9._:-]{0,127})/g;

function defaultNow(): string {
  return new Date().toISOString();
}

function reportIdFor(createdAt: string): string {
  return `attachment-cleanup-review-${createdAt}`;
}

function noteAttachmentIds(note: EmbeddedAttachmentMigrationNote): string[] {
  const structuredIds = Array.isArray((note as EmbeddedAttachmentMigrationNote & { attachmentIds?: unknown }).attachmentIds)
    ? ((note as EmbeddedAttachmentMigrationNote & { attachmentIds: unknown[] }).attachmentIds)
      .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
    : [];
  return [...structuredIds, ...findAttachmentReferencesInText(note.body ?? ''), ...findAttachmentReferencesInText(note.content ?? '')];
}

export function findAttachmentReferencesInText(text: string): string[] {
  const ids = new Set<string>();
  ATTACHMENT_REFERENCE_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = ATTACHMENT_REFERENCE_PATTERN.exec(text)) !== null) {
    const id = match[1];
    if (id && !id.startsWith('data:')) ids.add(id);
  }
  return [...ids];
}

export function findAttachmentReferencesInNotes(
  notes: readonly EmbeddedAttachmentMigrationNote[],
): Map<string, Set<string>> {
  const referencesByAttachmentId = new Map<string, Set<string>>();
  for (const note of notes) {
    for (const attachmentId of noteAttachmentIds(note)) {
      const noteIds = referencesByAttachmentId.get(attachmentId) ?? new Set<string>();
      noteIds.add(note.id);
      referencesByAttachmentId.set(attachmentId, noteIds);
    }
  }
  return referencesByAttachmentId;
}

async function readBackups(
  backupReader?: EmbeddedAttachmentMigrationBackupReader,
): Promise<{ summaries: EmbeddedAttachmentMigrationBackupSummary[]; error?: string }> {
  if (!backupReader) return { summaries: [] };
  try {
    return { summaries: await listEmbeddedAttachmentMigrationBackups(backupReader) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { summaries: [], error: `Migration backup inventory could not be read: ${message}` };
  }
}

async function readBlobInventory(
  input: AttachmentCleanupReviewInput,
): Promise<{ records: AttachmentBlobInventoryRecord[]; available: boolean; partial: boolean; warning?: string }> {
  if (input.blobInventory) {
    return {
      records: [...input.blobInventory],
      available: true,
      partial: input.blobInventory.some(record => record.inventoryPartial),
    };
  }

  if (input.localBlobs) {
    return {
      records: input.localBlobs.map(record => ({
        localBlobKey: record.key,
        size: record.size,
        mimeType: record.mimeType,
        checksum: record.checksum,
      })),
      available: true,
      partial: false,
    };
  }

  const adapter = input.blobAdapter ?? createLocalAttachmentBlobAdapter();
  if (!adapter.listBlobRecords) {
    return {
      records: [],
      available: false,
      partial: true,
      warning: 'Local blob inventory is unavailable; unreferenced blob detection is limited.',
    };
  }

  try {
    const records = await adapter.listBlobRecords();
    return {
      records,
      available: true,
      partial: records.some(record => record.inventoryPartial),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      records: [],
      available: false,
      partial: true,
      warning: `Local blob inventory is unavailable; unreferenced blob detection is limited. ${message}`,
    };
  }
}

function pushCandidate(
  report: AttachmentCleanupReviewReport,
  candidate: AttachmentCleanupReviewCandidate,
): void {
  report.candidates.push(candidate);
}

function isMigrationLikeMetadata(metadata: AttachmentMetadata): boolean {
  return metadata.localBlobKey?.startsWith('local-attachment/att-migrated-') === true
    || metadata.id.startsWith('att-migrated-')
    || metadata.checksum?.startsWith('fnv1a:') === true;
}

function addDuplicateCandidates(report: AttachmentCleanupReviewReport, attachments: readonly AttachmentMetadata[]): void {
  const groups = new Map<string, AttachmentMetadata[]>();
  for (const metadata of attachments) {
    if (!metadata.checksum) continue;
    const group = groups.get(metadata.checksum) ?? [];
    group.push(metadata);
    groups.set(metadata.checksum, group);
  }

  for (const [checksum, group] of groups) {
    if (group.length < 2) continue;
    for (const metadata of group) {
      pushCandidate(report, {
        type: 'duplicateCandidate',
        severity: 'warning',
        attachmentId: metadata.id,
        localBlobKey: metadata.localBlobKey,
        noteId: metadata.noteId,
        reason: `Multiple attachment metadata records share checksum ${checksum}.`,
        safeActionRecommendation: 'Review duplicates manually; do not delete automatically.',
        estimatedBytes: metadata.size,
      });
    }
  }
}

function addMigrationReportCandidates(
  report: AttachmentCleanupReviewReport,
  migrationReports: readonly EmbeddedAttachmentMigrationReport[] | undefined,
): void {
  for (const migrationReport of migrationReports ?? []) {
    for (const noteResult of migrationReport.noteResults) {
      if (noteResult.status !== 'failed') continue;
      for (const localBlobKey of noteResult.orphanedBlobKeys) {
        pushCandidate(report, {
          type: 'partialMigrationArtifact',
          severity: 'warning',
          localBlobKey,
          noteId: noteResult.noteId,
          backupKey: noteResult.backupKey,
          migrationId: migrationReport.migrationId,
          reason: 'Migration created a blob before the note rewrite completed.',
          safeActionRecommendation: 'Review the failed migration report before any explicit cleanup.',
        });
      }
      for (const attachmentId of noteResult.orphanedAttachmentIds) {
        pushCandidate(report, {
          type: 'partialMigrationArtifact',
          severity: 'warning',
          attachmentId,
          noteId: noteResult.noteId,
          backupKey: noteResult.backupKey,
          migrationId: migrationReport.migrationId,
          reason: 'Migration created attachment metadata before the note rewrite completed.',
          safeActionRecommendation: 'Review the failed migration report before any explicit cleanup.',
        });
      }
    }
  }
}

function addRestoreCandidates(input: {
  report: AttachmentCleanupReviewReport;
  restoreReports: readonly EmbeddedAttachmentMigrationRestoreReport[] | undefined;
  migrationReports: readonly EmbeddedAttachmentMigrationReport[] | undefined;
  referencedAttachmentIds: Set<string>;
  attachmentsById: Map<string, AttachmentMetadata>;
}): void {
  for (const restoreReport of input.restoreReports ?? []) {
    if (!restoreReport.restored) continue;
    for (const migrationReport of input.migrationReports ?? []) {
      for (const noteResult of migrationReport.noteResults) {
        if (noteResult.noteId !== restoreReport.noteId || noteResult.backupKey !== restoreReport.backupKey) continue;
        for (const attachmentId of noteResult.attachmentIds) {
          if (input.referencedAttachmentIds.has(attachmentId)) continue;
          const metadata = input.attachmentsById.get(attachmentId);
          pushCandidate(input.report, {
            type: 'restoredMigrationArtifact',
            severity: 'warning',
            attachmentId,
            localBlobKey: metadata?.localBlobKey,
            noteId: restoreReport.noteId,
            backupKey: restoreReport.backupKey,
            migrationId: migrationReport.migrationId,
            reason: 'A migrated note was restored and this migration attachment is no longer referenced.',
            safeActionRecommendation: 'Review restored note history before any explicit cleanup.',
            estimatedBytes: metadata?.size,
          });
        }
      }
    }
  }
}

export async function buildAttachmentCleanupReview(
  input: AttachmentCleanupReviewInput,
): Promise<AttachmentCleanupReviewReport> {
  const createdAt = (input.now ?? defaultNow)();
  const repository = input.repository ?? (input.attachments ? undefined : createLocalAttachmentMetadataRepository());
  const report: AttachmentCleanupReviewReport = {
    reportId: reportIdFor(createdAt),
    createdAt,
    dryRun: true,
    notesScanned: input.notes.length,
    attachmentsScanned: 0,
    blobsScanned: 0,
    inventoryAvailable: false,
    inventoryPartial: false,
    backupsScanned: 0,
    referencedAttachmentCount: 0,
    unreferencedAttachmentMetadataCount: 0,
    unreferencedBlobCount: 0,
    partialMigrationArtifactCount: 0,
    restoredMigrationArtifactCount: 0,
    missingBlobCount: 0,
    missingMetadataCount: 0,
    duplicateCandidateCount: 0,
    backupRecordCount: 0,
    estimatedRecoverableBytes: 0,
    candidates: [],
    warnings: [],
    errors: [],
  };

  let attachments: AttachmentMetadata[] = [];
  try {
    attachments = input.attachments ? [...input.attachments] : await repository!.listAttachments();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    report.errors.push(`Attachment metadata inventory could not be read: ${message}`);
  }
  report.attachmentsScanned = attachments.length;

  const blobInventory = await readBlobInventory(input);
  report.blobsScanned = blobInventory.records.length;
  report.inventoryAvailable = blobInventory.available;
  report.inventoryPartial = blobInventory.partial;
  if (blobInventory.warning) report.warnings.push(blobInventory.warning);
  if (blobInventory.available && blobInventory.partial) {
    report.warnings.push('Local blob inventory is partial; some older records may not include complete metadata.');
  }

  const backupRead = await readBackups(input.backupReader);
  if (backupRead.error) report.warnings.push(backupRead.error);
  report.backupsScanned = backupRead.summaries.length;

  const attachmentsById = new Map(attachments.map(metadata => [metadata.id, metadata]));
  const referencedById = findAttachmentReferencesInNotes(input.notes);
  const referencedAttachmentIds = new Set(referencedById.keys());
  const blobByKey = new Map(blobInventory.records.map(blob => [blob.localBlobKey, blob]));
  const metadataBlobKeys = new Set(attachments.map(metadata => metadata.localBlobKey).filter((key): key is string => Boolean(key)));

  for (const [attachmentId, noteIds] of referencedById) {
    const metadata = attachmentsById.get(attachmentId);
    if (!metadata) {
      for (const noteId of noteIds) {
        pushCandidate(report, {
          type: 'missingMetadata',
          severity: 'warning',
          attachmentId,
          noteId,
          reason: `${ATTACHMENT_REFERENCE_PREFIX}${attachmentId} is referenced by a note but metadata is missing.`,
          safeActionRecommendation: 'Do not delete; restore or recreate attachment metadata if the note still needs it.',
        });
      }
      continue;
    }
    pushCandidate(report, {
      type: 'referencedAttachment',
      severity: 'info',
      attachmentId,
      localBlobKey: metadata.localBlobKey,
      noteId: [...noteIds].sort().join(','),
      reason: 'Attachment metadata is referenced by note content or note attachment fields.',
      safeActionRecommendation: 'Keep. This is not a cleanup candidate.',
      estimatedBytes: metadata.size,
    });
  }

  for (const metadata of attachments) {
    const isReferenced = referencedAttachmentIds.has(metadata.id);
    if (!isReferenced) {
      pushCandidate(report, {
        type: 'unreferencedAttachmentMetadata',
        severity: 'warning',
        attachmentId: metadata.id,
        localBlobKey: metadata.localBlobKey,
        noteId: metadata.noteId,
        reason: isMigrationLikeMetadata(metadata)
          ? 'Migration-created attachment metadata is not referenced by any scanned note.'
          : 'Attachment metadata is not referenced by any scanned note.',
        safeActionRecommendation: 'Review manually before any explicit cleanup.',
        estimatedBytes: metadata.size,
      });
    }

    if (metadata.localBlobKey && blobInventory.available && !blobByKey.has(metadata.localBlobKey)) {
      pushCandidate(report, {
        type: 'missingBlob',
        severity: 'warning',
        attachmentId: metadata.id,
        localBlobKey: metadata.localBlobKey,
        noteId: metadata.noteId,
        reason: 'Attachment metadata points to a local blob key that was not found.',
        safeActionRecommendation: 'Do not delete metadata automatically; this is an integrity warning.',
        estimatedBytes: metadata.size,
      });
    }
  }

  for (const blob of blobInventory.records) {
    if (metadataBlobKeys.has(blob.localBlobKey)) continue;
    pushCandidate(report, {
      type: 'unreferencedBlob',
      severity: 'warning',
      localBlobKey: blob.localBlobKey,
      reason: 'Local blob has no attachment metadata pointing to it.',
      safeActionRecommendation: 'Review manually before any explicit cleanup.',
      estimatedBytes: blob.size,
    });
  }

  for (const backup of backupRead.summaries) {
    pushCandidate(report, {
      type: 'backupRecord',
      severity: 'info',
      noteId: backup.noteId,
      backupKey: backup.backupKey,
      migrationId: backup.migrationId,
      reason: 'Migration backup exists for traceability and restore.',
      safeActionRecommendation: 'Keep. Backups are not automatically deleted by cleanup review.',
      estimatedBytes: backup.originalBodyBytes + backup.originalContentBytes,
    });
  }

  addMigrationReportCandidates(report, input.migrationReports);
  addRestoreCandidates({
    report,
    restoreReports: input.restoreReports,
    migrationReports: input.migrationReports,
    referencedAttachmentIds,
    attachmentsById,
  });
  addDuplicateCandidates(report, attachments);

  report.referencedAttachmentCount = report.candidates.filter(candidate => candidate.type === 'referencedAttachment').length;
  report.unreferencedAttachmentMetadataCount = report.candidates.filter(candidate => candidate.type === 'unreferencedAttachmentMetadata').length;
  report.unreferencedBlobCount = report.candidates.filter(candidate => candidate.type === 'unreferencedBlob').length;
  report.partialMigrationArtifactCount = report.candidates.filter(candidate => candidate.type === 'partialMigrationArtifact').length;
  report.restoredMigrationArtifactCount = report.candidates.filter(candidate => candidate.type === 'restoredMigrationArtifact').length;
  report.missingBlobCount = report.candidates.filter(candidate => candidate.type === 'missingBlob').length;
  report.missingMetadataCount = report.candidates.filter(candidate => candidate.type === 'missingMetadata').length;
  report.duplicateCandidateCount = report.candidates.filter(candidate => candidate.type === 'duplicateCandidate').length;
  report.backupRecordCount = report.candidates.filter(candidate => candidate.type === 'backupRecord').length;
  report.estimatedRecoverableBytes = report.candidates
    .filter(candidate => candidate.type === 'unreferencedAttachmentMetadata' || candidate.type === 'unreferencedBlob')
    .reduce((sum, candidate) => sum + (candidate.estimatedBytes ?? 0), 0);

  return report;
}
