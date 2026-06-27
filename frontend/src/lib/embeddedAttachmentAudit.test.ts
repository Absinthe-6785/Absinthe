import { describe, expect, it } from 'vitest';
import {
  auditEmbeddedAttachments,
  estimateDecodedBase64Bytes,
  findEmbeddedPayloadsInText,
} from './embeddedAttachmentAudit';

describe('embedded attachment migration audit', () => {
  it('detects data:image/png;base64 in note body', () => {
    const report = auditEmbeddedAttachments([
      { id: 'n1', title: 'PNG', body: 'before data:image/png;base64,QUJDRA== after' },
    ]);

    expect(report.summary).toMatchObject({
      totalNotesScanned: 1,
      notesWithEmbeddedPayloads: 1,
      totalEmbeddedPayloads: 1,
      imagePayloadCount: 1,
    });
    expect(report.candidates[0]?.payloads[0]).toMatchObject({
      noteId: 'n1',
      mimeType: 'image/png',
      kind: 'image',
      estimatedBase64Bytes: 8,
      estimatedDecodedBytes: 4,
      recommendedTarget: 'local-attachment',
    });
  });

  it('detects data:image/jpeg;base64 in markdown image syntax', () => {
    const report = auditEmbeddedAttachments([
      { id: 'n1', body: '![photo](data:image/jpeg;base64,QUJD)' },
    ]);

    expect(report.candidates[0]?.payloads[0]).toMatchObject({
      mimeType: 'image/jpeg',
      kind: 'image',
      startOffset: 9,
    });
  });

  it('detects data:image/webp;base64 in serialized JSON-like body', () => {
    const report = auditEmbeddedAttachments([
      { id: 'n1', body: JSON.stringify({ type: 'image', src: 'data:image/webp;base64,V0VCUA==' }) },
    ]);

    expect(report.candidates[0]?.payloads[0]).toMatchObject({
      mimeType: 'image/webp',
      kind: 'image',
    });
  });

  it('detects data:application/pdf;base64 as pdf candidate', () => {
    const report = auditEmbeddedAttachments([
      { id: 'n1', body: 'data:application/pdf;base64,JVBERg==' },
    ]);

    expect(report.summary.pdfPayloadCount).toBe(1);
    expect(report.candidates[0]?.payloads[0]?.kind).toBe('pdf');
  });

  it('detects generic data:*;base64 as other candidate', () => {
    const report = auditEmbeddedAttachments([
      { id: 'n1', body: 'data:application/octet-stream;base64,QUJD' },
    ]);

    expect(report.summary.otherDataPayloadCount).toBe(1);
    expect(report.candidates[0]?.payloads[0]).toMatchObject({
      mimeType: 'application/octet-stream',
      kind: 'other',
    });
  });

  it('does not flag attachment references or normal image URLs', () => {
    const report = auditEmbeddedAttachments([
      { id: 'n1', body: 'attachment://att-1 https://example.com/image.png ![x](https://example.com/x.jpg)' },
    ]);

    expect(report.summary.totalEmbeddedPayloads).toBe(0);
    expect(report.candidates).toEqual([]);
  });

  it('estimates base64 and decoded sizes without decoding', () => {
    expect(estimateDecodedBase64Bytes('QUJDRA==')).toBe(4);
    expect(estimateDecodedBase64Bytes('QUJD')).toBe(3);
  });

  it('reports per-note candidate counts', () => {
    const report = auditEmbeddedAttachments([
      { id: 'n1', title: 'Mixed', body: 'data:image/png;base64,QUJD data:application/pdf;base64,JVBERg==' },
    ]);

    expect(report.candidates).toHaveLength(1);
    expect(report.candidates[0]).toMatchObject({
      noteId: 'n1',
      noteTitle: 'Mixed',
      payloadCount: 2,
    });
    expect(report.summary.totalEmbeddedPayloads).toBe(2);
  });

  it('does not include full base64 payload in safe report fields', () => {
    const payload = 'QUJDREVGR0hJSktMTU5PUA==';
    const report = auditEmbeddedAttachments([
      { id: 'n1', body: `data:image/png;base64,${payload}` },
    ]);

    const candidate = report.candidates[0]?.payloads[0];
    expect(candidate?.previewLabel).toContain('QUJD...');
    expect(candidate?.previewLabel).not.toContain(payload);
    expect(JSON.stringify(report)).not.toContain(payload);
  });

  it('does not mutate input notes or embedded data', () => {
    const note = { id: 'n1', title: 'Original', body: 'data:image/png;base64,QUJDRA==' };
    const before = JSON.stringify(note);

    const report = auditEmbeddedAttachments([note]);

    expect(JSON.stringify(note)).toBe(before);
    expect(note.body).toBe('data:image/png;base64,QUJDRA==');
    expect(report.summary.totalEmbeddedPayloads).toBe(1);
  });

  it('can scan content fields without mutating them', () => {
    const note = { id: 'n1', content: 'data:image/gif;base64,R0lGODlh' };
    const report = auditEmbeddedAttachments([note]);

    expect(report.candidates[0]?.payloads[0]).toMatchObject({
      mimeType: 'image/gif',
      kind: 'image',
    });
    expect(note.content).toBe('data:image/gif;base64,R0lGODlh');
  });

  it('exposes K-149 non-destructive migration requirements', () => {
    const report = auditEmbeddedAttachments([]);

    expect(report.k149MigrationRequirements).toEqual(expect.arrayContaining([
      'Backup the original note body before any replacement.',
      'Copy each embedded data payload to local blob storage before editing the note.',
      'Replace the embedded data URL with an attachment:// reference only after blob and metadata writes succeed.',
    ]));
  });

  it('findEmbeddedPayloadsInText returns empty results for text without data URLs', () => {
    expect(findEmbeddedPayloadsInText('n1', 'plain note with attachment://att-1')).toEqual([]);
  });
});
