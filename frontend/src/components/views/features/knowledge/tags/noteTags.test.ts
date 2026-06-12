import { describe, it, expect, beforeEach } from 'vitest';
import type { NoteBase } from '../../../noteUtils';
import { parseNoteMarkdown, serializeNoteMarkdown, setProperty } from '../properties/noteProperties';
import { TAGS_PROPERTY_KEY, tagsFromPropertyValue, tagsToPropertyValue } from './tagConstants';
import {
  addTag,
  hasTag,
  listTags,
  removeTag,
  renameTag,
  setTags,
} from './noteTags';
import { KnowledgeIndexService } from '../KnowledgeIndexService';

function note(overrides: Partial<NoteBase> = {}): NoteBase {
  return {
    id: 'n1',
    title: 'Page',
    body: 'Body',
    updatedAt: 0,
    folderId: null,
    deletedAt: null,
    ...overrides,
  };
}

describe('noteTags', () => {
  it('adds tags with display casing preserved', () => {
    let n = addTag(note(), 'Japanese');
    expect(listTags(n)).toEqual(['Japanese']);
  });

  it('prevents duplicate tags case-insensitively', () => {
    let n = addTag(addTag(note(), 'Japanese'), 'japanese');
    expect(listTags(n)).toEqual(['Japanese']);
  });

  it('removes tags case-insensitively', () => {
    let n = addTag(note(), 'Grammar');
    n = removeTag(n, 'grammar');
    expect(listTags(n)).toEqual([]);
    expect(n.properties).toBeUndefined();
  });

  it('renames tags on a page', () => {
    let n = setTags(note(), ['Old']);
    n = renameTag(n, 'old', 'New Name');
    expect(listTags(n)).toEqual(['New Name']);
  });

  it('stores tags in properties.tags', () => {
    const n = addTag(note(), 'eju');
    expect(n.properties?.[TAGS_PROPERTY_KEY]).toBeTruthy();
    expect(hasTag(n, 'EJU')).toBe(true);
  });
});

describe('tags markdown frontmatter', () => {
  it('round-trips tags via YAML list frontmatter', () => {
    let n = setTags(setProperty(note(), 'status', 'active'), ['Japanese', 'grammar']);
    const raw = serializeNoteMarkdown(n);
    expect(raw).toContain('tags:');
    expect(raw).toContain('- Japanese');

    const parsed = parseNoteMarkdown(raw);
    expect(listTags({ ...n, properties: parsed.properties })).toEqual(['Japanese', 'grammar']);
    expect(parsed.properties?.status).toBe('active');
  });

  it('imports tags list frontmatter', () => {
    const raw = `---\ntags:\n  - japanese\n  - grammar\n---\n\n# Hello`;
    const parsed = parseNoteMarkdown(raw);
    expect(listTags({ ...note(), properties: parsed.properties })).toEqual(['japanese', 'grammar']);
    expect(parsed.body).toBe('# Hello');
  });

  it('parses tags from array-shaped property values', () => {
    expect(tagsFromPropertyValue(['Japanese', 'grammar'])).toEqual(['Japanese', 'grammar']);
    expect(tagsFromPropertyValue(null)).toEqual([]);
    expect(tagsFromPropertyValue({ tags: ['x'] })).toEqual([]);
  });
});

describe('KnowledgeIndexService tags', () => {
  let service: KnowledgeIndexService;

  beforeEach(() => {
    service = new KnowledgeIndexService();
  });

  it('indexes tags on buildFromNotes', () => {
    service.buildFromNotes([
      addTag(note({ id: 'a' }), 'Japanese'),
      addTag(note({ id: 'b' }), 'grammar'),
      addTag(note({ id: 'c' }), 'Japanese'),
    ]);

    expect(service.getTags('a')).toEqual(['Japanese']);
    expect(service.getTagCount('japanese')).toBe(2);
    expect(service.getNotesWithTag('JAPANESE').sort()).toEqual(['a', 'c']);
  });

  it('updates tags incrementally', () => {
    service.buildFromNotes([note({ id: 'a' })]);
    service.updateNote(addTag(note({ id: 'a' }), 'new-tag'));
    expect(service.getNotesWithTag('new-tag')).toEqual(['a']);
  });

  it('removes tags on trash', () => {
    service.buildFromNotes([addTag(note({ id: 'a' }), 'temp')]);
    service.removeNote('a');
    expect(service.getNotesWithTag('temp')).toEqual([]);
  });

  it('restores tags after restore flow', () => {
    const tagged = addTag(note({ id: 'a' }), 'keep');
    service.buildFromNotes([tagged]);
    service.removeNote('a');
    service.updateNote({ ...tagged, deletedAt: null });
    expect(service.getTags('a')).toEqual(['keep']);
  });
});

describe('duplication', () => {
  it('copies tags when duplicating a note', () => {
    const original = addTag(note(), 'shared');
    const copy: NoteBase = { ...original, id: 'n2', title: 'copy' };
    expect(listTags(copy)).toEqual(['shared']);
  });
});
