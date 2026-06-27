import { describe, expect, it, vi } from 'vitest';
import type {
  AttachmentBlobInventoryRecord,
  AttachmentMetadata,
  AttachmentRepository,
  BlobStorageAdapter,
} from './attachmentRepository';
import { auditEmbeddedAttachments } from './embeddedAttachmentAudit';
import { buildAttachmentCleanupReview } from './attachmentCleanupReview';
import {
  EMBEDDED_ATTACHMENT_MIGRATION_BACKUP_PREFIX,
  migrateEmbeddedDataUrlsToAttachments,
  type EmbeddedAttachmentMigrationBackup,
  type EmbeddedAttachmentMigrationNote,
} from './embeddedAttachmentMigration';
import {
  listEmbeddedAttachmentMigrationBackups,
  restoreEmbeddedAttachmentMigrationBackup,
  summarizeEmbeddedAttachmentMigrationBackup,
  type EmbeddedAttachmentMigrationBackupReader,
} from './embeddedAttachmentMigrationRestore';
import { noteSyncPayload, type NoteBase } from '../components/views/noteUtils';

const SAMPLE_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';
const SAMPLE_DATA_URL = `data:image/png;base64,${SAMPLE_BASE64}`;
const ORIGINAL_BODY = `Before image\n![sample](${SAMPLE_DATA_URL})\nAfter image`;

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
    async tombstoneAttachment(id, deletedAt = '2026-06-27T00:00:00.000Z') {
      await this.updateAttachment(id, { deletedAt, updatedAt: deletedAt, syncStatus: 'deleted' });
    },
    async deleteAttachmentMetadata(id) { records.delete(id); },
    async putMetadata(metadata) {
      records.set(metadata.id, metadata);
      return metadata;
    },
    async getMetadata(id) { return records.get(id) ?? null; },
    async listForNote(noteId) { return this.listAttachmentsForNote(noteId); },
    async markDeleted(id, deletedAt) {
      await this.tombstoneAttachment(id, deletedAt);
      return this.getAttachment(id);
    },
  };
}

function memoryBlobAdapter(): BlobStorageAdapter & {
  records: Map<string, Blob>;
  inventory(): AttachmentBlobInventoryRecord[];
} {
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
    async hasBlob(key) { return records.has(key); },
    async listBlobRecords() {
      return [...records.entries()].map(([key, blob]) => ({
        localBlobKey: key,
        size: blob.size,
        mimeType: blob.type,
      }));
    },
    inventory() {
      return [...records.entries()].map(([key, blob]) => ({
        key,
        blob,
        localBlobKey: key,
        size: blob.size,
        mimeType: blob.type,
      }));
    },
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

function updateNoteFor(notes: Map<string, EmbeddedAttachmentMigrationNote>, order: string[]) {
  return vi.fn(async (noteId: string, patch: Pick<EmbeddedAttachmentMigrationNote, 'body' | 'content'>) => {
    order.push('rewrite');
    const current = notes.get(noteId);
    if (!current) throw new Error('missing note');
    notes.set(noteId, { ...current, ...patch });
  });
}

describe('real sample embedded attachment migration lifecycle', () => {
  it('migrates, syncs safely, restores, and keeps cleanup review report-only', async () => {
    const notes = new Map<string, EmbeddedAttachmentMigrationNote>([[
      'sample-note',
      {
        id: 'sample-note',
        title: 'Real sample image note',
        body: ORIGINAL_BODY,
        updatedAt: '2026-06-27T00:00:00.000Z',
      },
    ]]);
    const repository = memoryRepository();
    const blobAdapter = memoryBlobAdapter();
    const backupStore = memoryBackupStore();
    const order: string[] = [];

    const audit = auditEmbeddedAttachments([...notes.values()]);
    expect(audit.summary.notesWithEmbeddedPayloads).toBe(1);
    expect(audit.summary.imagePayloadCount).toBe(1);
    expect(audit.summary.totalEstimatedDecodedBytes).toBeGreaterThan(0);
    expect(audit.candidates[0]).toMatchObject({
      noteId: 'sample-note',
      payloadCount: 1,
    });

    const report = await migrateEmbeddedDataUrlsToAttachments({
      notes: [...notes.values()],
      updateNote: updateNoteFor(notes, order),
      repository,
      blobAdapter,
      backupWriter: {
        async writeBackup(backup) {
          order.push('backup');
          return backupStore.writer.writeBackup(backup);
        },
      },
      now: () => '2026-06-27T01:00:00.000Z',
    });

    expect(order).toEqual(['backup', 'rewrite']);
    expect(report.payloadsMigrated).toBe(1);
    expect(report.backupsCreated).toBe(1);
    expect(report.attachmentsCreated).toBe(1);
    expect(report.blobsWritten).toBe(1);
    const noteResult = report.noteResults[0];
    expect(noteResult?.backupKey).toBeTruthy();
    expect(noteResult?.attachmentIds).toHaveLength(1);
    expect(noteResult?.blobKeys).toHaveLength(1);

    const attachmentId = noteResult?.attachmentIds[0] ?? '';
    const localBlobKey = noteResult?.blobKeys[0] ?? '';
    const metadata = await repository.getAttachment(attachmentId);
    expect(metadata).toMatchObject({
      id: attachmentId,
      noteId: 'sample-note',
      mimeType: 'image/png',
      localBlobKey,
      syncStatus: 'local',
    });
    expect(metadata?.size).toBeGreaterThan(0);
    expect(await blobAdapter.hasBlob?.(localBlobKey)).toBe(true);
    const blobInfo = await blobAdapter.getBlob(localBlobKey);
    expect(blobInfo).toMatchObject({
      key: localBlobKey,
      mimeType: 'image/png',
    });
    expect(blobInfo?.size).toBeGreaterThan(0);
    expect(JSON.stringify(await blobAdapter.listBlobRecords?.())).not.toContain(SAMPLE_BASE64);

    const migratedBody = notes.get('sample-note')?.body ?? '';
    expect(migratedBody).toContain('Before image');
    expect(migratedBody).toContain('After image');
    expect(migratedBody).toMatch(/!\[sample\]\(attachment:\/\/att-migrated-/);
    expect(migratedBody).not.toContain('data:image');
    expect(migratedBody).not.toContain(';base64,');
    expect(migratedBody).not.toContain(SAMPLE_BASE64);

    const syncPayload = noteSyncPayload({
      id: 'sample-note',
      title: 'Real sample image note',
      body: migratedBody,
      updatedAt: 1,
      folderId: null,
      deletedAt: null,
    } satisfies NoteBase);
    const serializedSyncPayload = JSON.stringify(syncPayload);
    expect(serializedSyncPayload).toContain('attachment://');
    expect(serializedSyncPayload).not.toContain('data:image');
    expect(serializedSyncPayload).not.toContain(';base64,');
    expect(serializedSyncPayload).not.toContain(SAMPLE_BASE64);
    expect(serializedSyncPayload).not.toContain('"blob"');

    const backupKey = noteResult?.backupKey ?? '';
    const rawBackup = backupStore.backups.get(backupKey);
    expect(rawBackup?.originalBody).toBe(ORIGINAL_BODY);
    const [summary] = await listEmbeddedAttachmentMigrationBackups(backupStore.reader);
    expect(summary).toMatchObject({
      backupKey,
      noteId: 'sample-note',
      migrationId: report.migrationId,
      candidateCount: 1,
    });
    expect(summary.originalBodyBytes).toBeGreaterThan(0);
    const serializedSummary = JSON.stringify(summary);
    expect(serializedSummary).not.toContain(ORIGINAL_BODY);
    expect(serializedSummary).not.toContain('data:image');
    expect(serializedSummary).not.toContain(SAMPLE_BASE64);
    expect(JSON.stringify(summarizeEmbeddedAttachmentMigrationBackup(backupKey, rawBackup!))).not.toContain(SAMPLE_BASE64);

    const cleanupBeforeRestore = await buildAttachmentCleanupReview({
      notes: [...notes.values()],
      attachments: await repository.listAttachments(),
      blobInventory: blobAdapter.inventory(),
      backupReader: backupStore.reader,
      migrationReports: [report],
      now: () => '2026-06-27T02:00:00.000Z',
    });
    expect(cleanupBeforeRestore.referencedAttachmentCount).toBe(1);
    expect(cleanupBeforeRestore.unreferencedAttachmentMetadataCount).toBe(0);
    expect(cleanupBeforeRestore.unreferencedBlobCount).toBe(0);
    expect(cleanupBeforeRestore.candidates).toContainEqual(expect.objectContaining({
      type: 'referencedAttachment',
      attachmentId,
    }));
    expect(cleanupBeforeRestore.candidates).not.toContainEqual(expect.objectContaining({
      type: 'unreferencedAttachmentMetadata',
      attachmentId,
    }));
    expect(cleanupBeforeRestore.candidates).not.toContainEqual(expect.objectContaining({
      type: 'unreferencedBlob',
      localBlobKey,
    }));

    const restoreReport = await restoreEmbeddedAttachmentMigrationBackup({
      noteId: 'sample-note',
      backupKey,
      backupReader: backupStore.reader,
      expectedCurrentBodyHash: noteResult?.rewrittenBodyHash,
      expectedCurrentContentHash: noteResult?.rewrittenContentHash,
      readCurrentNote: async noteId => notes.get(noteId) ?? null,
      updateNote: async (noteId, patch) => {
        const current = notes.get(noteId);
        if (!current) throw new Error('missing note');
        notes.set(noteId, { ...current, ...patch });
      },
    });

    expect(restoreReport).toMatchObject({
      noteId: 'sample-note',
      backupKey,
      restored: true,
      forced: false,
      errors: [],
    });
    expect(JSON.stringify(restoreReport)).not.toContain(SAMPLE_BASE64);
    expect(notes.get('sample-note')?.body).toBe(ORIGINAL_BODY);
    expect(await repository.getAttachment(attachmentId)).toBeTruthy();
    expect(await blobAdapter.hasBlob?.(localBlobKey)).toBe(true);
    expect(backupStore.backups.has(backupKey)).toBe(true);

    const cleanupAfterRestore = await buildAttachmentCleanupReview({
      notes: [...notes.values()],
      attachments: await repository.listAttachments(),
      blobInventory: blobAdapter.inventory(),
      backupReader: backupStore.reader,
      migrationReports: [report],
      restoreReports: [restoreReport],
      now: () => '2026-06-27T03:00:00.000Z',
    });
    expect(cleanupAfterRestore.restoredMigrationArtifactCount).toBeGreaterThan(0);
    expect(cleanupAfterRestore.candidates).toContainEqual(expect.objectContaining({
      type: 'restoredMigrationArtifact',
      attachmentId,
      localBlobKey,
    }));
    expect(await repository.getAttachment(attachmentId)).toBeTruthy();
    expect(await blobAdapter.hasBlob?.(localBlobKey)).toBe(true);
    expect(backupStore.backups.has(backupKey)).toBe(true);

    const remoteStorage = { upload: vi.fn(), createSignedUrl: vi.fn(), deleteObject: vi.fn() };
    expect(remoteStorage.upload).not.toHaveBeenCalled();
    expect(remoteStorage.createSignedUrl).not.toHaveBeenCalled();
    expect(remoteStorage.deleteObject).not.toHaveBeenCalled();
  });
});
