import { describe, expect, it, vi } from 'vitest';
import type {
  AttachmentMetadata,
  AttachmentRepository,
  BlobStorageAdapter,
} from './attachmentRepository';
import {
  EMBEDDED_ATTACHMENT_MIGRATION_BACKUP_PREFIX,
  hashEmbeddedAttachmentMigrationText,
  migrateEmbeddedDataUrlsToAttachments,
  type EmbeddedAttachmentMigrationBackup,
  type EmbeddedAttachmentMigrationNote,
} from './embeddedAttachmentMigration';
import {
  listEmbeddedAttachmentMigrationBackupsForNote,
  restoreEmbeddedAttachmentMigrationBackup,
  summarizeEmbeddedAttachmentMigrationBackup,
  type EmbeddedAttachmentMigrationBackupReader,
} from './embeddedAttachmentMigrationRestore';

function memoryRepository(): AttachmentRepository & { records: Map<string, AttachmentMetadata> } {
  const records = new Map<string, AttachmentMetadata>();
  return {
    records,
    async listAttachments() { return [...records.values()]; },
    async listAttachmentsForNote(noteId) { return [...records.values()].filter(item => item.noteId === noteId); },
    async getAttachment(id) { return records.get(id) ?? null; },
    async putAttachment(metadata) { records.set(metadata.id, metadata); },
    async updateAttachment(id, patch) {
      const current = records.get(id);
      if (current) records.set(id, { ...current, ...patch, id: current.id, createdAt: current.createdAt });
    },
    async tombstoneAttachment(id, deletedAt = '2026-01-03T00:00:00.000Z') {
      await this.updateAttachment(id, { deletedAt, updatedAt: deletedAt, syncStatus: 'deleted' });
    },
    async deleteAttachmentMetadata(id) { records.delete(id); },
    async putMetadata(metadata) {
      await this.putAttachment(metadata);
      return metadata;
    },
    async getMetadata(id) { return this.getAttachment(id); },
    async listForNote(noteId) { return this.listAttachmentsForNote(noteId); },
    async markDeleted(id, deletedAt) {
      await this.tombstoneAttachment(id, deletedAt);
      return this.getAttachment(id);
    },
  };
}

function memoryBlobAdapter(): BlobStorageAdapter & { records: Map<string, Blob> } {
  const records = new Map<string, Blob>();
  return {
    records,
    async putBlob(input) {
      records.set(input.key, input.blob);
      return {
        key: input.key,
        blob: input.blob,
        mimeType: input.mimeType,
        size: input.blob.size,
        checksum: input.checksum,
      };
    },
    async getBlob(key) {
      const blob = records.get(key);
      return blob ? { key, blob, mimeType: blob.type, size: blob.size } : null;
    },
    async deleteBlob(key) { records.delete(key); },
    async getObjectUrl() { return null; },
  };
}

function memoryBackupStore() {
  const backups = new Map<string, EmbeddedAttachmentMigrationBackup>();
  const reader: EmbeddedAttachmentMigrationBackupReader = {
    async listBackupKeys() { return [...backups.keys()].sort(); },
    async getBackup(key) { return backups.get(key) ?? null; },
  };
  return {
    backups,
    reader,
    writer: {
      async writeBackup(backup: EmbeddedAttachmentMigrationBackup) {
        const key = `${EMBEDDED_ATTACHMENT_MIGRATION_BACKUP_PREFIX}${backup.migrationId}.${backup.noteId}`;
        backups.set(key, backup);
        return { key };
      },
    },
  };
}

function updaterFor(notes: Map<string, EmbeddedAttachmentMigrationNote>) {
  return vi.fn(async (noteId: string, patch: Pick<EmbeddedAttachmentMigrationNote, 'body' | 'content'>) => {
    const current = notes.get(noteId);
    if (!current) throw new Error('missing note');
    notes.set(noteId, { ...current, ...patch });
  });
}

async function readNote(notes: Map<string, EmbeddedAttachmentMigrationNote>, noteId: string) {
  return notes.get(noteId) ?? null;
}

const realPng =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';

describe('embedded attachment migration restore foundation', () => {
  it('restores a realistic migrated markdown image from its backup without deleting created resources', async () => {
    const originalBody = `Before\n\n![tiny sample](${realPng})\n\nAfter`;
    const notes = new Map([['n1', { id: 'n1', body: originalBody, content: null }]]);
    const repository = memoryRepository();
    const blobAdapter = memoryBlobAdapter();
    const backupStore = memoryBackupStore();
    const updateNote = updaterFor(notes);

    const migrationReport = await migrateEmbeddedDataUrlsToAttachments({
      notes: [...notes.values()],
      updateNote,
      repository,
      blobAdapter,
      backupWriter: backupStore.writer,
      now: () => '2026-06-27T00:00:00.000Z',
    });

    const noteResult = migrationReport.noteResults[0];
    const backupKey = noteResult?.backupKey ?? '';
    expect(notes.get('n1')?.body).toContain('attachment://');
    expect([...backupStore.backups.values()][0]?.originalBody).toBe(originalBody);

    const restoreReport = await restoreEmbeddedAttachmentMigrationBackup({
      noteId: 'n1',
      backupKey,
      backupReader: backupStore.reader,
      readCurrentNote: noteId => readNote(notes, noteId),
      updateNote,
      expectedCurrentBodyHash: noteResult?.rewrittenBodyHash,
      expectedCurrentContentHash: noteResult?.rewrittenContentHash,
    });

    expect(restoreReport).toMatchObject({ restored: true, errors: [] });
    expect(notes.get('n1')?.body).toBe(originalBody);
    expect(repository.records).toHaveLength(1);
    expect(blobAdapter.records).toHaveLength(1);
    expect(backupStore.backups.has(backupKey)).toBe(true);
  });

  it('lists note backups and summarizes them without exposing full base64 payloads', async () => {
    const notes = new Map([['n1', { id: 'n1', body: `![tiny](${realPng})` }]]);
    const backupStore = memoryBackupStore();

    await migrateEmbeddedDataUrlsToAttachments({
      notes: [...notes.values()],
      updateNote: updaterFor(notes),
      repository: memoryRepository(),
      blobAdapter: memoryBlobAdapter(),
      backupWriter: backupStore.writer,
      now: () => '2026-06-27T00:00:00.000Z',
    });

    const [backupKey, backup] = [...backupStore.backups.entries()][0];
    const summary = summarizeEmbeddedAttachmentMigrationBackup(backupKey, backup);
    const noteSummaries = await listEmbeddedAttachmentMigrationBackupsForNote('n1', backupStore.reader);

    expect(summary).toMatchObject({
      backupKey,
      noteId: 'n1',
      candidateCount: 1,
      mimeTypes: ['image/png'],
    });
    expect(JSON.stringify(summary)).not.toContain(realPng);
    expect(JSON.stringify(noteSummaries)).not.toContain(realPng);
    expect(noteSummaries).toHaveLength(1);
  });

  it('refuses to restore a backup for the wrong note', async () => {
    const notes = new Map([['n1', { id: 'n1', body: 'current' }]]);
    const backupStore = memoryBackupStore();
    const backup: EmbeddedAttachmentMigrationBackup = {
      noteId: 'other-note',
      originalBody: 'original',
      originalContent: null,
      originalUpdatedAt: null,
      migrationId: 'migration',
      migrationVersion: 'k149-embedded-attachment-migration-v1',
      createdAt: '2026-06-27T00:00:00.000Z',
      candidateSummary: [],
      checksum: 'fnv1a:00000000',
    };
    backupStore.backups.set('backup-key', backup);

    const updateNote = updaterFor(notes);
    const report = await restoreEmbeddedAttachmentMigrationBackup({
      noteId: 'n1',
      backupKey: 'backup-key',
      backupReader: backupStore.reader,
      readCurrentNote: noteId => readNote(notes, noteId),
      updateNote,
    });

    expect(report.restored).toBe(false);
    expect(report.errors.join(' ')).toContain('different note');
    expect(updateNote).not.toHaveBeenCalled();
  });

  it('handles missing and corrupted backups without rewriting the note', async () => {
    const notes = new Map([['n1', { id: 'n1', body: 'current' }]]);
    const updateNote = updaterFor(notes);

    const missing = await restoreEmbeddedAttachmentMigrationBackup({
      noteId: 'n1',
      backupKey: 'missing',
      backupReader: memoryBackupStore().reader,
      readCurrentNote: noteId => readNote(notes, noteId),
      updateNote,
    });

    const corrupt = await restoreEmbeddedAttachmentMigrationBackup({
      noteId: 'n1',
      backupKey: 'corrupt',
      backupReader: {
        async listBackupKeys() { return ['corrupt']; },
        async getBackup() { throw new Error(`cannot parse ${realPng}`); },
      },
      readCurrentNote: noteId => readNote(notes, noteId),
      updateNote,
    });

    expect(missing.restored).toBe(false);
    expect(corrupt.restored).toBe(false);
    expect(JSON.stringify(corrupt)).not.toContain(realPng);
    expect(updateNote).not.toHaveBeenCalled();
  });

  it('refuses stale restore by default when the current note changed after migration', async () => {
    const originalBody = `![tiny](${realPng})`;
    const notes = new Map([['n1', { id: 'n1', body: originalBody }]]);
    const backupStore = memoryBackupStore();
    const updateNote = updaterFor(notes);

    const migrationReport = await migrateEmbeddedDataUrlsToAttachments({
      notes: [...notes.values()],
      updateNote,
      repository: memoryRepository(),
      blobAdapter: memoryBlobAdapter(),
      backupWriter: backupStore.writer,
    });
    const noteResult = migrationReport.noteResults[0];
    notes.set('n1', { ...notes.get('n1')!, body: `${notes.get('n1')?.body}\nnew local edit` });

    const restoreReport = await restoreEmbeddedAttachmentMigrationBackup({
      noteId: 'n1',
      backupKey: noteResult?.backupKey ?? '',
      backupReader: backupStore.reader,
      readCurrentNote: noteId => readNote(notes, noteId),
      updateNote,
      expectedCurrentBodyHash: noteResult?.rewrittenBodyHash,
    });

    expect(restoreReport.restored).toBe(false);
    expect(restoreReport.errors.join(' ')).toContain('changed after migration');
    expect(notes.get('n1')?.body).toContain('new local edit');
  });

  it('can force restore over a changed current note when explicitly requested', async () => {
    const originalBody = `![tiny](${realPng})`;
    const notes = new Map([['n1', { id: 'n1', body: originalBody }]]);
    const backupStore = memoryBackupStore();
    const updateNote = updaterFor(notes);

    const migrationReport = await migrateEmbeddedDataUrlsToAttachments({
      notes: [...notes.values()],
      updateNote,
      repository: memoryRepository(),
      blobAdapter: memoryBlobAdapter(),
      backupWriter: backupStore.writer,
    });
    const noteResult = migrationReport.noteResults[0];
    notes.set('n1', { ...notes.get('n1')!, body: 'manual edit after migration' });

    const restoreReport = await restoreEmbeddedAttachmentMigrationBackup({
      noteId: 'n1',
      backupKey: noteResult?.backupKey ?? '',
      backupReader: backupStore.reader,
      readCurrentNote: noteId => readNote(notes, noteId),
      updateNote,
      expectedCurrentBodyHash: noteResult?.rewrittenBodyHash,
      force: true,
    });

    expect(restoreReport).toMatchObject({ restored: true, forced: true });
    expect(restoreReport.warnings.join(' ')).toContain('forced');
    expect(notes.get('n1')?.body).toBe(originalBody);
  });

  it('records backup keys, created resources, and rewrite hashes in migration reports', async () => {
    const notes = new Map([['n1', { id: 'n1', body: `![tiny](${realPng})` }]]);

    const report = await migrateEmbeddedDataUrlsToAttachments({
      notes: [...notes.values()],
      updateNote: updaterFor(notes),
      repository: memoryRepository(),
      blobAdapter: memoryBlobAdapter(),
      backupWriter: memoryBackupStore().writer,
      now: () => '2026-06-27T00:00:00.000Z',
    });

    expect(report.noteResults[0]).toMatchObject({
      backupKey: expect.stringContaining(EMBEDDED_ATTACHMENT_MIGRATION_BACKUP_PREFIX),
      bodyRewritten: true,
      attachmentIds: [expect.stringMatching(/^att-migrated-/)],
      blobKeys: [expect.stringMatching(/^local-attachment\/att-migrated-/)],
      rewrittenBodyHash: hashEmbeddedAttachmentMigrationText(notes.get('n1')?.body ?? ''),
    });
  });

  it('reports created blob resources when metadata write fails before note rewrite', async () => {
    const notes = new Map([['n1', { id: 'n1', body: `![tiny](${realPng})` }]]);
    const repository = memoryRepository();
    repository.putAttachment = vi.fn(async () => { throw new Error('metadata failed'); });
    const blobAdapter = memoryBlobAdapter();

    const report = await migrateEmbeddedDataUrlsToAttachments({
      notes: [...notes.values()],
      updateNote: updaterFor(notes),
      repository,
      blobAdapter,
      backupWriter: memoryBackupStore().writer,
    });

    expect(report.noteResults[0]).toMatchObject({
      status: 'failed',
      orphanedBlobKeys: [expect.stringMatching(/^local-attachment\/att-migrated-/)],
      orphanedAttachmentIds: [],
    });
    expect(report.noteResults[0]?.bodyRewritten).toBeUndefined();
    expect(blobAdapter.records).toHaveLength(1);
    expect(notes.get('n1')?.body).toContain(realPng);
  });

  it('does not call Supabase Storage during migration or restore', async () => {
    const notes = new Map([['n1', { id: 'n1', body: `![tiny](${realPng})` }]]);
    const remoteStorage = { upload: vi.fn(), remove: vi.fn(), createSignedUrl: vi.fn() };
    const backupStore = memoryBackupStore();

    const report = await migrateEmbeddedDataUrlsToAttachments({
      notes: [...notes.values()],
      updateNote: updaterFor(notes),
      repository: memoryRepository(),
      blobAdapter: memoryBlobAdapter(),
      backupWriter: backupStore.writer,
    });

    await restoreEmbeddedAttachmentMigrationBackup({
      noteId: 'n1',
      backupKey: report.noteResults[0]?.backupKey ?? '',
      backupReader: backupStore.reader,
      readCurrentNote: noteId => readNote(notes, noteId),
      updateNote: updaterFor(notes),
      expectedCurrentBodyHash: report.noteResults[0]?.rewrittenBodyHash,
    });

    expect(remoteStorage.upload).not.toHaveBeenCalled();
    expect(remoteStorage.remove).not.toHaveBeenCalled();
    expect(remoteStorage.createSignedUrl).not.toHaveBeenCalled();
  });
});
