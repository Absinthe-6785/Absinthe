import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import JSZip from 'jszip';
import type { AccountScopedAttachmentMetadata, AttachmentBlobRecord } from './attachmentRepository';
const authority = vi.hoisted(() => ({ request: null as { accountId: string } | null,
  notes: [] as { id: string; body: string; deletedAt: string | null }[], listeners: new Set<() => void>() }));
vi.mock('../store/useNotesStore', () => ({
  useNotesStore: { getState: () => ({ notes: authority.notes }), subscribe: (fn: () => void) => {
    authority.listeners.add(fn); return () => { authority.listeners.delete(fn); };
  } },
  observePublishedNotesHydration: () => authority.request ? { status: 'CURRENT', request: authority.request } : { status: 'UNAVAILABLE' },
}));
import { createLocalOriginalsExport, localOriginalsCoverageText } from './localAttachmentOriginalsExport';

const bytes = new Uint8Array([0, 255, 4, 8]);
const metadata = (id = 'att-1', patch: Partial<AccountScopedAttachmentMetadata> = {}): AccountScopedAttachmentMetadata => ({
  id, accountId: 'A', noteId: 'note-A', fileName: 'same.png', mimeType: 'image/png', source: 'local', size: bytes.length,
  localBlobKey: `local-image/A/${id}`, createdAt: '2026-10-01', updatedAt: '2026-10-01', ...patch,
});
const record = (key = 'local-image/A/att-1'): AttachmentBlobRecord => ({ key, blob: new Blob([bytes], { type: 'image/png' }), size: bytes.length, mimeType: 'image/png' });
const list = vi.fn<() => Promise<AccountScopedAttachmentMetadata[]>>();
const read = vi.fn<(key: string) => Promise<AttachmentBlobRecord | null>>();
const write = vi.fn();
const save = vi.fn();
function session(extra = {}) { return createLocalOriginalsExport('A', () => true, {
  repository: { listAttachmentsForAccount: list, ...{ putAttachment: write, deleteAttachmentMetadata: write } },
  blobs: { getBlob: read, ...{ putBlob: write, deleteBlob: write } }, download: save, ...extra,
}); }
function transition(account: string | null) {
  authority.request = account ? { accountId: account } : null;
  for (const listener of authority.listeners) listener();
}
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(yes => { resolve = yes; }); return { promise, resolve }; }
beforeEach(() => {
  vi.stubGlobal('crypto', webcrypto);
  authority.request = { accountId: 'A' }; authority.notes = [{ id: 'note-A', body: '', deletedAt: null }];
  list.mockReset().mockResolvedValue([metadata()]); read.mockReset().mockResolvedValue(record()); save.mockReset(); write.mockReset();
});
afterEach(() => { authority.listeners.clear(); vi.unstubAllGlobals(); });

describe('local originals read-only export', () => {
  it('round-trips exact bytes and discloses size-only verification without changing Vault formats', async () => {
    const owner = session(); const report = await owner.preflight();
    expect(report).toMatchObject({ included: 1, excluded: 0, bytes: 4, coverage: 'complete_for_preflight' });
    expect(save).not.toHaveBeenCalled();
    await owner.download();
    const zip = await JSZip.loadAsync(await (save.mock.calls[0][0] as Blob).arrayBuffer());
    const path = report.entries[0].path!;
    expect(await zip.file(path)!.async('uint8array')).toEqual(bytes);
    const coverage = await zip.file('COVERAGE.txt')!.async('string');
    expect(coverage).toContain('size_only'); expect(coverage).toContain('NOT a complete attachment backup');
    expect(coverage).toContain('not a Vault restore package');
    expect(zip.file('manifest.json')).toBeNull(); expect(write).not.toHaveBeenCalled();
  });
  it('gives duplicate filenames distinct safe paths and preserves each file', async () => {
    list.mockResolvedValue([metadata(), metadata('att-2')]); read.mockImplementation(async key => record(key));
    const owner = session(); const report = await owner.preflight();
    expect(report.included).toBe(2); expect(new Set(report.entries.map(entry => entry.path)).size).toBe(2);
    await owner.download(); const zip = await JSZip.loadAsync(await (save.mock.calls[0][0] as Blob).arrayBuffer());
    for (const entry of report.entries) expect(await zip.file(entry.path!)!.async('uint8array')).toEqual(bytes);
  });
  it.each(['../../evil.png', 'C:\\private\\file.png', '..', 'CON', '\u202econtrol\n.png'])('contains unsafe filename %s within originals/', async fileName => {
    list.mockResolvedValue([metadata('att-1', { fileName })]); const owner = session(); const report = await owner.preflight();
    const path = report.entries[0].path!; expect(path).toMatch(/^originals\/000001-[^/\\\u0000-\u001f]+\.png$/);
    expect(path.slice(10)).not.toContain('..'); owner.cancel();
  });
  it.each([
    [{ accountId: 'B', fileName: 'FOREIGN_SECRET.png' }, 'unproven_ownership'],
    [{ accountId: undefined }, 'unproven_ownership'],
    [{ localBlobKey: 'local-image/B/att-1' }, 'unproven_ownership'],
    [{ localBlobKey: 'legacy-blob' }, 'unproven_ownership'],
    [{ localBlobKey: undefined }, 'unproven_ownership'],
    [{ noteId: 'unavailable' }, 'unavailable_note'],
    [{ deletedAt: 'deleted' }, 'deleted_metadata'],
    [{ source: 'remote' }, 'unsupported_source_or_type'],
    [{ size: 0 }, 'size_limit'],
  ] as const)('rejects ineligible metadata %j before any byte read', async (patch, reason) => {
    list.mockResolvedValue([metadata('att-1', patch as Partial<AccountScopedAttachmentMetadata>)]);
    const owner = session(); const report = await owner.preflight(); expect(report.entries[0].reason).toBe(reason);
    expect(read).not.toHaveBeenCalled(); expect(localOriginalsCoverageText(report)).not.toContain('FOREIGN_SECRET'); owner.cancel();
  });
  it('excludes deleted Notes and reports missing metadata without scanning unscoped storage', async () => {
    authority.notes = [{ id: 'note-A', body: '', deletedAt: 'deleted' }, { id: 'active', body: 'attachment://legacy', deletedAt: null }];
    const owner = session(); const report = await owner.preflight();
    expect(report.entries.map(entry => entry.reason)).toEqual(['unavailable_note', 'metadata_unavailable']);
    expect(read).not.toHaveBeenCalled(); owner.cancel();
  });
  it.each(['missing_blob', 'unreadable_blob', 'size_mismatch', 'type_mismatch', 'unproven_ownership'] as const)('does not claim %s was included', async reason => {
    if (reason === 'missing_blob') read.mockResolvedValue(null);
    if (reason === 'unreadable_blob') read.mockRejectedValue(new Error('private storage path'));
    if (reason === 'size_mismatch') read.mockResolvedValue({ ...record(), size: 7 });
    if (reason === 'type_mismatch') read.mockResolvedValue({ ...record(), mimeType: 'image/jpeg' });
    if (reason === 'unproven_ownership') read.mockResolvedValue(record('local-image/B/att-1'));
    const owner = session(); const report = await owner.preflight(); expect(report.entries[0].reason).toBe(reason);
    expect(report.included).toBe(0); expect(localOriginalsCoverageText(report)).not.toContain('private storage path');
    await expect(owner.download(true)).rejects.toThrow('confirmation_required'); owner.cancel();
  });
  it('verifies metadata and blob SHA-256 rather than trusting stored checksum strings', async () => {
    const hash = await crypto.subtle.digest('SHA-256', bytes);
    const checksum = 'sha256:' + Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
    list.mockResolvedValue([metadata('att-1', { checksum })]); const owner = session();
    expect((await owner.preflight()).entries[0].integrity).toBe('sha256'); owner.cancel();
    list.mockResolvedValue([metadata('att-1', { checksum: 'sha256:' + '0'.repeat(64) })]); const corrupt = session();
    expect((await corrupt.preflight()).entries[0].reason).toBe('checksum_mismatch'); corrupt.cancel();
    list.mockResolvedValue([metadata()]); read.mockResolvedValue({ ...record(), checksum: 'sha256:' + '0'.repeat(64) });
    const blobCorrupt = session(); expect((await blobCorrupt.preflight()).entries[0].reason).toBe('checksum_mismatch'); blobCorrupt.cancel();
  });
  it('fails closed when a supplied checksum cannot be verified', async () => {
    list.mockResolvedValue([metadata('att-1', { checksum: 'sha256:' + '0'.repeat(64) })]); vi.stubGlobal('crypto', {});
    const owner = session(); expect((await owner.preflight()).entries[0].reason).toBe('checksum_unverifiable'); owner.cancel();
  });
  it('never lets an empty checksum bypass another stored checksum on same-size corrupted bytes', async () => {
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const checksum = 'sha256:' + Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    const corrupt = { ...record(), checksum, blob: new Blob([new Uint8Array([0, 255, 4, 9])], { type: 'image/png' }) };
    read.mockResolvedValue(corrupt);
    list.mockResolvedValue([metadata('att-1', { checksum: '' })]);
    const empty = session(); const report = await empty.preflight();
    expect(report).toMatchObject({ included: 0, excluded: 1, coverage: 'partial' });
    expect(report.entries[0].reason).toBe('checksum_unverifiable');
    await expect(empty.download(true)).rejects.toThrow('confirmation_required'); empty.cancel();
    list.mockResolvedValue([metadata()]); const absent = session();
    expect((await absent.preflight()).entries[0].reason).toBe('checksum_mismatch'); absent.cancel();
    list.mockResolvedValue([metadata('att-1', { checksum })]); read.mockResolvedValue({ ...record(), checksum: '' });
    const emptyRecord = session(); expect((await emptyRecord.preflight()).entries[0].reason).toBe('checksum_unverifiable'); emptyRecord.cancel();
    expect(save).not.toHaveBeenCalled();
  });
  it('requires an explicit partial-subset decision', async () => {
    list.mockResolvedValue([metadata(), metadata('missing')]); read.mockImplementation(async key => key.endsWith('missing') ? null : record(key));
    const owner = session(); const report = await owner.preflight(); expect(report.coverage).toBe('partial');
    await expect(owner.download()).rejects.toThrow('confirmation_required'); expect(save).not.toHaveBeenCalled();
    await owner.download(true); expect(save).toHaveBeenCalledOnce(); expect(write).not.toHaveBeenCalled();
  });
  it('cancels an asynchronous blob read across A/B/A without releasing bytes', async () => {
    const pending = deferred<AttachmentBlobRecord>(); read.mockReturnValue(pending.promise);
    const owner = session(); const work = owner.preflight(); await Promise.resolve(); transition('B'); transition('A'); pending.resolve(record());
    await expect(work).rejects.toThrow('cancelled'); await expect(owner.download(true)).rejects.toThrow('cancelled'); expect(save).not.toHaveBeenCalled();
  });
  it('cancels after preflight when Notes change, and during ZIP generation', async () => {
    const owner = session(); await owner.preflight(); authority.notes = [...authority.notes];
    await expect(owner.download()).rejects.toThrow('cancelled'); expect(save).not.toHaveBeenCalled();
    const pending = deferred<Blob>(); const next = session({ buildZip: () => pending.promise }); await next.preflight();
    const download = next.download(); transition('B'); pending.resolve(new Blob());
    await expect(download).rejects.toThrow('cancelled'); expect(save).not.toHaveBeenCalled();
  });
  it('denies missing/wrong authority and bounds record and byte reads', async () => {
    transition(null); expect(() => session()).toThrow('authority_unavailable'); transition('B'); expect(() => session()).toThrow('authority_unavailable'); transition('A');
    list.mockResolvedValue(Array.from({ length: 501 }, (_, i) => metadata(`a-${i}`))); const tooMany = session();
    await expect(tooMany.preflight()).rejects.toThrow('size_limit'); expect(read).not.toHaveBeenCalled();
    list.mockResolvedValue(Array.from({ length: 8 }, (_, i) => metadata(`a-${i}`, { size: 15 * 1024 * 1024 }))); read.mockResolvedValue(null);
    const bounded = session(); const report = await bounded.preflight(); expect(read).toHaveBeenCalledTimes(6);
    expect(report.entries.filter(entry => entry.reason === 'size_limit')).toHaveLength(2); bounded.cancel();
  });
});
