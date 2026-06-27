import {
  EMBEDDED_ATTACHMENT_MIGRATION_BACKUP_PREFIX,
  EMBEDDED_ATTACHMENT_MIGRATION_VERSION,
  hashEmbeddedAttachmentMigrationText,
  type EmbeddedAttachmentMigrationBackup,
  type EmbeddedAttachmentMigrationNote,
} from './embeddedAttachmentMigration';

export interface EmbeddedAttachmentMigrationBackupReader {
  listBackupKeys(): Promise<string[]>;
  getBackup(key: string): Promise<EmbeddedAttachmentMigrationBackup | null>;
}

export interface EmbeddedAttachmentMigrationBackupSummary {
  backupKey: string;
  noteId: string;
  migrationId: string;
  migrationVersion: string;
  createdAt: string;
  originalUpdatedAt?: string | null;
  originalBodyBytes: number;
  originalContentBytes: number;
  candidateCount: number;
  estimatedDecodedBytes: number;
  mimeTypes: string[];
  checksum: string;
}

export interface EmbeddedAttachmentMigrationRestoreInput {
  noteId: string;
  backupKey: string;
  readCurrentNote(noteId: string): Promise<EmbeddedAttachmentMigrationNote | null>;
  updateNote(noteId: string, patch: Pick<EmbeddedAttachmentMigrationNote, 'body' | 'content'>): Promise<void>;
  backupReader?: EmbeddedAttachmentMigrationBackupReader;
  expectedCurrentBodyHash?: string;
  expectedCurrentContentHash?: string;
  force?: boolean;
}

export interface EmbeddedAttachmentMigrationRestoreReport {
  noteId: string;
  backupKey: string;
  restored: boolean;
  forced: boolean;
  previousBodyHash?: string;
  previousContentHash?: string;
  restoredBodyHash?: string;
  restoredContentHash?: string;
  warnings: string[];
  errors: string[];
}

function byteLength(value: string | null | undefined): number {
  return new Blob([value ?? '']).size;
}

function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/\bdata:([^;,\s)"']+)(?:;[^,\s)"']*)*;base64,([A-Za-z0-9+/=]+)/gi, dataUrl => {
    const mimeType = dataUrl.slice(5, dataUrl.indexOf(';base64,'));
    return `data:${mimeType};base64,[omitted]`;
  });
}

function isMigrationBackup(value: unknown): value is EmbeddedAttachmentMigrationBackup {
  if (!value || typeof value !== 'object') return false;
  const backup = value as Partial<EmbeddedAttachmentMigrationBackup>;
  return (
    typeof backup.noteId === 'string'
    && typeof backup.migrationId === 'string'
    && typeof backup.migrationVersion === 'string'
    && typeof backup.createdAt === 'string'
    && Array.isArray(backup.candidateSummary)
    && typeof backup.checksum === 'string'
  );
}

export function createLocalEmbeddedAttachmentMigrationBackupReader(): EmbeddedAttachmentMigrationBackupReader {
  return {
    async listBackupKeys() {
      const keys: string[] = [];
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (key?.startsWith(EMBEDDED_ATTACHMENT_MIGRATION_BACKUP_PREFIX)) keys.push(key);
      }
      return keys.sort();
    },
    async getBackup(key) {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as unknown;
      return isMigrationBackup(parsed) ? parsed : null;
    },
  };
}

export async function getEmbeddedAttachmentMigrationBackup(
  backupKey: string,
  reader: EmbeddedAttachmentMigrationBackupReader = createLocalEmbeddedAttachmentMigrationBackupReader(),
): Promise<EmbeddedAttachmentMigrationBackup | null> {
  try {
    return await reader.getBackup(backupKey);
  } catch {
    return null;
  }
}

export async function listEmbeddedAttachmentMigrationBackups(
  reader: EmbeddedAttachmentMigrationBackupReader = createLocalEmbeddedAttachmentMigrationBackupReader(),
): Promise<EmbeddedAttachmentMigrationBackupSummary[]> {
  const keys = await reader.listBackupKeys();
  const summaries: EmbeddedAttachmentMigrationBackupSummary[] = [];
  for (const key of keys) {
    const backup = await getEmbeddedAttachmentMigrationBackup(key, reader);
    if (backup) summaries.push(summarizeEmbeddedAttachmentMigrationBackup(key, backup));
  }
  return summaries;
}

export async function listEmbeddedAttachmentMigrationBackupsForNote(
  noteId: string,
  reader: EmbeddedAttachmentMigrationBackupReader = createLocalEmbeddedAttachmentMigrationBackupReader(),
): Promise<EmbeddedAttachmentMigrationBackupSummary[]> {
  const summaries = await listEmbeddedAttachmentMigrationBackups(reader);
  return summaries.filter(summary => summary.noteId === noteId);
}

export function summarizeEmbeddedAttachmentMigrationBackup(
  backupKey: string,
  backup: EmbeddedAttachmentMigrationBackup,
): EmbeddedAttachmentMigrationBackupSummary {
  return {
    backupKey,
    noteId: backup.noteId,
    migrationId: backup.migrationId,
    migrationVersion: backup.migrationVersion || EMBEDDED_ATTACHMENT_MIGRATION_VERSION,
    createdAt: backup.createdAt,
    originalUpdatedAt: backup.originalUpdatedAt,
    originalBodyBytes: byteLength(backup.originalBody),
    originalContentBytes: byteLength(backup.originalContent),
    candidateCount: backup.candidateSummary.length,
    estimatedDecodedBytes: backup.candidateSummary.reduce(
      (sum, candidate) => sum + candidate.estimatedDecodedBytes,
      0,
    ),
    mimeTypes: [...new Set(backup.candidateSummary.map(candidate => candidate.mimeType))].sort(),
    checksum: backup.checksum,
  };
}

export async function restoreEmbeddedAttachmentMigrationBackup(
  input: EmbeddedAttachmentMigrationRestoreInput,
): Promise<EmbeddedAttachmentMigrationRestoreReport> {
  const report: EmbeddedAttachmentMigrationRestoreReport = {
    noteId: input.noteId,
    backupKey: input.backupKey,
    restored: false,
    forced: Boolean(input.force),
    warnings: [],
    errors: [],
  };

  const reader = input.backupReader ?? createLocalEmbeddedAttachmentMigrationBackupReader();
  let backup: EmbeddedAttachmentMigrationBackup | null = null;
  try {
    backup = await reader.getBackup(input.backupKey);
  } catch (error) {
    report.errors.push(`Backup is missing or corrupted: ${safeError(error)}`);
    return report;
  }

  if (!backup || !isMigrationBackup(backup)) {
    report.errors.push('Backup is missing or corrupted.');
    return report;
  }

  if (backup.noteId !== input.noteId) {
    report.errors.push('Backup belongs to a different note.');
    return report;
  }

  const current = await input.readCurrentNote(input.noteId);
  if (!current) {
    report.errors.push('Current note was not found.');
    return report;
  }

  const currentBody = current.body ?? '';
  const currentContent = current.content ?? '';
  report.previousBodyHash = hashEmbeddedAttachmentMigrationText(currentBody);
  report.previousContentHash = hashEmbeddedAttachmentMigrationText(currentContent);

  if (!input.force) {
    if (input.expectedCurrentBodyHash && input.expectedCurrentBodyHash !== report.previousBodyHash) {
      report.errors.push('Current note body changed after migration. Restore was refused.');
      return report;
    }
    if (input.expectedCurrentContentHash && input.expectedCurrentContentHash !== report.previousContentHash) {
      report.errors.push('Current note content changed after migration. Restore was refused.');
      return report;
    }
  }

  const nextBody = backup.originalBody ?? '';
  const nextContent = backup.originalContent ?? null;
  await input.updateNote(input.noteId, {
    body: nextBody,
    content: nextContent,
  });

  report.restored = true;
  report.restoredBodyHash = hashEmbeddedAttachmentMigrationText(nextBody);
  report.restoredContentHash = hashEmbeddedAttachmentMigrationText(nextContent ?? '');
  if (input.force) report.warnings.push('Restore was forced over current note content.');
  return report;
}
