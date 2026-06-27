import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { noteSyncPayload } from '../components/views/noteUtils';
import { ATTACHMENT_BLOB_DB_NAME } from '../lib/attachmentBlobIndexedDb';
import { attachmentReference, noteBodyContainsRawBlob } from '../lib/attachmentRepository';
import { ATTACHMENT_METADATA_DB_NAME } from '../lib/attachmentMetadataIndexedDb';
import { appendAttachmentReferenceToBody } from '../lib/localImageAttachments';
import { runK144BlobAttachmentEgressAudit } from './k144BlobAttachmentEgressAudit';
import { runK146AttachmentMetadataFoundationAudit } from './k146AttachmentMetadataFoundationAudit';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function readFrontend(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf8');
}

export interface K147LocalImageAttachmentAudit {
  localBlobStoreName: string;
  localMetadataStoreName: string;
  noteBodyReferenceOnly: boolean;
  notePayloadReferenceOnly: boolean;
  noteUiHasAttachImagePrototype: boolean;
  noteUiUsesLocalAttachmentHelper: boolean;
  noDataUrlInsertionPaths: boolean;
  noRemoteObjectStoreCalls: boolean;
  k146MetadataBoundaryStillIntact: boolean;
}

export function runK147LocalImageAttachmentAudit(): K147LocalImageAttachmentAudit {
  const imageBlock = readFrontend('components/views/ImageBlock.tsx');
  const noteActions = readFrontend('components/views/noteview/actions/useNoteImportExportActions.ts');
  const editorArea = readFrontend('components/views/noteview/NoteViewEditorArea.tsx');
  const attachmentPreview = readFrontend('components/views/noteview/NoteImageAttachments.tsx');
  const ref = attachmentReference('att-k147');
  const body = appendAttachmentReferenceToBody('note body', ref);
  const payload = noteSyncPayload({
    id: 'note-k147',
    title: 'Local image attachment',
    body,
    updatedAt: 1,
    folderId: null,
    deletedAt: null,
  });
  const k144 = runK144BlobAttachmentEgressAudit();
  const k146 = runK146AttachmentMetadataFoundationAudit();

  return {
    localBlobStoreName: ATTACHMENT_BLOB_DB_NAME,
    localMetadataStoreName: ATTACHMENT_METADATA_DB_NAME,
    noteBodyReferenceOnly:
      body.includes(ref) &&
      !body.includes('data:image') &&
      !body.includes('base64') &&
      !noteBodyContainsRawBlob(body),
    notePayloadReferenceOnly:
      String(payload.body).includes(ref) &&
      !String(payload.body).includes('data:image') &&
      !String(payload.body).includes('base64'),
    noteUiHasAttachImagePrototype:
      attachmentPreview.includes('Attach image') &&
      attachmentPreview.includes('accept="image/png,image/jpeg,image/webp,image/gif"'),
    noteUiUsesLocalAttachmentHelper:
      noteActions.includes('attachLocalImageToNote') &&
      attachmentPreview.includes('attachLocalImageToNote'),
    noDataUrlInsertionPaths:
      !imageBlock.includes('readAsDataURL') &&
      !noteActions.includes('readAsDataURL') &&
      !editorArea.includes('readAsDataURL'),
    noRemoteObjectStoreCalls: k144.supabaseStorageCallSites.length === 0,
    k146MetadataBoundaryStillIntact: k146.k145BoundaryStillIntact && k146.repositoryHasLocalIndexedDbDriver,
  };
}
