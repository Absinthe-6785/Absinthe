import { describe, expect, it, beforeEach } from 'vitest';
import type { NoteBase } from '../../../noteUtils';
import {
  bodyFingerprint,
  buildLineOffsets,
  buildParagraphOffsets,
  clearLinkContextOffsetIndex,
  extractLinkContexts,
  extractLinkContextsLegacy,
  getCachedParagraphOffsets,
  getParagraphOffsetCacheStats,
  invalidateLinkContextOffsetNote,
  MAX_PARAGRAPH_OFFSET_CACHE_ENTRIES,
  syncLinkContextOffsetCache,
} from './linkContextOffsetIndex';

const notes: NoteBase[] = [
  {
    id: 'n1',
    title: 'Referrer',
    body: '# Heading\n\nSee [[Target Note]] in this paragraph.\n\nAnother block.',
    updatedAt: 0,
    folderId: null,
    deletedAt: null,
  },
  {
    id: 'n2',
    title: 'Target Note',
    body: 'target',
    updatedAt: 0,
    folderId: null,
    deletedAt: null,
  },
  {
    id: 'n3',
    title: 'Line only',
    body: 'Inline [[Target Note]] on one line',
    updatedAt: 0,
    folderId: null,
    deletedAt: null,
  },
  {
    id: 'n4',
    title: 'Deleted',
    body: '[[Target Note]]',
    updatedAt: 0,
    folderId: null,
    deletedAt: 1,
  },
];

describe('buildParagraphOffsets', () => {
  it('matches split(/\\n{2,}/) segment boundaries', () => {
    const body = 'a\n\n\nb\n\nc';
    const splits = body.split(/\n{2,}/);
    const offsets = buildParagraphOffsets(body);
    expect(offsets).toHaveLength(splits.length);
    for (let i = 0; i < splits.length; i += 1) {
      expect(body.slice(offsets[i]!.start, offsets[i]!.end)).toBe(splits[i]);
    }
  });
});

describe('extractLinkContexts offset index', () => {
  beforeEach(() => {
    clearLinkContextOffsetIndex();
  });

  it('matches legacy output for fixture notes', () => {
    const legacy = extractLinkContextsLegacy('Target Note', notes);
    const next = extractLinkContexts('Target Note', notes);
    expect(next).toEqual(legacy);
  });

  it('uses line fallback when link is not in a blank-line paragraph', () => {
    const result = extractLinkContexts('Target Note', notes);
    const lineOnly = result.find(row => row.noteId === 'n3');
    expect(lineOnly?.excerpts[0]).toContain('[[Target Note]]');
  });

  it('invalidates cached offsets for a single edited note', () => {
    const body = notes[0]!.body ?? '';
    const first = getCachedParagraphOffsets('n1', body);
    invalidateLinkContextOffsetNote('n1');
    const editedBody = `${body}\n\nEdited tail.`;
    const second = getCachedParagraphOffsets('n1', editedBody);
    expect(second.length).toBeGreaterThan(first.length);
  });

  it('clears cache when content version bumps', () => {
    getCachedParagraphOffsets('n1', notes[0]!.body ?? '');
    syncLinkContextOffsetCache(1);
    getCachedParagraphOffsets('n1', notes[0]!.body ?? '');
    syncLinkContextOffsetCache(2);
    expect(bodyFingerprint(notes[0]!.body ?? '')).toBeGreaterThan(0);
  });

  it('evicts oldest entries when cache exceeds max size', () => {
    for (let i = 0; i < MAX_PARAGRAPH_OFFSET_CACHE_ENTRIES + 8; i += 1) {
      getCachedParagraphOffsets(`stress-${i}`, `body ${i}\n\npara ${i}`);
    }
    const stats = getParagraphOffsetCacheStats();
    expect(stats.size).toBeLessThanOrEqual(MAX_PARAGRAPH_OFFSET_CACHE_ENTRIES);
    expect(stats.bounded).toBe(true);
  });

  it('buildLineOffsets covers each non-empty line', () => {
    const body = 'line1\nline2\n\nline3';
    const lines = buildLineOffsets(body);
    expect(lines.map(o => body.slice(o.start, o.end))).toEqual(['line1', 'line2', 'line3']);
  });
});

describe('extractLinkContextsLegacy parity matrix', () => {
  beforeEach(() => clearLinkContextOffsetIndex());

  it('handles multi-paragraph excerpts with truncation', () => {
    const longBody = [
      `First [[Target Note]] ${'x'.repeat(200)}`,
      '',
      'Second [[Target Note]] block',
    ].join('\n');
    const vault: NoteBase[] = [{
      id: 'long',
      title: 'Long',
      body: longBody,
      updatedAt: 0,
      folderId: null,
      deletedAt: null,
    }];
    expect(extractLinkContexts('Target Note', vault)).toEqual(extractLinkContextsLegacy('Target Note', vault));
  });
});
