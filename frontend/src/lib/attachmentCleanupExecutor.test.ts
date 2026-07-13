import { describe, expect, it, vi } from 'vitest';
import type {
  AttachmentBlobInventoryRecord,
  AttachmentMetadata,
  AttachmentRepository,
  BlobStorageAdapter,
} from './attachmentRepository';
import {
  attachmentCleanupCandidateId,
  createAttachmentCleanupConfirmationToken,
  executeAttachmentCleanup,
  hashAttachmentCleanupReviewReport,
} from './attachmentCleanupExecutor';
import {
  buildAttachmentCleanupReview,
  type AttachmentCleanupReviewReport,
} from './attachmentCleanupReview';
import type { EmbeddedAttachmentMigrationNote } from './embeddedAttachmentMigration';

function metadata(overrides: Partial<AttachmentMetadata> = {}): AttachmentMetadata {
  const id = overrides.id ?? 'att-1';
  return {
    id,
    noteId: overrides.noteId ?? 'n1',
    fileName: overrides.fileName ?? `${id}.png`,
    mimeType: overrides.mimeType ?? 'image/png',
    size: overrides.size ?? 12,
    checksum: overrides.checksum ?? `fnv1a:${id}`,
    localBlobKey: overrides.localBlobKey ?? `local-attachment/${id}`,
    source: overrides.source ?? 'local',
    createdAt: overrides.createdAt ?? '2026-06-27T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-06-27T00:00:00.000Z',
    deletedAt: overrides.deletedAt ?? null,
    syncStatus: overrides.syncStatus ?? 'local',
  };
}

function memoryRepository(records: AttachmentMetadata[]): AttachmentRepository & { records: Map<string, AttachmentMetadata> } {
  const map = new Map(records.map(record => [record.id, record]));
  return {
    records: map,
    async listAttachments() { return [...map.values()]; },
    async listAttachmentsForNote(noteId) { return [...map.values()].filter(record => record.noteId === noteId); },
    async getAttachment(id) { return map.get(id) ?? null; },
    async putAttachment(item) { map.set(item.id, item); },
    async updateAttachment(id, patch) {
      const current = map.get(id);
      if (current) map.set(id, { ...current, ...patch });
    },
    async tombstoneAttachment(id, deletedAt = '2026-06-27T00:00:00.000Z') {
      const current = map.get(id);
      if (current) map.set(id, { ...current, deletedAt, updatedAt: deletedAt, syncStatus: 'deleted' });
    },
    deleteAttachmentMetadata: vi.fn(async (id: string) => { map.delete(id); }),
    async putMetadata(item) { map.set(item.id, item); return item; },
    async getMetadata(id) { return map.get(id) ?? null; },
    async listForNote(noteId) { return [...map.values()].filter(record => record.noteId === noteId); },
    async markDeleted(id, deletedAt) {
      await this.tombstoneAttachment(id, deletedAt);
      return map.get(id) ?? null;
    },
  };
}

function memoryBlobAdapter(records: AttachmentBlobInventoryRecord[]): BlobStorageAdapter & {
  records: Map<string, AttachmentBlobInventoryRecord>;
} {
  const map = new Map(records.map(record => [record.localBlobKey, record]));
  return {
    records: map,
    async putBlob() { throw new Error('not used'); },
    async getBlob(key) {
      const record = map.get(key);
      if (!record) return null;
      return {
        key,
        blob: new Blob(['x'.repeat(record.size)], { type: record.mimeType }),
        mimeType: record.mimeType,
        size: record.size,
        checksum: record.checksum,
      };
    },
    deleteBlob: vi.fn(async (key: string) => { map.delete(key); }),
    async getObjectUrl() { return null; },
    async listBlobRecords() { return [...map.values()]; },
    async getBlobInfo(key) { return map.get(key) ?? null; },
    async hasBlob(key) { return map.has(key); },
  };
}

async function review(input: {
  notes?: EmbeddedAttachmentMigrationNote[];
  attachments?: AttachmentMetadata[];
  blobs?: AttachmentBlobInventoryRecord[];
} = {}): Promise<AttachmentCleanupReviewReport> {
  return buildAttachmentCleanupReview({
    notes: input.notes ?? [],
    attachments: input.attachments ?? [],
    blobInventory: input.blobs ?? [],
    now: () => '2026-06-27T00:00:00.000Z',
  });
}

function idFor(report: AttachmentCleanupReviewReport, type: string): string {
  const index = report.candidates.findIndex(candidate => candidate.type === type);
  if (index < 0) throw new Error(`candidate not found: ${type}`);
  return attachmentCleanupCandidateId(report.candidates[index], index);
}

async function executeMetadataCandidate(input: {
  reviewNotes?: EmbeddedAttachmentMigrationNote[];
  currentNotes?: EmbeddedAttachmentMigrationNote[];
  attachmentId?: string;
}) {
  const attachmentId = input.attachmentId ?? 'asset';
  const record = metadata({ id: attachmentId });
  const report = await review({ notes: input.reviewNotes ?? [], attachments: [record], blobs: [] });
  const repository = memoryRepository([record]);
  const result = await executeAttachmentCleanup({
    reviewReport: report,
    confirmationToken: createAttachmentCleanupConfirmationToken(report),
    selectedCandidateIds: [idFor(report, 'unreferencedAttachmentMetadata')],
    notes: input.currentNotes ?? input.reviewNotes ?? [],
    repository,
    blobAdapter: memoryBlobAdapter([]),
  });
  return { report, repository, result };
}

describe('attachment cleanup executor foundation', () => {
  it('hashes review reports and refuses to run without confirmation token', async () => {
    const report = await review({ blobs: [{ localBlobKey: 'local/orphan', size: 5 }] });
    const repository = memoryRepository([]);
    const blobAdapter = memoryBlobAdapter([{ localBlobKey: 'local/orphan', size: 5 }]);

    expect(hashAttachmentCleanupReviewReport(report)).toMatch(/^fnv1a:/);
    const result = await executeAttachmentCleanup({
      reviewReport: report,
      selectedCandidateIds: [idFor(report, 'unreferencedBlob')],
      notes: [],
      repository,
      blobAdapter,
    });

    expect(result.confirmationVerified).toBe(false);
    expect(result.errors.join(' ')).toContain('confirmation');
    expect(blobAdapter.deleteBlob).not.toHaveBeenCalled();
  });

  it('refuses mismatched confirmation token', async () => {
    const report = await review({ blobs: [{ localBlobKey: 'local/orphan', size: 5 }] });
    const repository = memoryRepository([]);
    const blobAdapter = memoryBlobAdapter([{ localBlobKey: 'local/orphan', size: 5 }]);

    const result = await executeAttachmentCleanup({
      reviewReport: report,
      confirmationToken: 'wrong-token',
      selectedCandidateIds: [idFor(report, 'unreferencedBlob')],
      notes: [],
      repository,
      blobAdapter,
    });

    expect(result.confirmationVerified).toBe(false);
    expect(result.deletedBlobCount).toBe(0);
    expect(blobAdapter.deleteBlob).not.toHaveBeenCalled();
  });

  it('deletes an explicitly selected unreferenced local blob after revalidation', async () => {
    const report = await review({ blobs: [{ localBlobKey: 'local/orphan', size: 9 }] });
    const repository = memoryRepository([]);
    const blobAdapter = memoryBlobAdapter([{ localBlobKey: 'local/orphan', size: 9 }]);

    const result = await executeAttachmentCleanup({
      reviewReport: report,
      confirmationToken: createAttachmentCleanupConfirmationToken(report),
      selectedCandidateIds: [idFor(report, 'unreferencedBlob')],
      notes: [],
      repository,
      blobAdapter,
      now: () => '2026-06-27T00:00:00.000Z',
    });

    expect(result).toMatchObject({
      confirmationVerified: true,
      eligibleCandidateCount: 1,
      deletedBlobCount: 1,
      bytesRecoveredEstimate: 9,
    });
    expect(blobAdapter.records.has('local/orphan')).toBe(false);
  });

  it('deletes explicitly selected local-only unreferenced attachment metadata after revalidation', async () => {
    const orphan = metadata({ id: 'att-orphan', localBlobKey: undefined, size: 13 });
    const report = await review({ attachments: [orphan], blobs: [] });
    const repository = memoryRepository([orphan]);
    const blobAdapter = memoryBlobAdapter([]);

    const result = await executeAttachmentCleanup({
      reviewReport: report,
      confirmationToken: createAttachmentCleanupConfirmationToken(report),
      selectedCandidateIds: [idFor(report, 'unreferencedAttachmentMetadata')],
      notes: [],
      repository,
      blobAdapter,
    });

    expect(result.deletedAttachmentMetadataCount).toBe(1);
    expect(repository.records.has('att-orphan')).toBe(false);
  });

  it('blocks referenced attachments, backups, and missing-data warnings', async () => {
    const report = await review({
      notes: [{ id: 'n1', body: 'attachment://att-1' }],
      attachments: [metadata({ id: 'att-1', localBlobKey: 'local/missing' })],
      blobs: [],
    });
    report.candidates.push({
      type: 'backupRecord',
      severity: 'info',
      backupKey: 'backup-key',
      reason: 'backup',
      safeActionRecommendation: 'keep',
    });
    const ids = report.candidates.map((candidate, index) => attachmentCleanupCandidateId(candidate, index));
    const repository = memoryRepository([metadata({ id: 'att-1', localBlobKey: 'local/missing' })]);
    const blobAdapter = memoryBlobAdapter([]);

    const result = await executeAttachmentCleanup({
      reviewReport: report,
      confirmationToken: createAttachmentCleanupConfirmationToken(report),
      selectedCandidateIds: ids,
      notes: [{ id: 'n1', body: 'attachment://att-1' }],
      repository,
      blobAdapter,
    });

    expect(result.deletedBlobCount).toBe(0);
    expect(result.deletedAttachmentMetadataCount).toBe(0);
    expect(result.blockedCandidateCount).toBeGreaterThanOrEqual(2);
    expect(repository.deleteAttachmentMetadata).not.toHaveBeenCalled();
    expect(blobAdapter.deleteBlob).not.toHaveBeenCalled();
  });

  it('skips a stale blob candidate if metadata now references it', async () => {
    const report = await review({ blobs: [{ localBlobKey: 'local/orphan', size: 5 }] });
    const repository = memoryRepository([metadata({ id: 'att-new', localBlobKey: 'local/orphan' })]);
    const blobAdapter = memoryBlobAdapter([{ localBlobKey: 'local/orphan', size: 5 }]);

    const result = await executeAttachmentCleanup({
      reviewReport: report,
      confirmationToken: createAttachmentCleanupConfirmationToken(report),
      selectedCandidateIds: [idFor(report, 'unreferencedBlob')],
      notes: [],
      repository,
      blobAdapter,
    });

    expect(result.skippedCandidateCount).toBe(1);
    expect(blobAdapter.deleteBlob).not.toHaveBeenCalled();
  });

  it('skips a metadata candidate if a note now references it', async () => {
    const orphan = metadata({ id: 'att-orphan', localBlobKey: undefined });
    const report = await review({ attachments: [orphan], blobs: [] });
    const repository = memoryRepository([orphan]);
    const blobAdapter = memoryBlobAdapter([]);

    const result = await executeAttachmentCleanup({
      reviewReport: report,
      confirmationToken: createAttachmentCleanupConfirmationToken(report),
      selectedCandidateIds: [idFor(report, 'unreferencedAttachmentMetadata')],
      notes: [{ id: 'n1', body: 'attachment://att-orphan' }],
      repository,
      blobAdapter,
    });

    expect(result.skippedCandidateCount).toBe(1);
    expect(repository.deleteAttachmentMetadata).not.toHaveBeenCalled();
  });

  it.each([
    ['no reference', 'plain text'],
    ['embedded prefix', 'notattachment://asset'],
    ['leading ASCII continuation', 'xattachment://asset'],
    ['hyphenated embedded prefix', 'pre-attachment://asset'],
    ['URL path embedding', 'https://example.com/attachment://asset'],
    ['percent-encoded slash', 'attachment://asset%2F1'],
    ['percent-encoded space', 'attachment://asset%201'],
    ['trailing percent', 'attachment://asset%'],
    ['malformed percent escape', 'attachment://asset%ZZ'],
    ['path continuation', 'attachment://asset/child'],
    ['trailing query delimiter', 'attachment://asset?'],
    ['query continuation', 'attachment://asset?query'],
    ['query plus Unicode', 'attachment://asset?\uB6F7'],
    ['fragment continuation', 'attachment://asset#fragment'],
    ['Unicode continuation', 'attachment://asset\uD55C'],
    ['zero-width joiner continuation', 'attachment://asset\u200d'],
    ['zero-width space continuation', 'attachment://asset\u200b'],
    ['different complete ID', 'attachment://assetx'],
    ['dot belongs to a different complete ID', 'attachment://asset.'],
    ['colon belongs to a different complete ID', 'attachment://asset:'],
  ])('keeps review and execution aligned for %s', async (_label, body) => {
    const notes = [{ id: 'n1', body }];
    const { report, repository, result } = await executeMetadataCandidate({ reviewNotes: notes });

    expect(report.candidates.some(candidate => candidate.type === 'unreferencedAttachmentMetadata'
      && candidate.attachmentId === 'asset')).toBe(true);
    expect(result.deletedAttachmentMetadataCount).toBe(1);
    expect(result.skippedCandidateCount).toBe(0);
    expect(repository.records.has('asset')).toBe(false);
  });

  it.each([
    ['plain reference', 'attachment://asset'],
    ['parentheses', '(attachment://asset)'],
    ['brackets', '[attachment://asset]'],
    ['quotes', '"attachment://asset"'],
    ['comma boundary', 'attachment://asset,'],
    ['newline boundary', 'attachment://asset\n'],
    ['duplicate reference', 'attachment://asset attachment://asset'],
  ])('fresh revalidation blocks deletion for a valid %s', async (_label, body) => {
    const { repository, result } = await executeMetadataCandidate({
      reviewNotes: [],
      currentNotes: [{ id: 'n1', body }],
    });

    expect(result.deletedAttachmentMetadataCount).toBe(0);
    expect(result.skippedCandidateCount).toBe(1);
    expect(repository.records.has('asset')).toBe(true);
  });

  it('keeps exact case-sensitive IDs distinct through review and execution', async () => {
    const lower = metadata({ id: 'asset' });
    const upper = metadata({ id: 'Asset' });
    const notes = [{ id: 'n1', body: 'attachment://Asset' }];
    const report = await review({ notes, attachments: [lower, upper], blobs: [] });
    const repository = memoryRepository([lower, upper]);
    const result = await executeAttachmentCleanup({
      reviewReport: report,
      confirmationToken: createAttachmentCleanupConfirmationToken(report),
      selectedCandidateIds: [idFor(report, 'unreferencedAttachmentMetadata')],
      notes,
      repository,
      blobAdapter: memoryBlobAdapter([]),
    });

    expect(result.deletedAttachmentMetadataCount).toBe(1);
    expect(repository.records.has('asset')).toBe(false);
    expect(repository.records.has('Asset')).toBe(true);
  });

  it('aggregates multiple current notes once and honors any complete valid reference', async () => {
    const { repository, result } = await executeMetadataCandidate({
      reviewNotes: [],
      currentNotes: [
        { id: 'n1', body: 'attachment://asset%2F1' },
        { id: 'n2', content: 'attachment://asset' },
      ],
    });

    expect(result.deletedAttachmentMetadataCount).toBe(0);
    expect(result.skippedCandidateCount).toBe(1);
    expect(repository.records.has('asset')).toBe(true);
  });

  it('does not let multiple malformed current pseudo-references block cleanup', async () => {
    const notes = [
      { id: 'n1', body: 'attachment://asset%2F1 attachment://asset/child' },
      { id: 'n2', content: 'notattachment://asset attachment://asset\u200b' },
    ];
    const { repository, result } = await executeMetadataCandidate({ reviewNotes: notes });

    expect(result.deletedAttachmentMetadataCount).toBe(1);
    expect(repository.records.has('asset')).toBe(false);
  });

  it('does not let a malformed pseudo-reference added after review block fresh cleanup revalidation', async () => {
    const { repository, result } = await executeMetadataCandidate({
      reviewNotes: [],
      currentNotes: [{ id: 'n1', body: 'attachment://asset%2F1' }],
    });

    expect(result.deletedAttachmentMetadataCount).toBe(1);
    expect(result.skippedCandidateCount).toBe(0);
    expect(repository.records.has('asset')).toBe(false);
  });

  it('retains the source-review selection requirement if a valid reference is later removed', async () => {
    const record = metadata({ id: 'asset' });
    const report = await review({ notes: [{ id: 'n1', body: 'attachment://asset' }], attachments: [record], blobs: [] });
    const repository = memoryRepository([record]);
    expect(report.candidates.some(candidate => candidate.type === 'unreferencedAttachmentMetadata')).toBe(false);

    const result = await executeAttachmentCleanup({
      reviewReport: report,
      confirmationToken: createAttachmentCleanupConfirmationToken(report),
      selectedCandidateIds: ['unreferencedAttachmentMetadata|asset|||||0'],
      notes: [],
      repository,
      blobAdapter: memoryBlobAdapter([]),
    });

    expect(result.deletedAttachmentMetadataCount).toBe(0);
    expect(result.blockedCandidateCount).toBe(1);
    expect(repository.records.has('asset')).toBe(true);
  });

  it('reports partial failures and continues safely', async () => {
    const blobReport = await review({
      blobs: [
        { localBlobKey: 'local/ok', size: 3 },
        { localBlobKey: 'local/fail', size: 4 },
      ],
    });
    const repository = memoryRepository([]);
    const blobAdapter = memoryBlobAdapter([
      { localBlobKey: 'local/ok', size: 3 },
      { localBlobKey: 'local/fail', size: 4 },
    ]);
    blobAdapter.deleteBlob = vi.fn(async (key: string) => {
      if (key === 'local/fail') throw new Error('delete failed data:image/png;base64,SECRET');
      blobAdapter.records.delete(key);
    });

    const result = await executeAttachmentCleanup({
      reviewReport: blobReport,
      confirmationToken: createAttachmentCleanupConfirmationToken(blobReport),
      selectedCandidateIds: [
        attachmentCleanupCandidateId(blobReport.candidates[0], 0),
        attachmentCleanupCandidateId(blobReport.candidates[1], 1),
      ],
      notes: [],
      repository,
      blobAdapter,
    });

    expect(result.deletedBlobCount).toBe(1);
    expect(result.failedCandidateCount).toBe(1);
    expect(JSON.stringify(result)).not.toContain('SECRET');
  });

  it('does not call remote storage APIs', async () => {
    const report = await review({ blobs: [{ localBlobKey: 'local/orphan', size: 5 }] });
    const repository = memoryRepository([]);
    const blobAdapter = memoryBlobAdapter([{ localBlobKey: 'local/orphan', size: 5 }]);
    const remoteStorage = { upload: vi.fn(), remove: vi.fn(), createSignedUrl: vi.fn() };

    await executeAttachmentCleanup({
      reviewReport: report,
      confirmationToken: createAttachmentCleanupConfirmationToken(report),
      selectedCandidateIds: [idFor(report, 'unreferencedBlob')],
      notes: [],
      repository,
      blobAdapter,
    });

    expect(remoteStorage.upload).not.toHaveBeenCalled();
    expect(remoteStorage.remove).not.toHaveBeenCalled();
    expect(remoteStorage.createSignedUrl).not.toHaveBeenCalled();
  });
});
