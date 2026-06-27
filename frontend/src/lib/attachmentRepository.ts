import { containsRawBlobData } from './blobPayloadBoundary';

export const ATTACHMENT_REFERENCE_SCHEME = 'attachment';
export const ATTACHMENT_REFERENCE_PREFIX = `${ATTACHMENT_REFERENCE_SCHEME}://`;

export type AttachmentSyncStatus = 'local' | 'dirty' | 'synced' | 'deleted' | 'conflict' | 'failed';
export type AttachmentSource = 'local' | 'remote';
export type AttachmentTimestamp = string;

export interface AttachmentMetadata {
  id: string;
  noteId?: string;
  fileName: string;
  mimeType: string;
  size: number;
  checksum?: string;
  localBlobKey?: string;
  remoteBlobKey?: string;
  title?: string;
  alt?: string;
  caption?: string;
  thumbnailKey?: string;
  pageCount?: number;
  source?: AttachmentSource;
  createdAt: AttachmentTimestamp;
  updatedAt: AttachmentTimestamp;
  deletedAt?: AttachmentTimestamp | null;
  syncStatus?: AttachmentSyncStatus;
}

export interface AttachmentBlobWrite {
  key: string;
  blob: Blob;
  mimeType?: string;
  checksum?: string;
}

export interface AttachmentBlobRecord {
  key: string;
  blob: Blob;
  mimeType?: string;
  size: number;
  checksum?: string;
}

export interface BlobStorageAdapter {
  putBlob(input: AttachmentBlobWrite): Promise<AttachmentBlobRecord>;
  getBlob(key: string): Promise<AttachmentBlobRecord | null>;
  deleteBlob(key: string): Promise<void>;
  getObjectUrl(key: string): Promise<string | null>;
  revokeObjectUrl?(url: string): void;
}

export interface AttachmentRepository {
  listAttachments(): Promise<AttachmentMetadata[]>;
  listAttachmentsForNote(noteId: string): Promise<AttachmentMetadata[]>;
  getAttachment(id: string): Promise<AttachmentMetadata | null>;
  putAttachment(metadata: AttachmentMetadata): Promise<void>;
  updateAttachment(id: string, patch: Partial<AttachmentMetadata>): Promise<void>;
  tombstoneAttachment(id: string, deletedAt?: AttachmentTimestamp): Promise<void>;
  deleteAttachmentMetadata(id: string): Promise<void>;
  putMetadata(metadata: AttachmentMetadata): Promise<AttachmentMetadata>;
  getMetadata(id: string): Promise<AttachmentMetadata | null>;
  listForNote(noteId: string): Promise<AttachmentMetadata[]>;
  markDeleted(id: string, deletedAt: AttachmentTimestamp): Promise<AttachmentMetadata | null>;
}

const ATTACHMENT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export function isAttachmentReference(value: string): boolean {
  if (!value.startsWith(ATTACHMENT_REFERENCE_PREFIX)) return false;
  return ATTACHMENT_ID_PATTERN.test(value.slice(ATTACHMENT_REFERENCE_PREFIX.length));
}

export function attachmentReference(id: string): string {
  const normalized = id.trim();
  if (!ATTACHMENT_ID_PATTERN.test(normalized) || containsRawBlobData(normalized)) {
    throw new Error('Invalid attachment id');
  }
  return `${ATTACHMENT_REFERENCE_PREFIX}${normalized}`;
}

export function attachmentMarkdownImage(id: string, alt = ''): string {
  const escapedAlt = alt.replace(/]/g, '\\]');
  return `![${escapedAlt}](${attachmentReference(id)})`;
}

export function noteBodyContainsRawBlob(value: string): boolean {
  return containsRawBlobData(value);
}

export function isAttachmentMetadataLightweight(metadata: AttachmentMetadata): boolean {
  return !Object.values(metadata).some(value => containsRawBlobData(value));
}
