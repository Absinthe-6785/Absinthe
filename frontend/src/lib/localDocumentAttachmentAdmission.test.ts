import { describe, expect, it, vi } from 'vitest';
import { LOCAL_IMAGE_ATTACHMENT_MAX_BYTES, validateLocalImageFile } from './localImageAttachments';
import {
  admitLocalDocumentFile,
  LOCAL_DOCUMENT_ATTACHMENT_MAX_BYTES,
} from './localDocumentAttachmentAdmission';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function file(name: string, type: string, size = 4): File {
  return new File([new Uint8Array(size)], name, { type });
}

describe('local document attachment admission', () => {
  it('admits only matching PDF and DOCX declarations without claiming content validation', () => {
    for (const [name, type, format] of [
      ['scan.pdf', 'application/pdf', 'pdf'],
      ['report.DOCX', DOCX_MIME, 'docx'],
    ] as const) {
      const source = file(name, type);
      const result = admitLocalDocumentFile(source);
      expect(result).toMatchObject({
        status: 'ELIGIBLE_BY_DECLARATION',
        format,
        file: source,
        displayName: name,
        size: source.size,
        contentIntegrity: 'UNVERIFIED',
      });
    }
  });

  it.each(['old.doc', 'macro.docm', 'notes.txt', 'no-extension', 'pdf', 'docx'])('rejects unsupported filename %s', name => {
    const result = admitLocalDocumentFile(file(name, DOCX_MIME));
    expect(result).toEqual({ status: 'REJECTED', reason: 'unsupported_extension' });
  });

  it('rejects empty and invalid-sized files and accepts the exact shared 15 MiB boundary', () => {
    expect(admitLocalDocumentFile(file('empty.pdf', 'application/pdf', 0)))
      .toEqual({ status: 'REJECTED', reason: 'empty_file' });
    expect(admitLocalDocumentFile({ name: 'bad.pdf', type: 'application/pdf', size: Number.NaN } as File))
      .toEqual({ status: 'REJECTED', reason: 'invalid_size' });
    expect(LOCAL_DOCUMENT_ATTACHMENT_MAX_BYTES).toBe(LOCAL_IMAGE_ATTACHMENT_MAX_BYTES);

    const boundary = { name: 'limit.pdf', type: 'application/pdf', size: LOCAL_DOCUMENT_ATTACHMENT_MAX_BYTES } as File;
    expect(admitLocalDocumentFile(boundary)).toMatchObject({
      status: 'ELIGIBLE_BY_DECLARATION',
      size: LOCAL_DOCUMENT_ATTACHMENT_MAX_BYTES,
    });
    expect(admitLocalDocumentFile({ ...boundary, size: boundary.size + 1 } as File))
      .toEqual({ status: 'REJECTED', reason: 'file_too_large' });
  });

  it.each([
    ['report.pdf', DOCX_MIME, 'mime_extension_mismatch'],
    ['report.docx', 'application/pdf', 'mime_extension_mismatch'],
    ['report.docx', '', 'invalid_mime'],
    ['report.pdf', 'application/pdf; charset=binary', 'invalid_mime'],
  ] as const)('rejects conflicting or malformed declaration for %s', (name, type, reason) => {
    expect(admitLocalDocumentFile(file(name, type))).toEqual({ status: 'REJECTED', reason });
  });

  it.each(['invoice.pdf.docx', 'invoice.docm.docx', 'invoice.docx.pdf'])('rejects ambiguous double extension %s', name => {
    expect(admitLocalDocumentFile(file(name, name.endsWith('.pdf') ? 'application/pdf' : DOCX_MIME)))
      .toEqual({ status: 'REJECTED', reason: 'ambiguous_extension' });
  });

  it.each(['../escape.pdf', '..\\escape.docx', 'bad\u0000name.pdf', 'rtl\u202Efdp.pdf'])
    ('rejects unsafe display filename %s', name => {
      expect(admitLocalDocumentFile(file(name, name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : DOCX_MIME)))
        .toEqual({ status: 'REJECTED', reason: 'unsafe_filename' });
    });

  it('returns the identical File and never reads or converts its bytes', async () => {
    const source = file('source.pdf', 'application/pdf');
    const bytesBefore = await source.arrayBuffer();
    const readSpy = vi.spyOn(source, 'arrayBuffer');

    const result = admitLocalDocumentFile(source);

    expect(result.status).toBe('ELIGIBLE_BY_DECLARATION');
    if (result.status !== 'ELIGIBLE_BY_DECLARATION') throw new Error('expected eligible declaration');
    expect(result.file).toBe(source);
    expect(result.displayName).toBe(source.name);
    expect(readSpy).not.toHaveBeenCalled();
    expect(await source.arrayBuffer()).toEqual(bytesBefore);
    expect(readSpy).toHaveBeenCalledTimes(1);
  });

  it('leaves existing image admission policy and 15 MiB cap unchanged', () => {
    expect(LOCAL_DOCUMENT_ATTACHMENT_MAX_BYTES).toBe(15 * 1024 * 1024);
    expect(validateLocalImageFile(file('photo.png', 'image/png'))).toBeNull();
    expect(validateLocalImageFile(file('document.pdf', 'application/pdf'))).toBe('Unsupported image type');
    expect(validateLocalImageFile(file('oversize.png', 'image/png', LOCAL_IMAGE_ATTACHMENT_MAX_BYTES + 1)))
      .toBe('Image file is too large');
  });
});
