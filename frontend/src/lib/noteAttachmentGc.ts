import { createLocalAttachmentBlobAdapter } from './attachmentBlobIndexedDb';
import { createLocalAttachmentMetadataRepository } from './attachmentMetadataIndexedDb';
import {
  ATTACHMENT_REFERENCE_PREFIX,
  attachmentMetadataAccountId,
  findAttachmentReferencesInText,
  type AttachmentMetadata,
  type AttachmentRepository,
  type BlobStorageAdapter,
} from './attachmentRepository';
import { localAttachmentBlobKey } from './localImageAttachments';
import { runAccountScopedNotesMutation } from './notesAccountAuthority';

export interface AttachmentReferenceNote {
  id: string;
  body?: string;
  content?: string;
}

export type NoteAttachmentGcClassification =
  | 'REFERENCED'
  | 'ORPHAN_PROVEN'
  | 'UNKNOWN_REFERENCE_STATE'
  | 'CORRUPT_METADATA'
  | 'CROSS_ACCOUNT_BLOCKED'
  | 'FAILED';

export interface NoteAttachmentGcResult {
  attachmentId: string;
  classification: NoteAttachmentGcClassification;
  reclaimedBlob: boolean;
  reclaimedMetadata: boolean;
  reason: string;
}

export interface NoteAttachmentGcReport {
  candidateCount: number;
  reclaimedBlobCount: number;
  reclaimedMetadataCount: number;
  results: NoteAttachmentGcResult[];
}

export interface GcOrphanedLocalNoteAttachmentsInput {
  accountId: string;
  candidateAttachmentIds: Iterable<string>;
  /** Null means the account context changed and reference safety is no longer provable. */
  getSurvivingNotes: () => readonly AttachmentReferenceNote[] | null;
  /** Optional durable read used when the account-scoped Notes authority is active. */
  readDurableSurvivingNotes?: () => Promise<readonly AttachmentReferenceNote[] | null>;
  repository?: AttachmentRepository;
  blobAdapter?: BlobStorageAdapter;
}

export function collectNoteAttachmentRefs(note: AttachmentReferenceNote): ReadonlySet<string> {
  const references = new Set<string>();
  for (const text of [note.body ?? '', note.content ?? '']) {
    if (!text.includes(ATTACHMENT_REFERENCE_PREFIX)) continue;
    for (const attachmentId of findAttachmentReferencesInText(text)) references.add(attachmentId);
  }
  return references;
}

export function collectSurvivingAttachmentRefs(notes: readonly AttachmentReferenceNote[]): ReadonlySet<string> {
  const references = new Set<string>();
  for (const note of notes) {
    for (const attachmentId of collectNoteAttachmentRefs(note)) references.add(attachmentId);
  }
  return references;
}

function reportResult(
  results: NoteAttachmentGcResult[],
  attachmentId: string,
  classification: NoteAttachmentGcClassification,
  reason: string,
  reclaimedBlob = false,
  reclaimedMetadata = false,
): void {
  results.push({ attachmentId, classification, reclaimedBlob, reclaimedMetadata, reason });
}

function isLocalOnly(metadata: AttachmentMetadata): boolean {
  return metadata.source === 'local'
    && (metadata.syncStatus ?? 'local') === 'local'
    && !metadata.deletedAt
    && !metadata.remoteBlobKey
    && !metadata.remoteFileId;
}

async function currentReferences(input: GcOrphanedLocalNoteAttachmentsInput): Promise<ReadonlySet<string> | null> {
  const notes = input.readDurableSurvivingNotes
    ? await input.readDurableSurvivingNotes()
    : input.getSurvivingNotes();
  return notes ? collectSurvivingAttachmentRefs(notes) : null;
}

/**
 * Reclaims only candidates from one durably deleted Note. Legacy unscoped metadata,
 * remote/migration records, stale account contexts, and malformed inventory all fail closed.
 */
export async function gcOrphanedLocalNoteAttachments(
  input: GcOrphanedLocalNoteAttachmentsInput,
): Promise<NoteAttachmentGcReport> {
  const accountId = input.accountId.trim();
  const candidateIds = [...new Set(input.candidateAttachmentIds)].sort();
  const results: NoteAttachmentGcResult[] = [];
  if (!accountId || candidateIds.length === 0) {
    return { candidateCount: candidateIds.length, reclaimedBlobCount: 0, reclaimedMetadataCount: 0, results };
  }

  const repository = input.repository ?? createLocalAttachmentMetadataRepository();
  const blobAdapter = input.blobAdapter ?? createLocalAttachmentBlobAdapter();
  if (!repository.listAttachmentsForAccount || !repository.deleteAttachmentMetadataForAccount || !blobAdapter.hasBlob) {
    for (const attachmentId of candidateIds) {
      reportResult(results, attachmentId, 'UNKNOWN_REFERENCE_STATE', 'Account-scoped metadata or bounded blob inventory is unavailable.');
    }
    return { candidateCount: candidateIds.length, reclaimedBlobCount: 0, reclaimedMetadataCount: 0, results };
  }
  const listAttachmentsForAccount = repository.listAttachmentsForAccount;
  const deleteAttachmentMetadataForAccount = repository.deleteAttachmentMetadataForAccount;
  const hasBlob = blobAdapter.hasBlob;

  for (const attachmentId of candidateIds) {
    try {
      await runAccountScopedNotesMutation(accountId, async () => {
        const references = await currentReferences(input);
        if (!references) {
          reportResult(results, attachmentId, 'UNKNOWN_REFERENCE_STATE', 'The active account context changed before GC.');
          return;
        }
        if (references.has(attachmentId)) {
          reportResult(results, attachmentId, 'REFERENCED', 'A surviving Note still references this attachment.');
          return;
        }

        const metadata = await repository.getAttachment(attachmentId);
        if (!metadata) {
          reportResult(results, attachmentId, 'UNKNOWN_REFERENCE_STATE', 'Attachment metadata is missing or malformed.');
          return;
        }
        if (attachmentMetadataAccountId(metadata) !== accountId) {
          reportResult(results, attachmentId, 'CROSS_ACCOUNT_BLOCKED', 'Attachment ownership is legacy-unscoped or belongs to another account.');
          return;
        }
        if (!metadata.localBlobKey || !isLocalOnly(metadata)) {
          reportResult(results, attachmentId, 'CORRUPT_METADATA', 'Attachment is not a complete local-only GC record.');
          return;
        }
        const expectedBlobKey = localAttachmentBlobKey(accountId, attachmentId);
        if (metadata.localBlobKey !== expectedBlobKey) {
          reportResult(results, attachmentId, 'CROSS_ACCOUNT_BLOCKED', 'Blob key is outside the proven account namespace.');
          return;
        }

        const scopedMetadata = await listAttachmentsForAccount(accountId);
        const current = scopedMetadata.find(item => item.id === attachmentId);
        if (!current
          || attachmentMetadataAccountId(current) !== accountId
          || current.localBlobKey !== expectedBlobKey
          || !isLocalOnly(current)) {
          reportResult(results, attachmentId, 'UNKNOWN_REFERENCE_STATE', 'Attachment metadata changed during GC revalidation.');
          return;
        }
        if (scopedMetadata.some(item => item.id !== attachmentId && item.localBlobKey === expectedBlobKey)) {
          reportResult(results, attachmentId, 'REFERENCED', 'Another account-scoped metadata record still references this blob.');
          return;
        }

        // The lookup is non-destructive and remains inside the origin-wide Notes mutation lock.
        // The durable reference proof below is the last await before deletion.
        const blobExists = await hasBlob(expectedBlobKey);
        const finalScopedMetadata = await listAttachmentsForAccount(accountId);
        const finalMetadata = finalScopedMetadata.find(item => item.id === attachmentId);
        if (!finalMetadata
          || attachmentMetadataAccountId(finalMetadata) !== accountId
          || finalMetadata.localBlobKey !== expectedBlobKey
          || !isLocalOnly(finalMetadata)) {
          reportResult(results, attachmentId, 'UNKNOWN_REFERENCE_STATE', 'Attachment metadata changed before the final GC proof.');
          return;
        }
        if (finalScopedMetadata.some(item => item.id !== attachmentId && item.localBlobKey === expectedBlobKey)) {
          reportResult(results, attachmentId, 'REFERENCED', 'Another account-scoped metadata record still references this blob.');
          return;
        }
        const finalReferences = await currentReferences(input);
        if (!finalReferences) {
          reportResult(results, attachmentId, 'UNKNOWN_REFERENCE_STATE', 'The active account context changed during GC revalidation.');
          return;
        }
        if (finalReferences.has(attachmentId)) {
          reportResult(results, attachmentId, 'REFERENCED', 'A surviving Note acquired this attachment during GC revalidation.');
          return;
        }

        // The account-scoped cross-context lock remains held across this async delete,
        // so a new durable Note reference cannot commit before the physical delete.
        if (blobExists) await blobAdapter.deleteBlob(expectedBlobKey);
        const metadataDeleted = await deleteAttachmentMetadataForAccount(attachmentId, accountId);
        if (!metadataDeleted) {
          reportResult(results, attachmentId, 'FAILED', 'Scoped metadata deletion did not commit.', blobExists, false);
          return;
        }
        reportResult(
          results,
          attachmentId,
          'ORPHAN_PROVEN',
          blobExists ? 'Reclaimed proven orphan blob and metadata.' : 'Blob was already absent; reclaimed orphan metadata idempotently.',
          blobExists,
          true,
        );
      });
    } catch {
      reportResult(results, attachmentId, 'FAILED', 'Best-effort local attachment GC failed; the Note deletion remains committed.');
    }
  }

  return {
    candidateCount: candidateIds.length,
    reclaimedBlobCount: results.filter(result => result.reclaimedBlob).length,
    reclaimedMetadataCount: results.filter(result => result.reclaimedMetadata).length,
    results,
  };
}
