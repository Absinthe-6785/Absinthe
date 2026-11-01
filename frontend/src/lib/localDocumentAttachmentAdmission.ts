import { LOCAL_ATTACHMENT_FILE_MAX_BYTES } from './localAttachmentFilePolicy';

export const LOCAL_DOCUMENT_ATTACHMENT_MAX_BYTES = LOCAL_ATTACHMENT_FILE_MAX_BYTES;

export type LocalDocumentFormat = 'pdf' | 'docx';
export type LocalDocumentAdmissionReason =
  | 'invalid_file'
  | 'unsafe_filename'
  | 'ambiguous_extension'
  | 'unsupported_extension'
  | 'invalid_mime'
  | 'mime_extension_mismatch'
  | 'invalid_size'
  | 'empty_file'
  | 'file_too_large';

export type LocalDocumentFileAdmission =
  | Readonly<{
      status: 'ELIGIBLE_BY_DECLARATION';
      format: LocalDocumentFormat;
      file: File;
      /** Exact, untrusted File.name for display only; never an identity or path. */
      displayName: string;
      declaredMimeType: string;
      size: number;
      contentIntegrity: 'UNVERIFIED';
    }>
  | Readonly<{ status: 'REJECTED'; reason: LocalDocumentAdmissionReason }>;

export type LocalDocumentDeclarationAdmission =
  | Readonly<{
      status: 'ELIGIBLE_BY_DECLARATION';
      format: LocalDocumentFormat;
      displayName: string;
      declaredMimeType: string;
      size: number;
      contentIntegrity: 'UNVERIFIED';
    }>
  | Readonly<{ status: 'REJECTED'; reason: LocalDocumentAdmissionReason }>;

const MIME_BY_EXTENSION: Readonly<Record<LocalDocumentFormat, string>> = Object.freeze({
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
});

const RECOGNIZED_DOCUMENT_SUFFIX = /\.(?:pdf|docx|docm|doc)(?=\.|$)/gi;
const UNSAFE_DISPLAY_NAME = /[\\/\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u;

function rejected(reason: LocalDocumentAdmissionReason): LocalDocumentFileAdmission {
  return Object.freeze({ status: 'REJECTED', reason });
}

/**
 * Checks only the declared filename extension, MIME type, and bounded File size.
 * It does not read, parse, convert, or establish the integrity/safety of bytes.
 * The exact immutable File is returned for a later scoped attachment operation.
 */
export function admitLocalDocumentDeclaration(
  declaration: Pick<File, 'name' | 'type' | 'size'>,
): LocalDocumentDeclarationAdmission {
  if (!declaration || typeof declaration !== 'object'
    || typeof declaration.name !== 'string' || typeof declaration.type !== 'string') {
    return rejected('invalid_file');
  }
  const name = declaration.name;
  if (!name || UNSAFE_DISPLAY_NAME.test(name)) return rejected('unsafe_filename');
  if (!name.includes('.')) return rejected('unsupported_extension');

  const suffixes = name.match(RECOGNIZED_DOCUMENT_SUFFIX) ?? [];
  if (suffixes.length > 1) return rejected('ambiguous_extension');

  const extension = name.slice(name.lastIndexOf('.') + 1).toLowerCase();
  if (extension !== 'pdf' && extension !== 'docx') return rejected('unsupported_extension');

  const mimeType = declaration.type.toLowerCase();
  if (!mimeType || !Object.values(MIME_BY_EXTENSION).includes(mimeType)) return rejected('invalid_mime');
  if (mimeType !== MIME_BY_EXTENSION[extension]) return rejected('mime_extension_mismatch');

  if (!Number.isSafeInteger(declaration.size) || declaration.size < 0) return rejected('invalid_size');
  if (declaration.size === 0) return rejected('empty_file');
  if (declaration.size > LOCAL_DOCUMENT_ATTACHMENT_MAX_BYTES) return rejected('file_too_large');

  return Object.freeze({
    status: 'ELIGIBLE_BY_DECLARATION',
    format: extension,
    displayName: name,
    declaredMimeType: declaration.type,
    size: declaration.size,
    contentIntegrity: 'UNVERIFIED',
  });
}

export function admitLocalDocumentFile(file: File): LocalDocumentFileAdmission {
  const declaration = admitLocalDocumentDeclaration(file);
  if (declaration.status !== 'ELIGIBLE_BY_DECLARATION') return declaration;
  return Object.freeze({ ...declaration, file });
}
