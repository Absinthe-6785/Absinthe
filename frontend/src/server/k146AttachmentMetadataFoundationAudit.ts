import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { noteSyncPayload } from '../components/views/noteUtils';
import { attachmentReference, noteBodyContainsRawBlob } from '../lib/attachmentRepository';
import { ATTACHMENT_METADATA_DB_NAME } from '../lib/attachmentMetadataIndexedDb';
import { runK145AttachmentRepositoryAudit } from './k145AttachmentRepositoryAudit';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function readFrontend(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf8');
}

export interface K146AttachmentMetadataFoundationAudit {
  localMetadataStoreName: string;
  repositoryHasLocalIndexedDbDriver: boolean;
  repositoryHasRequiredMethods: boolean;
  repositoryRejectsRawMetadataPayloads: boolean;
  notePayloadKeepsAttachmentReference: boolean;
  notePayloadRemovesRawBlobPayload: boolean;
  k145BoundaryStillIntact: boolean;
}

export function runK146AttachmentMetadataFoundationAudit(): K146AttachmentMetadataFoundationAudit {
  const repository = readFrontend('lib/attachmentMetadataIndexedDb.ts');
  const boundary = readFrontend('lib/attachmentRepository.ts');
  const ref = attachmentReference('att-k146');
  const payload = noteSyncPayload({
    id: 'note-k146',
    title: 'Attachment metadata foundation',
    body: `safe ${ref} unsafe data:application/pdf;base64,AAA111`,
    updatedAt: 1,
    folderId: null,
    deletedAt: null,
  });
  const k145 = runK145AttachmentRepositoryAudit();

  return {
    localMetadataStoreName: ATTACHMENT_METADATA_DB_NAME,
    repositoryHasLocalIndexedDbDriver:
      repository.includes('indexedDB.open(ATTACHMENT_METADATA_DB_NAME') &&
      repository.includes('ATTACHMENT_METADATA_STORE'),
    repositoryHasRequiredMethods:
      boundary.includes('listAttachments()') &&
      boundary.includes('listAttachmentsForNote') &&
      boundary.includes('getAttachment') &&
      boundary.includes('putAttachment') &&
      boundary.includes('updateAttachment') &&
      boundary.includes('tombstoneAttachment') &&
      boundary.includes('deleteAttachmentMetadata'),
    repositoryRejectsRawMetadataPayloads:
      repository.includes('Attachment metadata cannot contain raw blob data') &&
      repository.includes('isAttachmentMetadataLightweight'),
    notePayloadKeepsAttachmentReference: String(payload.body).includes(ref),
    notePayloadRemovesRawBlobPayload:
      !String(payload.body).includes('base64') &&
      !noteBodyContainsRawBlob(String(payload.body)),
    k145BoundaryStillIntact:
      k145.noteSyncPayloadPreservesAttachmentReference &&
      k145.noteSyncPayloadStripsRawBlobData &&
      k145.noRemoteObjectStoreCalls,
  };
}
