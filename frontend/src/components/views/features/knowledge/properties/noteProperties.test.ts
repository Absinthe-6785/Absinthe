import { describe, it, expect, beforeEach } from 'vitest';
import type { NoteBase } from '../../../noteUtils';
import { normalizeNote, normalizeNoteProperties } from '../../../noteUtils';
import {
  getProperty,
  listProperties,
  parseNoteMarkdown,
  removeProperty,
  serializeNoteMarkdown,
  setProperty,
} from './noteProperties';
import { KnowledgeIndexService } from '../KnowledgeIndexService';

function note(overrides: Partial<NoteBase> = {}): NoteBase {
  return {
    id: 'n1',
    title: 'Japanese Study',
    body: 'Content',
    updatedAt: 0,
    folderId: null,
    deletedAt: null,
    ...overrides,
  };
}

describe('note property helpers', () => {
  it('creates and reads properties', () => {
    let n = note();
    n = setProperty(n, 'status', 'active');
    n = setProperty(n, 'priority', 'high');

    expect(getProperty(n, 'status')).toBe('active');
    expect(listProperties(n)).toHaveLength(2);
  });

  it('lookup is case insensitive and preserves display casing', () => {
    let n = setProperty(note(), 'Status', 'active');
    expect(getProperty(n, 'STATUS')).toBe('active');
    expect(listProperties(n)[0].key).toBe('Status');
  });

  it('updates existing property case-insensitively', () => {
    let n = setProperty(note(), 'status', 'active');
    n = setProperty(n, 'STATUS', 'done');
    expect(getProperty(n, 'status')).toBe('done');
    expect(Object.keys(n.properties!)).toEqual(['STATUS']);
  });

  it('removes properties case-insensitively', () => {
    let n = setProperty(note(), 'status', 'active');
    n = removeProperty(n, 'STATUS');
    expect(n.properties).toBeUndefined();
  });
});

describe('normalizeNote backward compatibility', () => {
  it('loads notes without properties', () => {
    const n = normalizeNote({
      id: '1',
      title: 'Legacy',
      body: 'body',
      updatedAt: 1,
      folderId: null,
      deletedAt: null,
    });
    expect(n.properties).toBeUndefined();
  });

  it('normalizes stored properties', () => {
    expect(normalizeNoteProperties({ status: 'active', '': 'x' })).toEqual({ status: 'active' });
  });
});

describe('markdown export/import', () => {
  it('round-trips properties via frontmatter', () => {
    const original = setProperty(
      setProperty(note(), 'status', 'active'),
      'priority',
      'high',
    );
    const raw = serializeNoteMarkdown(original);
    const parsed = parseNoteMarkdown(raw);

    expect(parsed.properties).toEqual({ status: 'active', priority: 'high' });
    expect(parsed.body).toBe('Content');
  });

  it('imports markdown without frontmatter', () => {
    expect(parseNoteMarkdown('# Hello\n\nWorld')).toEqual({
      body: '# Hello\n\nWorld',
    });
  });

  it('exports body-only when no properties', () => {
    expect(serializeNoteMarkdown(note())).toBe('Content');
  });

  it('preserves LaTeX in exported markdown body', () => {
    const withMath = { ...note(), body: 'Identity $a^2+b^2=c^2$ and\n\n$$\n\\begin{pmatrix}a&b\\\\c&d\\end{pmatrix}\n$$' };
    const raw = serializeNoteMarkdown(withMath);
    expect(raw).toContain('$a^2+b^2=c^2$');
    expect(raw).toContain('\\begin{pmatrix}');
    expect(parseNoteMarkdown(raw).body).toBe(withMath.body);
  });
});

describe('KnowledgeIndexService properties extension', () => {
  let service: KnowledgeIndexService;

  beforeEach(() => {
    service = new KnowledgeIndexService();
  });

  it('indexes properties on buildFromNotes', () => {
    service.buildFromNotes([
      setProperty(note({ id: 'a' }), 'status', 'active'),
    ]);
    expect(service.getProperties('a')).toEqual({ status: 'active' });
  });

  it('updates properties incrementally', () => {
    service.buildFromNotes([note({ id: 'a' })]);
    service.updateNote(setProperty(note({ id: 'a' }), 'source', 'textbook'));
    expect(service.getProperties('a')).toEqual({ source: 'textbook' });
  });

  it('removes properties on removeNote', () => {
    service.buildFromNotes([setProperty(note({ id: 'a' }), 'status', 'active')]);
    service.removeNote('a');
    expect(service.getProperties('a')).toEqual({});
  });

  it('preserves properties through trash and restore flows', () => {
    const active = setProperty(note({ id: 'a' }), 'status', 'active');
    service.buildFromNotes([active]);
    service.removeNote('a');
    expect(service.getProperties('a')).toEqual({});

    service.updateNote({ ...active, deletedAt: null });
    expect(service.getProperties('a')).toEqual({ status: 'active' });
  });
});

describe('duplication and rename', () => {
  it('duplicate copies properties', () => {
    const original = setProperty(note(), 'status', 'active');
    const copy: NoteBase = {
      ...original,
      id: 'n2',
      title: original.title + ' (copy)',
    };
    expect(copy.properties).toEqual({ status: 'active' });
  });

  it('rename does not alter properties', () => {
    const renamed = { ...setProperty(note(), 'status', 'active'), title: 'Renamed' };
    expect(renamed.properties).toEqual({ status: 'active' });
  });
});
