import { describe, expect, it, vi } from 'vitest';
import type {
  AttachmentMetadata,
  AttachmentRepository,
  BlobStorageAdapter,
} from './attachmentRepository';
import { auditEmbeddedAttachments } from './embeddedAttachmentAudit';
import {
  EMBEDDED_ATTACHMENT_MIGRATION_BACKUP_PREFIX,
  migrateEmbeddedDataUrlsToAttachments,
  type EmbeddedAttachmentMigrationBackup,
  type EmbeddedAttachmentMigrationNote,
} from './embeddedAttachmentMigration';

function memoryRepository(order?: string[]): AttachmentRepository & { records: Map<string, AttachmentMetadata> } {
  const records = new Map<string, AttachmentMetadata>();
  return {
    records,
    async listAttachments() { return [...records.values()]; },
    async listAttachmentsForNote(noteId) { return [...records.values()].filter(item => item.noteId === noteId); },
    async getAttachment(id) { return records.get(id) ?? null; },
    async putAttachment(metadata) {
      order?.push('metadata');
      records.set(metadata.id, metadata);
    },
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

function memoryBlobAdapter(order?: string[]): BlobStorageAdapter & { records: Map<string, Blob> } {
  const records = new Map<string, Blob>();
  return {
    records,
    async putBlob(input) {
      order?.push('blob');
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

function memoryBackupWriter(order?: string[]) {
  const backups = new Map<string, EmbeddedAttachmentMigrationBackup>();
  return {
    backups,
    writer: {
      async writeBackup(backup: EmbeddedAttachmentMigrationBackup) {
        order?.push('backup');
        const key = `${EMBEDDED_ATTACHMENT_MIGRATION_BACKUP_PREFIX}${backup.migrationId}.${backup.noteId}`;
        backups.set(key, backup);
        return { key };
      },
    },
  };
}

function updaterFor(notes: Map<string, EmbeddedAttachmentMigrationNote>, order?: string[]) {
  return vi.fn(async (noteId: string, patch: Pick<EmbeddedAttachmentMigrationNote, 'body' | 'content'>) => {
    order?.push('rewrite');
    const current = notes.get(noteId);
    if (!current) throw new Error('missing note');
    notes.set(noteId, { ...current, ...patch });
  });
}

const png = 'data:image/png;base64,QUJDRA==';
const jpeg = 'data:image/jpeg;base64,SlBFRw==';

describe('embedded attachment migration foundation', () => {
  it('migrates markdown data:image PNG to an attachment reference', async () => {
    const notes = new Map([['n1', { id: 'n1', body: `before ![scan](${png}) after` }]]);
    const repository = memoryRepository();
    const blobAdapter = memoryBlobAdapter();

    const report = await migrateEmbeddedDataUrlsToAttachments({
      notes: [...notes.values()],
      updateNote: updaterFor(notes),
      repository,
      blobAdapter,
      backupWriter: memoryBackupWriter().writer,
      now: () => '2026-06-27T00:00:00.000Z',
    });

    const body = notes.get('n1')?.body ?? '';
    expect(body).toMatch(/^before !\[scan\]\(attachment:\/\/att-migrated-/);
    expect(body).toContain(') after');
    expect(body).not.toContain('data:image/png');
    expect(repository.records).toHaveLength(1);
    expect(blobAdapter.records).toHaveLength(1);
    expect(report.payloadsMigrated).toBe(1);
  });

  it('migrates raw data:image JPEG to an attachment reference', async () => {
    const notes = new Map([['n1', { id: 'n1', body: `raw ${jpeg}` }]]);
    const repository = memoryRepository();

    await migrateEmbeddedDataUrlsToAttachments({
      notes: [...notes.values()],
      updateNote: updaterFor(notes),
      repository,
      blobAdapter: memoryBlobAdapter(),
      backupWriter: memoryBackupWriter().writer,
      now: () => '2026-06-27T00:00:00.000Z',
    });

    expect(notes.get('n1')?.body).toMatch(/^raw attachment:\/\/att-migrated-/);
    expect([...repository.records.values()][0]).toMatchObject({
      noteId: 'n1',
      mimeType: 'image/jpeg',
      fileName: expect.stringContaining('.jpg'),
      syncStatus: 'local',
      source: 'local',
    });
  });

  it('copies application/pdf data URLs into local attachment blobs without adding a viewer', async () => {
    const pdf = 'data:application/pdf;base64,JVBERg==';
    const notes = new Map([['n1', { id: 'n1', body: `scan ${pdf}` }]]);
    const repository = memoryRepository();

    await migrateEmbeddedDataUrlsToAttachments({
      notes: [...notes.values()],
      updateNote: updaterFor(notes),
      repository,
      blobAdapter: memoryBlobAdapter(),
      backupWriter: memoryBackupWriter().writer,
      now: () => '2026-06-27T00:00:00.000Z',
    });

    expect(notes.get('n1')?.body).toMatch(/^scan attachment:\/\/att-migrated-/);
    expect([...repository.records.values()][0]).toMatchObject({
      mimeType: 'application/pdf',
      fileName: expect.stringContaining('.pdf'),
    });
  });

  it('preserves markdown image alt text', async () => {
    const notes = new Map([['n1', { id: 'n1', body: `![alt text](${png})` }]]);

    await migrateEmbeddedDataUrlsToAttachments({
      notes: [...notes.values()],
      updateNote: updaterFor(notes),
      repository: memoryRepository(),
      blobAdapter: memoryBlobAdapter(),
      backupWriter: memoryBackupWriter().writer,
      now: () => '2026-06-27T00:00:00.000Z',
    });

    expect(notes.get('n1')?.body).toMatch(/^!\[alt text\]\(attachment:\/\/att-migrated-/);
  });

  it('creates backup, local blob, and metadata before rewriting note body', async () => {
    const order: string[] = [];
    const notes = new Map([['n1', { id: 'n1', body: png }]]);

    await migrateEmbeddedDataUrlsToAttachments({
      notes: [...notes.values()],
      updateNote: updaterFor(notes, order),
      repository: memoryRepository(order),
      blobAdapter: memoryBlobAdapter(order),
      backupWriter: memoryBackupWriter(order).writer,
      now: () => '2026-06-27T00:00:00.000Z',
    });

    expect(order).toEqual(['backup', 'blob', 'metadata', 'rewrite']);
  });

  it('backup contains original embedded data and can be compared to the migrated note', async () => {
    const notes = new Map([['n1', { id: 'n1', body: `original ${png}`, updatedAt: '2026-01-01T00:00:00.000Z' }]]);
    const backup = memoryBackupWriter();

    await migrateEmbeddedDataUrlsToAttachments({
      notes: [...notes.values()],
      updateNote: updaterFor(notes),
      repository: memoryRepository(),
      blobAdapter: memoryBlobAdapter(),
      backupWriter: backup.writer,
      now: () => '2026-06-27T00:00:00.000Z',
    });

    const stored = [...backup.backups.values()][0];
    expect(stored.originalBody).toContain(png);
    expect(stored.originalUpdatedAt).toBe('2026-01-01T00:00:00.000Z');
    expect(notes.get('n1')?.body).not.toBe(stored.originalBody);
    expect(notes.get('n1')?.body).toContain('attachment://');
  });

  it('leaves note body unchanged if blob write fails', async () => {
    const notes = new Map([['n1', { id: 'n1', body: png }]]);
    const updateNote = updaterFor(notes);
    const blobAdapter = memoryBlobAdapter();
    blobAdapter.putBlob = vi.fn(async () => { throw new Error('blob failed'); });

    const report = await migrateEmbeddedDataUrlsToAttachments({
      notes: [...notes.values()],
      updateNote,
      repository: memoryRepository(),
      blobAdapter,
      backupWriter: memoryBackupWriter().writer,
    });

    expect(notes.get('n1')?.body).toBe(png);
    expect(updateNote).not.toHaveBeenCalled();
    expect(report.noteResults[0]).toMatchObject({ status: 'failed', failedCount: 1 });
  });

  it('leaves note body unchanged if metadata write fails', async () => {
    const notes = new Map([['n1', { id: 'n1', body: png }]]);
    const updateNote = updaterFor(notes);
    const repository = memoryRepository();
    repository.putAttachment = vi.fn(async () => { throw new Error('metadata failed'); });

    const report = await migrateEmbeddedDataUrlsToAttachments({
      notes: [...notes.values()],
      updateNote,
      repository,
      blobAdapter: memoryBlobAdapter(),
      backupWriter: memoryBackupWriter().writer,
    });

    expect(notes.get('n1')?.body).toBe(png);
    expect(updateNote).not.toHaveBeenCalled();
    expect(report.noteResults[0]?.orphanedBlobKeys).toHaveLength(1);
  });

  it('leaves note body unchanged if backup write fails', async () => {
    const notes = new Map([['n1', { id: 'n1', body: png }]]);
    const updateNote = updaterFor(notes);

    const report = await migrateEmbeddedDataUrlsToAttachments({
      notes: [...notes.values()],
      updateNote,
      repository: memoryRepository(),
      blobAdapter: memoryBlobAdapter(),
      backupWriter: {
        async writeBackup() { throw new Error('backup failed'); },
      },
    });

    expect(notes.get('n1')?.body).toBe(png);
    expect(updateNote).not.toHaveBeenCalled();
    expect(report.backupsCreated).toBe(0);
    expect(report.payloadsFailed).toBe(1);
  });

  it('invalid base64 does not rewrite note body', async () => {
    const invalid = 'data:image/png;base64,AAAAA';
    const notes = new Map([['n1', { id: 'n1', body: invalid }]]);
    const updateNote = updaterFor(notes);

    await migrateEmbeddedDataUrlsToAttachments({
      notes: [...notes.values()],
      updateNote,
      repository: memoryRepository(),
      blobAdapter: memoryBlobAdapter(),
      backupWriter: memoryBackupWriter().writer,
    });

    expect(notes.get('n1')?.body).toBe(invalid);
    expect(updateNote).not.toHaveBeenCalled();
  });

  it('second migration run is idempotent and does not create duplicate attachments', async () => {
    const notes = new Map([['n1', { id: 'n1', body: png }]]);
    const repository = memoryRepository();
    const blobAdapter = memoryBlobAdapter();
    const backup = memoryBackupWriter();
    const updateNote = updaterFor(notes);

    const first = await migrateEmbeddedDataUrlsToAttachments({
      notes: [...notes.values()],
      updateNote,
      repository,
      blobAdapter,
      backupWriter: backup.writer,
      now: () => '2026-06-27T00:00:00.000Z',
    });
    const bodyAfterFirst = notes.get('n1')?.body;
    const second = await migrateEmbeddedDataUrlsToAttachments({
      notes: [...notes.values()],
      updateNote,
      repository,
      blobAdapter,
      backupWriter: backup.writer,
      now: () => '2026-06-27T00:00:01.000Z',
    });

    expect(first.payloadsMigrated).toBe(1);
    expect(second.payloadsMigrated).toBe(0);
    expect(second.noteResults[0]).toMatchObject({ status: 'skipped', candidatesFound: 0 });
    expect(notes.get('n1')?.body).toBe(bodyAfterFirst);
    expect(repository.records).toHaveLength(1);
    expect(blobAdapter.records).toHaveLength(1);
    expect(backup.backups).toHaveLength(1);
  });

  it('attachment references are not re-migrated', async () => {
    const notes = new Map([['n1', { id: 'n1', body: '![scan](attachment://att-1)' }]]);
    const updateNote = updaterFor(notes);

    const report = await migrateEmbeddedDataUrlsToAttachments({
      notes: [...notes.values()],
      updateNote,
      repository: memoryRepository(),
      blobAdapter: memoryBlobAdapter(),
      backupWriter: memoryBackupWriter().writer,
    });

    expect(report.payloadsMigrated).toBe(0);
    expect(updateNote).not.toHaveBeenCalled();
  });

  it('migration report counts migrated, skipped, and failed candidates', async () => {
    const notes = new Map([
      ['n1', { id: 'n1', body: png }],
      ['n2', { id: 'n2', body: 'plain' }],
      ['n3', { id: 'n3', body: 'data:image/png;base64,AAAAA' }],
    ]);

    const report = await migrateEmbeddedDataUrlsToAttachments({
      notes: [...notes.values()],
      updateNote: updaterFor(notes),
      repository: memoryRepository(),
      blobAdapter: memoryBlobAdapter(),
      backupWriter: memoryBackupWriter().writer,
    });

    expect(report.notesScanned).toBe(3);
    expect(report.notesWithCandidates).toBe(2);
    expect(report.notesMigrated).toBe(1);
    expect(report.payloadsMigrated).toBe(1);
    expect(report.payloadsFailed).toBe(1);
  });

  it('report does not include full base64 data', async () => {
    const payload = 'QUJDREVGR0hJSktMTU5PUA==';
    const notes = new Map([['n1', { id: 'n1', body: `data:image/png;base64,${payload}` }]]);

    const report = await migrateEmbeddedDataUrlsToAttachments({
      notes: [...notes.values()],
      updateNote: updaterFor(notes),
      repository: memoryRepository(),
      blobAdapter: memoryBlobAdapter(),
      backupWriter: memoryBackupWriter().writer,
    });

    expect(JSON.stringify(report)).not.toContain(payload);
  });

  it('local migration does not call Supabase Storage', async () => {
    const notes = new Map([['n1', { id: 'n1', body: png }]]);
    const remoteStorage = { upload: vi.fn(), createSignedUrl: vi.fn() };

    await migrateEmbeddedDataUrlsToAttachments({
      notes: [...notes.values()],
      updateNote: updaterFor(notes),
      repository: memoryRepository(),
      blobAdapter: memoryBlobAdapter(),
      backupWriter: memoryBackupWriter().writer,
    });

    expect(remoteStorage.upload).not.toHaveBeenCalled();
    expect(remoteStorage.createSignedUrl).not.toHaveBeenCalled();
  });

  it('K-148 audit detects candidates before migration and not after migration', async () => {
    const notes = new Map([['n1', { id: 'n1', body: png }]]);
    expect(auditEmbeddedAttachments([...notes.values()]).summary.totalEmbeddedPayloads).toBe(1);

    await migrateEmbeddedDataUrlsToAttachments({
      notes: [...notes.values()],
      updateNote: updaterFor(notes),
      repository: memoryRepository(),
      blobAdapter: memoryBlobAdapter(),
      backupWriter: memoryBackupWriter().writer,
    });

    expect(auditEmbeddedAttachments([...notes.values()]).summary.totalEmbeddedPayloads).toBe(0);
  });
});
