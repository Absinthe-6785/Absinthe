import { containsRawBlobData } from './blobPayloadBoundary';
import type { RemoteBlobProviderType } from './remoteBlobProvider';

export const ATTACHMENT_REFERENCE_SCHEME = 'attachment';
export const ATTACHMENT_REFERENCE_PREFIX = `${ATTACHMENT_REFERENCE_SCHEME}://`;

export type AttachmentSyncStatus = 'local' | 'dirty' | 'synced' | 'deleted' | 'conflict' | 'failed';
export type AttachmentRemoteSyncStatus =
  | 'not_configured'
  | 'local_only'
  | 'pending_upload'
  | 'uploading'
  | 'synced'
  | 'failed'
  | 'paused_offline'
  | 'missing_local'
  | 'recoverable_remote'
  | 'conflict';
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
  remoteProvider?: RemoteBlobProviderType;
  remoteFileId?: string;
  remoteChecksum?: string;
  remoteSize?: number;
  remoteMimeType?: string;
  remoteSyncedAt?: string;
  remoteUpdatedAt?: string;
  remoteError?: string;
  remoteSyncStatus?: AttachmentRemoteSyncStatus;
  remoteVerification?: {
    sizeVerified: boolean;
    checksumVerified: boolean;
    checksumAlgorithm?: string;
    sizeOnlyVerified?: boolean;
    warnings?: string[];
  };
  lastRemoteSyncAttemptAt?: string;
  remoteSyncAttemptCount?: number;
  lastRemoteRecoveryAt?: string;
  keepOffline?: boolean;
  lastAccessedAt?: string;
  lastOpenedAt?: string;
  lastPreviewedAt?: string;
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

export interface AttachmentBlobInventoryRecord {
  localBlobKey: string;
  size: number;
  mimeType?: string;
  createdAt?: string;
  updatedAt?: string;
  checksum?: string;
  inventoryPartial?: boolean;
}

export interface BlobStorageAdapter {
  putBlob(input: AttachmentBlobWrite): Promise<AttachmentBlobRecord>;
  getBlob(key: string): Promise<AttachmentBlobRecord | null>;
  deleteBlob(key: string): Promise<void>;
  getObjectUrl(key: string): Promise<string | null>;
  listBlobRecords?(): Promise<AttachmentBlobInventoryRecord[]>;
  getBlobInfo?(key: string): Promise<AttachmentBlobInventoryRecord | null>;
  hasBlob?(key: string): Promise<boolean>;
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
const ATTACHMENT_ID_CHARACTER_PATTERN = /^[A-Za-z0-9._:-]$/;
const UNICODE_IDENTIFIER_CONTINUATION_PATTERN = /^[\p{L}\p{N}\p{M}]$/u;
const ZERO_WIDTH_CHARACTER_PATTERN = /^[\u200B-\u200D\u2060\uFEFF]$/u;

export function isAttachmentReference(value: string): boolean {
  if (!value.startsWith(ATTACHMENT_REFERENCE_PREFIX)) return false;
  return ATTACHMENT_ID_PATTERN.test(value.slice(ATTACHMENT_REFERENCE_PREFIX.length));
}

function preventsWholeAttachmentReferenceBoundary(value: string | undefined): boolean {
  return value !== undefined && (
    ATTACHMENT_ID_CHARACTER_PATTERN.test(value)
    || UNICODE_IDENTIFIER_CONTINUATION_PATTERN.test(value)
    || ZERO_WIDTH_CHARACTER_PATTERN.test(value)
    || ['/', '\\', '%', '?', '#'].includes(value)
  );
}

/**
 * Finds complete, case-sensitive attachment references embedded in text.
 *
 * The returned IDs preserve first-seen order and are de-duplicated. A valid
 * reference must be bounded as a whole token; valid-looking prefixes of a
 * longer identifier, URL, encoded token, path, query, or fragment are ignored.
 */
export function findAttachmentReferencesInText(text: string): string[] {
  const ids = new Set<string>();
  let searchFrom = 0;
  while (searchFrom < text.length) {
    const referenceStart = text.indexOf(ATTACHMENT_REFERENCE_PREFIX, searchFrom);
    if (referenceStart < 0) break;
    searchFrom = referenceStart + ATTACHMENT_REFERENCE_PREFIX.length;
    const previous = referenceStart === 0 ? undefined : text[referenceStart - 1];
    if (preventsWholeAttachmentReferenceBoundary(previous)) continue;

    let idEnd = searchFrom;
    while (idEnd < text.length && ATTACHMENT_ID_CHARACTER_PATTERN.test(text[idEnd])) idEnd += 1;
    const id = text.slice(searchFrom, idEnd);
    if (!ATTACHMENT_ID_PATTERN.test(id) || preventsWholeAttachmentReferenceBoundary(text[idEnd])) continue;
    ids.add(id);
  }
  return [...ids];
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
