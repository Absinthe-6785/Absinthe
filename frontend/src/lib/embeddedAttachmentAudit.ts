export type EmbeddedPayloadKind = 'image' | 'pdf' | 'other';

export interface EmbeddedAttachmentAuditNoteInput {
  id: string;
  title?: string | null;
  body?: string | null;
  content?: string | null;
}

export interface EmbeddedPayloadCandidate {
  noteId: string;
  mimeType: string;
  kind: EmbeddedPayloadKind;
  matchIndex: number;
  startOffset: number;
  endOffset: number;
  previewLabel: string;
  estimatedBase64Bytes: number;
  estimatedDecodedBytes: number;
  recommendedTarget: 'local-attachment';
}

export interface EmbeddedAttachmentAuditNoteCandidate {
  noteId: string;
  noteTitle?: string;
  payloadCount: number;
  estimatedBase64Bytes: number;
  estimatedDecodedBytes: number;
  payloads: EmbeddedPayloadCandidate[];
}

export interface EmbeddedAttachmentAuditSummary {
  totalNotesScanned: number;
  notesWithEmbeddedPayloads: number;
  totalEmbeddedPayloads: number;
  totalEstimatedBase64Bytes: number;
  totalEstimatedDecodedBytes: number;
  imagePayloadCount: number;
  pdfPayloadCount: number;
  otherDataPayloadCount: number;
}

export interface EmbeddedAttachmentAuditReport {
  summary: EmbeddedAttachmentAuditSummary;
  candidates: EmbeddedAttachmentAuditNoteCandidate[];
  k149MigrationRequirements: readonly string[];
}

export const K149_EMBEDDED_ATTACHMENT_MIGRATION_REQUIREMENTS = [
  'Backup the original note body before any replacement.',
  'Copy each embedded data payload to local blob storage before editing the note.',
  'Create attachment metadata linked to the source note.',
  'Replace the embedded data URL with an attachment:// reference only after blob and metadata writes succeed.',
  'Make migration idempotent so repeated runs do not duplicate attachments.',
  'Preserve user data on failure and never delete the original before replacement succeeds.',
  'Provide rollback or backup inspection for migrated notes.',
] as const;

const DATA_URL_BASE64_PATTERN =
  /\bdata:([^;,\s)"']+)(?:;[^,\s)"']*)*;base64,([A-Za-z0-9+/=]+)/gi;

function classifyMimeType(mimeType: string): EmbeddedPayloadKind {
  const lower = mimeType.toLowerCase();
  if (lower.startsWith('image/')) return 'image';
  if (lower === 'application/pdf') return 'pdf';
  return 'other';
}

export function estimateDecodedBase64Bytes(base64: string): number {
  const sanitized = base64.replace(/\s/g, '');
  if (!sanitized) return 0;
  const padding = sanitized.endsWith('==') ? 2 : sanitized.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((sanitized.length * 3) / 4) - padding);
}

function safePayloadPreview(mimeType: string, base64: string): string {
  const suffix = base64.length > 0 ? `${base64.slice(0, 4)}...` : 'empty';
  return `${mimeType};base64,${suffix}`;
}

function textForAudit(note: EmbeddedAttachmentAuditNoteInput): string {
  return `${note.body ?? ''}\n${note.content ?? ''}`;
}

export function findEmbeddedPayloadsInText(noteId: string, text: string): EmbeddedPayloadCandidate[] {
  const candidates: EmbeddedPayloadCandidate[] = [];
  DATA_URL_BASE64_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = DATA_URL_BASE64_PATTERN.exec(text)) !== null) {
    const mimeType = match[1]?.toLowerCase() ?? 'application/octet-stream';
    const base64 = match[2] ?? '';
    const kind = classifyMimeType(mimeType);
    candidates.push({
      noteId,
      mimeType,
      kind,
      matchIndex: candidates.length,
      startOffset: match.index,
      endOffset: match.index + match[0].length,
      previewLabel: safePayloadPreview(mimeType, base64),
      estimatedBase64Bytes: base64.length,
      estimatedDecodedBytes: estimateDecodedBase64Bytes(base64),
      recommendedTarget: 'local-attachment',
    });
  }
  return candidates;
}

export function auditEmbeddedAttachments(
  notes: readonly EmbeddedAttachmentAuditNoteInput[],
): EmbeddedAttachmentAuditReport {
  const candidates: EmbeddedAttachmentAuditNoteCandidate[] = [];
  const summary: EmbeddedAttachmentAuditSummary = {
    totalNotesScanned: notes.length,
    notesWithEmbeddedPayloads: 0,
    totalEmbeddedPayloads: 0,
    totalEstimatedBase64Bytes: 0,
    totalEstimatedDecodedBytes: 0,
    imagePayloadCount: 0,
    pdfPayloadCount: 0,
    otherDataPayloadCount: 0,
  };

  for (const note of notes) {
    const payloads = findEmbeddedPayloadsInText(note.id, textForAudit(note));
    if (payloads.length === 0) continue;

    const estimatedBase64Bytes = payloads.reduce((sum, payload) => sum + payload.estimatedBase64Bytes, 0);
    const estimatedDecodedBytes = payloads.reduce((sum, payload) => sum + payload.estimatedDecodedBytes, 0);
    candidates.push({
      noteId: note.id,
      noteTitle: note.title ?? undefined,
      payloadCount: payloads.length,
      estimatedBase64Bytes,
      estimatedDecodedBytes,
      payloads,
    });

    summary.notesWithEmbeddedPayloads += 1;
    summary.totalEmbeddedPayloads += payloads.length;
    summary.totalEstimatedBase64Bytes += estimatedBase64Bytes;
    summary.totalEstimatedDecodedBytes += estimatedDecodedBytes;
    for (const payload of payloads) {
      if (payload.kind === 'image') summary.imagePayloadCount += 1;
      else if (payload.kind === 'pdf') summary.pdfPayloadCount += 1;
      else summary.otherDataPayloadCount += 1;
    }
  }

  return {
    summary,
    candidates,
    k149MigrationRequirements: K149_EMBEDDED_ATTACHMENT_MIGRATION_REQUIREMENTS,
  };
}
