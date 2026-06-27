import { createLocalAttachmentBlobAdapter } from './attachmentBlobIndexedDb';
import { createLocalAttachmentMetadataRepository } from './attachmentMetadataIndexedDb';
import {
  attachmentReference,
  type AttachmentMetadata,
  type AttachmentRepository,
  type BlobStorageAdapter,
} from './attachmentRepository';
import { findEmbeddedPayloadsInText } from './embeddedAttachmentAudit';

export const EMBEDDED_ATTACHMENT_MIGRATION_VERSION = 'k149-embedded-attachment-migration-v1';
export const EMBEDDED_ATTACHMENT_MIGRATION_BACKUP_PREFIX =
  'absinthe.notes.embeddedAttachmentMigration.backup.';

const DATA_URL_BASE64_PATTERN =
  /\bdata:([^;,\s)"']+)(?:;[^,\s)"']*)*;base64,([A-Za-z0-9+/=]+)/gi;

const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
};

export interface EmbeddedAttachmentMigrationNote {
  id: string;
  title?: string | null;
  body?: string | null;
  content?: string | null;
  updatedAt?: string | null;
}

export interface EmbeddedAttachmentMigrationBackupCandidate {
  mimeType: string;
  kind: 'image' | 'pdf' | 'other';
  field: 'body' | 'content';
  estimatedDecodedBytes: number;
  sourceHash: string;
}

export interface EmbeddedAttachmentMigrationBackup {
  noteId: string;
  originalBody?: string | null;
  originalContent?: string | null;
  originalUpdatedAt?: string | null;
  migrationId: string;
  migrationVersion: string;
  createdAt: string;
  candidateSummary: EmbeddedAttachmentMigrationBackupCandidate[];
  checksum: string;
}

export interface EmbeddedAttachmentMigrationBackupWriter {
  writeBackup(backup: EmbeddedAttachmentMigrationBackup): Promise<{ key: string }>;
}

export interface EmbeddedAttachmentMigrationDependencies {
  notes: readonly EmbeddedAttachmentMigrationNote[];
  updateNote(noteId: string, patch: Pick<EmbeddedAttachmentMigrationNote, 'body' | 'content'>): Promise<void>;
  backupWriter?: EmbeddedAttachmentMigrationBackupWriter;
  repository?: AttachmentRepository;
  blobAdapter?: BlobStorageAdapter;
  now?: () => string;
}

export type EmbeddedAttachmentNoteMigrationStatus = 'migrated' | 'skipped' | 'failed';

export interface EmbeddedAttachmentMigrationNoteResult {
  noteId: string;
  status: EmbeddedAttachmentNoteMigrationStatus;
  candidatesFound: number;
  migratedCount: number;
  skippedCount: number;
  failedCount: number;
  backupKey?: string;
  bodyRewritten?: boolean;
  previousBodyHash?: string;
  previousContentHash?: string;
  rewrittenBodyHash?: string;
  rewrittenContentHash?: string;
  attachmentIds: string[];
  blobKeys: string[];
  orphanedAttachmentIds: string[];
  orphanedBlobKeys: string[];
  errors: string[];
}

export interface EmbeddedAttachmentMigrationReport {
  migrationId: string;
  migrationVersion: string;
  startedAt: string;
  completedAt: string;
  dryRun: false;
  notesScanned: number;
  notesWithCandidates: number;
  notesMigrated: number;
  payloadsMigrated: number;
  payloadsSkipped: number;
  payloadsFailed: number;
  backupsCreated: number;
  attachmentsCreated: number;
  blobsWritten: number;
  totalEstimatedDecodedBytes: number;
  noteResults: EmbeddedAttachmentMigrationNoteResult[];
}

interface EmbeddedDataUrlMatch {
  raw: string;
  mimeType: string;
  base64: string;
  startOffset: number;
  endOffset: number;
  field: 'body' | 'content';
  kind: 'image' | 'pdf' | 'other';
  estimatedDecodedBytes: number;
  sourceHash: string;
}

function defaultNow(): string {
  return new Date().toISOString();
}

function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(DATA_URL_BASE64_PATTERN, dataUrl => {
    const mimeType = dataUrl.slice(5, dataUrl.indexOf(';base64,'));
    return `data:${mimeType};base64,[omitted]`;
  });
}

function classifyMimeType(mimeType: string): EmbeddedDataUrlMatch['kind'] {
  const lower = mimeType.toLowerCase();
  if (lower.startsWith('image/')) return 'image';
  if (lower === 'application/pdf') return 'pdf';
  return 'other';
}

export function hashEmbeddedAttachmentMigrationText(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function attachmentIdForSourceHash(sourceHash: string): string {
  return `att-migrated-${sourceHash.replace(/[^A-Za-z0-9]/g, '').slice(0, 24)}`;
}

function extensionForMimeType(mimeType: string): string {
  return IMAGE_EXTENSIONS[mimeType.toLowerCase()] ?? 'bin';
}

function estimateDecodedBytes(base64: string): number {
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

function findMatchesInField(
  noteId: string,
  field: 'body' | 'content',
  text: string,
): EmbeddedDataUrlMatch[] {
  const auditCandidates = findEmbeddedPayloadsInText(noteId, text);
  if (auditCandidates.length === 0) return [];

  const matches: EmbeddedDataUrlMatch[] = [];
  DATA_URL_BASE64_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = DATA_URL_BASE64_PATTERN.exec(text)) !== null) {
    const raw = match[0];
    const mimeType = match[1]?.toLowerCase() ?? 'application/octet-stream';
    const base64 = match[2] ?? '';
    const sourceHash = hashEmbeddedAttachmentMigrationText(raw);
    matches.push({
      raw,
      mimeType,
      base64,
      startOffset: match.index,
      endOffset: match.index + raw.length,
      field,
      kind: classifyMimeType(mimeType),
      estimatedDecodedBytes: estimateDecodedBytes(base64),
      sourceHash,
    });
  }
  return matches;
}

function findMatches(note: EmbeddedAttachmentMigrationNote): EmbeddedDataUrlMatch[] {
  return [
    ...findMatchesInField(note.id, 'body', note.body ?? ''),
    ...findMatchesInField(note.id, 'content', note.content ?? ''),
  ];
}

function decodeBase64Payload(base64: string, mimeType: string): Blob {
  const normalized = base64.replace(/\s/g, '');
  if (!normalized || normalized.length % 4 === 1) {
    throw new Error('Invalid base64 payload');
  }
  let binary = '';
  try {
    binary = atob(normalized);
  } catch {
    throw new Error('Invalid base64 payload');
  }

  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mimeType });
}

function rewriteField(text: string, replacements: readonly { raw: string; reference: string }[]): string {
  return replacements.reduce(
    (next, replacement) => next.split(replacement.raw).join(replacement.reference),
    text,
  );
}

function createMetadata(input: {
  noteId: string;
  match: EmbeddedDataUrlMatch;
  id: string;
  localBlobKey: string;
  size: number;
  now: string;
}): AttachmentMetadata {
  const extension = extensionForMimeType(input.match.mimeType);
  const shortHash = input.match.sourceHash.replace(/[^A-Za-z0-9]/g, '').slice(0, 12);
  return {
    id: input.id,
    noteId: input.noteId,
    fileName: `migrated-attachment-${shortHash}.${extension}`,
    mimeType: input.match.mimeType,
    size: input.size,
    checksum: input.match.sourceHash,
    localBlobKey: input.localBlobKey,
    source: 'local',
    createdAt: input.now,
    updatedAt: input.now,
    deletedAt: null,
    syncStatus: 'local',
  };
}

export function createLocalEmbeddedAttachmentMigrationBackupWriter(): EmbeddedAttachmentMigrationBackupWriter {
  return {
    async writeBackup(backup) {
      const key = `${EMBEDDED_ATTACHMENT_MIGRATION_BACKUP_PREFIX}${backup.migrationId}.${backup.noteId}.${backup.createdAt}`;
      localStorage.setItem(key, JSON.stringify(backup));
      return { key };
    },
  };
}

export async function migrateEmbeddedDataUrlsToAttachments(
  input: EmbeddedAttachmentMigrationDependencies,
): Promise<EmbeddedAttachmentMigrationReport> {
  const repository = input.repository ?? createLocalAttachmentMetadataRepository();
  const blobAdapter = input.blobAdapter ?? createLocalAttachmentBlobAdapter();
  const backupWriter = input.backupWriter ?? createLocalEmbeddedAttachmentMigrationBackupWriter();
  const now = input.now ?? defaultNow;
  const startedAt = now();
  const migrationId = `${EMBEDDED_ATTACHMENT_MIGRATION_VERSION}-${startedAt}`;

  const report: EmbeddedAttachmentMigrationReport = {
    migrationId,
    migrationVersion: EMBEDDED_ATTACHMENT_MIGRATION_VERSION,
    startedAt,
    completedAt: startedAt,
    dryRun: false,
    notesScanned: input.notes.length,
    notesWithCandidates: 0,
    notesMigrated: 0,
    payloadsMigrated: 0,
    payloadsSkipped: 0,
    payloadsFailed: 0,
    backupsCreated: 0,
    attachmentsCreated: 0,
    blobsWritten: 0,
    totalEstimatedDecodedBytes: 0,
    noteResults: [],
  };

  for (const note of input.notes) {
    const matches = findMatches(note);
    if (matches.length === 0) {
      report.noteResults.push({
        noteId: note.id,
        status: 'skipped',
        candidatesFound: 0,
        migratedCount: 0,
        skippedCount: 0,
        failedCount: 0,
        attachmentIds: [],
        blobKeys: [],
        orphanedAttachmentIds: [],
        orphanedBlobKeys: [],
        errors: [],
      });
      continue;
    }

    report.notesWithCandidates += 1;
    report.totalEstimatedDecodedBytes += matches.reduce((sum, match) => sum + match.estimatedDecodedBytes, 0);
    const noteResult: EmbeddedAttachmentMigrationNoteResult = {
      noteId: note.id,
      status: 'failed',
      candidatesFound: matches.length,
      migratedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      attachmentIds: [],
      blobKeys: [],
      orphanedAttachmentIds: [],
      orphanedBlobKeys: [],
      errors: [],
    };

    try {
      const backup = {
        noteId: note.id,
        originalBody: note.body ?? null,
        originalContent: note.content ?? null,
        originalUpdatedAt: note.updatedAt ?? null,
        migrationId,
        migrationVersion: EMBEDDED_ATTACHMENT_MIGRATION_VERSION,
        createdAt: now(),
        candidateSummary: matches.map(match => ({
          mimeType: match.mimeType,
          kind: match.kind,
          field: match.field,
          estimatedDecodedBytes: match.estimatedDecodedBytes,
          sourceHash: match.sourceHash,
        })),
        checksum: hashEmbeddedAttachmentMigrationText(`${note.body ?? ''}\n${note.content ?? ''}`),
      } satisfies EmbeddedAttachmentMigrationBackup;

      const { key } = await backupWriter.writeBackup(backup);
      noteResult.backupKey = key;
      report.backupsCreated += 1;

      const replacements: Array<EmbeddedDataUrlMatch & { reference: string }> = [];
      for (const match of matches) {
        const id = attachmentIdForSourceHash(match.sourceHash);
        const localBlobKey = `local-attachment/${id}`;
        const blob = decodeBase64Payload(match.base64, match.mimeType);

        await blobAdapter.putBlob({
          key: localBlobKey,
          blob,
          mimeType: match.mimeType,
          checksum: match.sourceHash,
        });
        report.blobsWritten += 1;
        noteResult.blobKeys.push(localBlobKey);
        noteResult.orphanedBlobKeys.push(localBlobKey);

        const metadata = createMetadata({
          noteId: note.id,
          match,
          id,
          localBlobKey,
          size: blob.size,
          now: now(),
        });
        await repository.putAttachment(metadata);
        report.attachmentsCreated += 1;
        noteResult.attachmentIds.push(id);
        noteResult.orphanedAttachmentIds.push(id);
        replacements.push({ ...match, reference: attachmentReference(id) });
      }

      const bodyReplacements = replacements.filter(replacement => replacement.field === 'body');
      const contentReplacements = replacements.filter(replacement => replacement.field === 'content');
      const nextBody = rewriteField(note.body ?? '', bodyReplacements);
      const nextContent = rewriteField(note.content ?? '', contentReplacements);
      const notePatch: Pick<EmbeddedAttachmentMigrationNote, 'body' | 'content'> = {};
      if (typeof note.body === 'string' || bodyReplacements.length > 0) notePatch.body = nextBody;
      if (typeof note.content === 'string' || contentReplacements.length > 0) notePatch.content = nextContent;

      await input.updateNote(note.id, notePatch);

      noteResult.status = 'migrated';
      noteResult.bodyRewritten = true;
      noteResult.previousBodyHash = hashEmbeddedAttachmentMigrationText(note.body ?? '');
      noteResult.previousContentHash = hashEmbeddedAttachmentMigrationText(note.content ?? '');
      noteResult.rewrittenBodyHash = hashEmbeddedAttachmentMigrationText(nextBody);
      noteResult.rewrittenContentHash = hashEmbeddedAttachmentMigrationText(nextContent);
      noteResult.migratedCount = replacements.length;
      noteResult.failedCount = 0;
      noteResult.orphanedAttachmentIds = [];
      noteResult.orphanedBlobKeys = [];
      report.notesMigrated += 1;
      report.payloadsMigrated += replacements.length;
    } catch (error) {
      noteResult.status = 'failed';
      noteResult.failedCount = Math.max(1, matches.length - noteResult.migratedCount);
      noteResult.errors.push(safeError(error));
      report.payloadsFailed += noteResult.failedCount;
    }

    report.noteResults.push(noteResult);
  }

  report.completedAt = now();
  return report;
}
