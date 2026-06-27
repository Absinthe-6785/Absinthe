import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { noteSyncPayload } from '../components/views/noteUtils';
import {
  attachmentMarkdownImage,
  attachmentReference,
  isAttachmentMetadataLightweight,
  type AttachmentMetadata,
} from '../lib/attachmentRepository';
import { runK144BlobAttachmentEgressAudit } from './k144BlobAttachmentEgressAudit';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function readFrontend(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf8');
}

export interface K145AttachmentRepositoryAudit {
  attachmentReferenceExample: string;
  noteSyncPayloadPreservesAttachmentReference: boolean;
  noteSyncPayloadStripsRawBlobData: boolean;
  notesModelHasAttachmentIdsOnly: boolean;
  attachmentBoundaryHasRepositoryContract: boolean;
  attachmentBoundaryHasBlobAdapterContract: boolean;
  metadataBoundaryIsLightweight: boolean;
  noRemoteObjectStoreCalls: boolean;
  currentLocalBlobEntryPoints: readonly string[];
}

export function runK145AttachmentRepositoryAudit(): K145AttachmentRepositoryAudit {
  const noteUtils = readFrontend('components/views/noteUtils.ts');
  const attachmentBoundary = readFrontend('lib/attachmentRepository.ts');
  const k144 = runK144BlobAttachmentEgressAudit();
  const reference = attachmentReference('att-audit');
  const syncPayload = noteSyncPayload({
    id: 'note-audit',
    title: 'Attachment audit',
    body: `Lightweight ${attachmentMarkdownImage('att-audit', 'scan')} raw data:image/png;base64,AAA111`,
    updatedAt: 1,
    folderId: null,
    deletedAt: null,
  });
  const metadata: AttachmentMetadata = {
    id: 'att-audit',
    noteId: 'note-audit',
    fileName: 'scan.png',
    mimeType: 'image/png',
    size: 1024,
    checksum: 'sha256:audit',
    localBlobKey: 'local/att-audit',
    remoteBlobKey: 'remote/att-audit',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    syncStatus: 'dirty',
  };

  return {
    attachmentReferenceExample: reference,
    noteSyncPayloadPreservesAttachmentReference: String(syncPayload.body).includes(reference),
    noteSyncPayloadStripsRawBlobData: !String(syncPayload.body).includes('base64'),
    notesModelHasAttachmentIdsOnly: !/\b(?:attachment|attachments|blob|file|files|pdf|thumbnail)\??:/.test(noteUtils),
    attachmentBoundaryHasRepositoryContract:
      attachmentBoundary.includes('export interface AttachmentRepository') &&
      attachmentBoundary.includes('listForNote') &&
      attachmentBoundary.includes('markDeleted'),
    attachmentBoundaryHasBlobAdapterContract:
      attachmentBoundary.includes('export interface BlobStorageAdapter') &&
      attachmentBoundary.includes('putBlob') &&
      attachmentBoundary.includes('getBlob') &&
      attachmentBoundary.includes('deleteBlob'),
    metadataBoundaryIsLightweight: isAttachmentMetadataLightweight(metadata),
    noRemoteObjectStoreCalls: k144.supabaseStorageCallSites.length === 0,
    currentLocalBlobEntryPoints: k144.userGeneratedBlobEntryPoints,
  };
}
