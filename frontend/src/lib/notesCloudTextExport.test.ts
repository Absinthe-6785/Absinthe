import { describe, expect, it } from 'vitest';
import { createNotesCloudTextDownload } from './notesCloudTextExport';

describe('Notes cloud text export', () => {
  it('preserves the complete Markdown body and UTF-8 content beyond the UI preview limit', async () => {
    const body = `# 量\r\n\r\n${'café 🧪\n'.repeat(2_000)}  `;
    const result = createNotesCloudTextDownload(body, 'Cloud title', 'note-α');

    expect(result).not.toBeNull();
    expect(result!.file.type).toBe('text/markdown;charset=utf-8');
    expect(new Uint8Array(await result!.file.arrayBuffer())).toEqual(new TextEncoder().encode(body));
    expect(await result!.file.text()).toBe(body);
    expect(result!.filename).toContain('Cloud title');
    expect(result!.filename).toContain('006e006f00740065002d03b1');
    expect(result!.filename.endsWith('.md')).toBe(true);
  });

  it('makes duplicate titles produce distinct portable filenames using the complete exact ID', () => {
    const first = createNotesCloudTextDownload('first', '同じ題名/?:', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    const second = createNotesCloudTextDownload('second', '同じ題名/?:', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');

    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(first!.filename).not.toBe(second!.filename);
    expect(first!.filename).toContain('同じ題名___');
    expect(first!.filename).not.toMatch(/[<>:"/\\|?*\u0000-\u001f]/u);
  });

  it('bounds long Korean titles by UTF-8 filename bytes without losing the exact ID discriminator', () => {
    const noteId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const result = createNotesCloudTextDownload('body', '노'.repeat(40), noteId);

    expect(result).not.toBeNull();
    expect(new TextEncoder().encode(result!.filename).byteLength).toBeLessThanOrEqual(255);
    expect(result!.filename.length).toBeLessThanOrEqual(240);
    expect(result!.filename.endsWith(`-${Array.from(noteId, character => character.charCodeAt(0).toString(16).padStart(4, '0')).join('')}.md`)).toBe(true);
    expect(result!.filename.startsWith('노'.repeat(35))).toBe(true);
  });

  it('supports an empty body without adding generated content', async () => {
    const result = createNotesCloudTextDownload('', undefined, 'empty-id');
    expect(result).not.toBeNull();
    expect(result!.filename.startsWith('cloud-note-')).toBe(true);
    expect(await result!.file.text()).toBe('');
    expect(result!.file.size).toBe(0);
  });

  it('fails closed when an exact-ID filename cannot fit safely', () => {
    expect(createNotesCloudTextDownload('body', 'title', 'x'.repeat(100))).toBeNull();
    expect(createNotesCloudTextDownload('body', 'title', '  ')).toBeNull();
  });
});
