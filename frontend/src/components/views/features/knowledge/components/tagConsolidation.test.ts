// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { listTags } from '../tags';
import { KnowledgeIndexService } from '../KnowledgeIndexService';
import { addTag, removeTag, renameTag } from '../tags/noteTags';
import type { NoteBase } from '../../../noteUtils';

const knowledgeComponents = dirname(fileURLToPath(import.meta.url));

function note(overrides: Partial<NoteBase> = {}): NoteBase {
  return {
    id: 'n-test',
    title: 'Test',
    body: '',
    updatedAt: 0,
    folderId: null,
    deletedAt: null,
    ...overrides,
  };
}

describe('K-90A1 tag consolidation', () => {
  it('NoteTagsPanel delegates to NoteTagsEditor', () => {
    const source = readFileSync(join(knowledgeComponents, 'NoteTagsPanel.tsx'), 'utf8');
    expect(source).toContain('NoteTagsEditor');
    expect(source).not.toContain('addTag(note');
  });

  it('NotePropertiesPanel embeds NoteTagsEditor for tag CRUD', () => {
    const source = readFileSync(join(knowledgeComponents, 'NotePropertiesPanel.tsx'), 'utf8');
    expect(source).toContain('NoteTagsEditor');
    expect(source).toContain('tagPageTags');
    expect(source).toContain('onUpdateProperties');
  });

  it('NoteTagsEditor uses shared noteTags actions', () => {
    const source = readFileSync(join(knowledgeComponents, 'NoteTagsEditor.tsx'), 'utf8');
    expect(source).toContain('addTag(note');
    expect(source).toContain('removeTag(note');
    expect(source).toContain('renameTag(note');
    expect(source).not.toMatch(/function addTag/);
  });

  it('tag lifecycle persists through properties.tags', () => {
    let n = addTag(note(), 'grammar');
    expect(listTags(n)).toEqual(['grammar']);
    n = renameTag(n, 'grammar', 'EJU');
    expect(listTags(n)).toEqual(['EJU']);
    n = removeTag(n, 'eju');
    expect(listTags(n)).toEqual([]);
    expect(n.properties).toBeUndefined();
  });

  it('reindexes tags after property update through KnowledgeIndexService', () => {
    const service = new KnowledgeIndexService();
    const base = note({ id: 'a' });
    service.buildFromNotes([base]);
    service.updateNote(addTag(base, 'fresh'));
    expect(service.getNotesWithTag('fresh')).toEqual(['a']);
    service.updateNote(note({ id: 'a' }));
    expect(service.getNotesWithTag('fresh')).toEqual([]);
  });
});
