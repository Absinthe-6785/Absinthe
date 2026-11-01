import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash, webcrypto } from 'node:crypto';
import { Buffer } from 'node:buffer';
import JSZip from 'jszip';
import type { AccountScopedAttachmentMetadata, AttachmentBlobRecord } from './attachmentRepository';
const authority = vi.hoisted(() => ({ request: null as { accountId: string } | null,
  notes: [] as { id: string; body: string; deletedAt: string | number | null; title?: string; updatedAt?: number; folderId?: null }[], listeners: new Set<() => void>() }));
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
const docxMime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const checksum = (data: Uint8Array) => `sha256:${createHash('sha256').update(data).digest('hex')}`;
const documentMetadata = (id = 'doc', patch: Partial<AccountScopedAttachmentMetadata> = {}) => metadata(id, {
  fileName: '원본.pdf', mimeType: 'application/pdf', localBlobKey: `local-document/A/${id}`, checksum: checksum(bytes), deletedAt: null, ...patch,
});
function documentRecord(item: AccountScopedAttachmentMetadata, data = bytes): AttachmentBlobRecord {
  return { key: item.localBlobKey!, blob: new Blob([data], { type: item.mimeType }), mimeType: item.mimeType, size: data.length, checksum: checksum(data) };
}
function publishDocuments(ids: string[]) {
  authority.notes = [{ id: 'note-A', title: 'Note', body: ids.map(id => `attachment://${id}`).join('\n'), updatedAt: 1, folderId: null, deletedAt: null }];
}
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

describe('document originals in the existing read-only ZIP', () => {
  it('exports mixed image/PDF/DOCX bytes exactly, with SHA-256 for documents and legacy image size-only disclosure', async () => {
    const pdf = documentMetadata(), docx = documentMetadata('docx', { fileName: '日本語.docx', mimeType: docxMime });
    publishDocuments(['doc', 'docx']); list.mockResolvedValue([metadata(), pdf, docx]);
    read.mockImplementation(async key => key.startsWith('local-image/') ? record(key) : documentRecord(key.endsWith('/doc') ? pdf : docx));
    const owner = session(), report = await owner.preflight();
    expect(report).toMatchObject({ included: 3, excluded: 0, bytes: 12, coverage: 'complete_for_preflight' });
    expect(report.entries.map(entry => entry.integrity)).toEqual(['size_only', 'sha256', 'sha256']);
    expect(report.entries.map(entry => entry.path?.split('.').pop())).toEqual(['png', 'pdf', 'docx']);
    await owner.download(); const zip = await JSZip.loadAsync(await (save.mock.calls[0][0] as Blob).arrayBuffer());
    for (const entry of report.entries) expect(await zip.file(entry.path!)!.async('uint8array')).toEqual(bytes);
    const coverage = await zip.file('COVERAGE.txt')!.async('string');
    expect(coverage).toContain('PDF/DOCX'); expect(coverage).toContain('not document structure or safety');
    expect(coverage).toContain('NOT a complete attachment backup'); expect(zip.file('manifest.json')).toBeNull();
    expect(write).not.toHaveBeenCalled();
  });
  it.each([
    [{ accountId: 'B', fileName: 'FOREIGN.pdf' }, 'unproven_ownership'],
    [{ localBlobKey: 'local-document/B/doc' }, 'unproven_ownership'],
    [{ localBlobKey: 'local-image/A/doc' }, 'unsupported_source_or_type'],
    [{ noteId: 'other' }, 'unavailable_note'],
    [{ deletedAt: 'deleted' }, 'deleted_metadata'],
    [{ source: 'remote' }, 'unsupported_source_or_type'],
    [{ size: 15 * 1024 * 1024 + 1 }, 'size_limit'],
  ] as const)('excludes document ownership/state %j', async (patch, reason) => {
    const doc = documentMetadata('doc', patch); publishDocuments(['doc']); list.mockResolvedValue([doc]);
    const owner = session(), report = await owner.preflight();
    expect(report.entries[0].reason).toBe(reason); expect(report.included).toBe(0); expect(read).not.toHaveBeenCalled();
    expect(localOriginalsCoverageText(report)).not.toContain('FOREIGN'); owner.cancel();
  });
  it.each(['staged', 'wrong-note-reference', 'deleted-note', 'incomplete-note', 'duplicate-note', 'duplicate-metadata'])('excludes %s without claiming attachment publication', async kind => {
    const doc = documentMetadata(); publishDocuments(kind === 'staged' ? [] : ['doc']);
    if (kind === 'wrong-note-reference') { authority.notes[0].body = ''; authority.notes.push({ ...authority.notes[0], id: 'other', body: 'attachment://doc' }); }
    if (kind === 'deleted-note') authority.notes[0].deletedAt = 2;
    if (kind === 'incomplete-note') delete authority.notes[0].title;
    if (kind === 'duplicate-note') authority.notes.push({ ...authority.notes[0] });
    list.mockResolvedValue(kind === 'duplicate-metadata' ? [doc, { ...doc }] : [doc]);
    const owner = session(), report = await owner.preflight();
    expect(report.included).toBe(0); expect(report.coverage).toBe('partial'); expect(read).not.toHaveBeenCalled();
    if (kind === 'staged' || kind === 'wrong-note-reference') expect(report.entries[0].reason).toBe('unreferenced_document');
    owner.cancel(); expect(write).not.toHaveBeenCalled();
  });
  it.each(['missing', 'empty', 'invalid', 'missing-blob-checksum', 'contradictory', 'corrupt', 'crypto-unavailable'])('requires verifiable document SHA-256: %s', async kind => {
    const doc = documentMetadata(), blob = documentRecord(doc); publishDocuments(['doc']);
    if (kind === 'missing') delete doc.checksum;
    if (kind === 'empty') doc.checksum = '';
    if (kind === 'invalid') doc.checksum = 'md5:bad';
    if (kind === 'missing-blob-checksum') delete blob.checksum;
    if (kind === 'contradictory') blob.checksum = `sha256:${'0'.repeat(64)}`;
    if (kind === 'corrupt') blob.blob = new Blob([new Uint8Array([0, 255, 4, 9])], { type: doc.mimeType });
    if (kind === 'crypto-unavailable') vi.stubGlobal('crypto', {});
    list.mockResolvedValue([doc]); read.mockResolvedValue(blob);
    const owner = session(), report = await owner.preflight();
    expect(report).toMatchObject({ included: 0, excluded: 1, coverage: 'partial' });
    expect(report.entries[0].reason).toMatch(/^checksum_(unverifiable|mismatch)$/);
    expect(report.entries[0]).not.toHaveProperty('integrity'); owner.cancel();
  });
  it.each([
    { fileName: 'x.docx' }, { fileName: 'x.pdf', mimeType: docxMime }, { fileName: 'x.docm' },
    { fileName: '../../x.pdf' }, { fileName: 'C:\\private\\x.pdf' }, { fileName: 'x\n.pdf' }, { fileName: 'x.pdf', mimeType: 'text/plain' },
  ])('rejects unsupported/unsafe declarations %j without parsing or rewriting bytes', async patch => {
    const doc = documentMetadata('doc', patch); publishDocuments(['doc']); list.mockResolvedValue([doc]); read.mockResolvedValue(documentRecord(doc));
    const owner = session(), report = await owner.preflight(); expect(report.included).toBe(0);
    expect(report.entries[0].reason).toBe('unsupported_source_or_type'); owner.cancel();
  });
  it('uses safe unique ZIP paths for duplicate document names', async () => {
    const docs = [documentMetadata('one', { fileName: 'CON.pdf' }), documentMetadata('two', { fileName: 'CON.pdf' })];
    publishDocuments(['one', 'two']); list.mockResolvedValue(docs);
    read.mockImplementation(async key => documentRecord(docs.find(doc => doc.localBlobKey === key)!));
    const owner = session(), report = await owner.preflight(); expect(report.included).toBe(2);
    expect(new Set(report.entries.map(entry => entry.path)).size).toBe(2);
    for (const entry of report.entries) expect(entry.path).toMatch(/^originals\/\d{6}-attachment\.pdf$/);
    owner.cancel();
  });
  it.each(['missing', 'unreadable', 'size', 'mime', 'blob-type', 'key'])('reports unavailable document Blob %s truthfully', async kind => {
    const doc = documentMetadata(), blob = documentRecord(doc); publishDocuments(['doc']); list.mockResolvedValue([doc]);
    if (kind === 'missing') read.mockResolvedValue(null);
    else if (kind === 'unreadable') read.mockRejectedValue(new Error('private'));
    else { if (kind === 'size') blob.size++; if (kind === 'mime') delete blob.mimeType;
      if (kind === 'blob-type') blob.blob = new Blob([bytes]); if (kind === 'key') blob.key = 'local-document/B/doc'; read.mockResolvedValue(blob); }
    const owner = session(), report = await owner.preflight(); expect(report.included).toBe(0);
    await expect(owner.download(true)).rejects.toThrow('confirmation_required'); expect(save).not.toHaveBeenCalled(); owner.cancel();
  });
  it('includes only available documents after explicit partial consent', async () => {
    const doc = documentMetadata(); publishDocuments(['doc', 'missing']); list.mockResolvedValue([doc]); read.mockResolvedValue(documentRecord(doc));
    const owner = session(), report = await owner.preflight();
    expect(report.entries.map(entry => entry.reason)).toEqual(['included', 'metadata_unavailable']);
    await expect(owner.download()).rejects.toThrow('confirmation_required'); expect(save).not.toHaveBeenCalled();
    await owner.download(true); expect(save).toHaveBeenCalledOnce(); expect(write).not.toHaveBeenCalled();
  });
  it.each(['metadata', 'blob', 'checksum', 'zip'])('never releases document bytes across A/B/A during %s', async stage => {
    const doc = documentMetadata(); publishDocuments(['doc']); list.mockResolvedValue([doc]); read.mockResolvedValue(documentRecord(doc));
    const aba = () => { transition('B'); transition('A'); };
    if (stage === 'metadata') list.mockImplementation(async () => { aba(); return [doc]; });
    if (stage === 'blob') read.mockImplementation(async () => { aba(); return documentRecord(doc); });
    if (stage === 'checksum') { const digest = crypto.subtle.digest.bind(crypto.subtle); vi.spyOn(crypto.subtle, 'digest').mockImplementation(async (...args) => { const result = await digest(...args); aba(); return result; }); }
    const owner = session(stage === 'zip' ? { buildZip: async () => { aba(); return new Blob(); } } : {});
    if (stage === 'zip') { await owner.preflight(); await expect(owner.download()).rejects.toThrow('cancelled'); }
    else await expect(owner.preflight()).rejects.toThrow('cancelled');
    expect(save).not.toHaveBeenCalled(); vi.restoreAllMocks();
  });
  it('invalidates document bytes on logout or publication replacement, even for the same account', async () => {
    const doc = documentMetadata(); publishDocuments(['doc']); list.mockResolvedValue([doc]); read.mockResolvedValue(documentRecord(doc));
    for (const account of [null, 'A']) { transition('A'); const owner = session(); await owner.preflight(); transition(account);
      await expect(owner.download()).rejects.toThrow('cancelled'); }
    expect(save).not.toHaveBeenCalled();
  });
  it('rechecks document metadata before releasing a ZIP and rejects a later tombstone', async () => {
    const doc = documentMetadata(); publishDocuments(['doc']); list.mockResolvedValue([doc]); read.mockResolvedValue(documentRecord(doc));
    const owner = session({ buildZip: async () => { list.mockResolvedValue([{ ...doc, deletedAt: 'now' }]); return new Blob(); } });
    await owner.preflight(); await expect(owner.download()).rejects.toThrow('metadata_changed'); expect(save).not.toHaveBeenCalled();
  });
  it('bounds document read volume at 100 MiB and inventory at 500 records', async () => {
    const docs = Array.from({ length: 8 }, (_, i) => documentMetadata(`doc-${i}`, { size: 15 * 1024 * 1024 }));
    publishDocuments(docs.map(doc => doc.id)); list.mockResolvedValue(docs); read.mockResolvedValue(null);
    const owner = session(), report = await owner.preflight(); expect(read).toHaveBeenCalledTimes(6);
    expect(report.entries.filter(entry => entry.reason === 'size_limit')).toHaveLength(2); owner.cancel();
    const exactBudget = [...docs.slice(0, 6), documentMetadata('ten', { size: 10 * 1024 * 1024 }), documentMetadata('overflow', { size: 1 })];
    publishDocuments(exactBudget.map(doc => doc.id)); list.mockResolvedValue(exactBudget); read.mockClear();
    const exact = session(), exactReport = await exact.preflight(); expect(read).toHaveBeenCalledTimes(7);
    expect(exactReport.entries.at(-1)?.reason).toBe('size_limit'); exact.cancel();
    list.mockResolvedValue(Array.from({ length: 500 }, (_, i) => documentMetadata(`d-${i}`))); publishDocuments([]);
    const bounded = session(); expect((await bounded.preflight()).entries).toHaveLength(500); bounded.cancel();
    list.mockResolvedValue(Array.from({ length: 501 }, (_, i) => documentMetadata(`d-${i}`)));
    await expect(session().preflight()).rejects.toThrow('size_limit');
  });
  it('accepts exactly 15 MiB without changing the original bytes', async () => {
    const data = new Uint8Array(15 * 1024 * 1024), doc = documentMetadata('doc', { size: data.length, checksum: checksum(data) });
    publishDocuments(['doc']); list.mockResolvedValue([doc]); read.mockResolvedValue(documentRecord(doc, data));
    const owner = session({ buildZip: async (files: { bytes: Uint8Array }[]) => { expect(Buffer.compare(Buffer.from(files[0].bytes), Buffer.from(data))).toBe(0); return new Blob(); } });
    expect((await owner.preflight()).bytes).toBe(data.length); await owner.download();
  });
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
