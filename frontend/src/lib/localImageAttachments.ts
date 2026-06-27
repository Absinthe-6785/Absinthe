import {
  attachmentReference,
  type AttachmentMetadata,
  type AttachmentRepository,
  type BlobStorageAdapter,
} from './attachmentRepository';
import { createLocalAttachmentBlobAdapter } from './attachmentBlobIndexedDb';
import { createLocalAttachmentMetadataRepository } from './attachmentMetadataIndexedDb';

export const SUPPORTED_LOCAL_IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
]);
export const LOCAL_IMAGE_ATTACHMENT_MAX_BYTES = 15 * 1024 * 1024;

export interface AttachLocalImageInput {
  noteId: string;
  file: File;
  currentBody: string;
  repository?: AttachmentRepository;
  blobAdapter?: BlobStorageAdapter;
  now?: () => string;
  idFactory?: () => string;
}

export interface AttachLocalImageResult {
  metadata: AttachmentMetadata;
  body: string;
  reference: string;
}

function randomId(): string {
  const fromCrypto = globalThis.crypto?.randomUUID?.();
  if (fromCrypto) return `att-${fromCrypto}`;
  return `att-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function validateLocalImageFile(file: File): string | null {
  if (!SUPPORTED_LOCAL_IMAGE_TYPES.has(file.type)) return 'Unsupported image type';
  if (!Number.isFinite(file.size) || file.size <= 0) return 'Image file is empty';
  if (file.size > LOCAL_IMAGE_ATTACHMENT_MAX_BYTES) return 'Image file is too large';
  return null;
}

async function checksumBlob(blob: Blob): Promise<string | undefined> {
  if (!globalThis.crypto?.subtle) return undefined;
  try {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
    const hex = Array.from(new Uint8Array(digest))
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('');
    return `sha256:${hex}`;
  } catch {
    return undefined;
  }
}

export function appendAttachmentReferenceToBody(body: string, reference: string): string {
  const trimmed = body.trimEnd();
  if (trimmed.includes(reference)) return body;
  return `${trimmed}${trimmed ? '\n\n' : ''}${reference}`;
}

export async function attachLocalImageToNote(input: AttachLocalImageInput): Promise<AttachLocalImageResult> {
  const validationError = validateLocalImageFile(input.file);
  if (validationError) throw new Error(validationError);

  const repository = input.repository ?? createLocalAttachmentMetadataRepository();
  const blobAdapter = input.blobAdapter ?? createLocalAttachmentBlobAdapter();
  const now = input.now ?? (() => new Date().toISOString());
  const id = input.idFactory?.() ?? randomId();
  const createdAt = now();
  const localBlobKey = `local-image/${id}`;
  const checksum = await checksumBlob(input.file);

  await blobAdapter.putBlob({
    key: localBlobKey,
    blob: input.file,
    mimeType: input.file.type,
    checksum,
  });

  const metadata: AttachmentMetadata = {
    id,
    noteId: input.noteId,
    fileName: input.file.name || `${id}.image`,
    mimeType: input.file.type,
    size: input.file.size,
    checksum,
    localBlobKey,
    alt: input.file.name.replace(/\.[^.]+$/, '') || undefined,
    source: 'local',
    createdAt,
    updatedAt: createdAt,
    deletedAt: null,
    syncStatus: 'local',
  };

  await repository.putAttachment(metadata);
  const reference = attachmentReference(id);
  return {
    metadata,
    reference,
    body: appendAttachmentReferenceToBody(input.currentBody, reference),
  };
}
