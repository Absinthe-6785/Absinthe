import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const knowledgeComponents = dirname(fileURLToPath(import.meta.url));
const noteviewRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../noteview');

function readKnowledge(relativePath: string) {
  return readFileSync(join(knowledgeComponents, relativePath), 'utf8');
}

describe('K-90A2 tags surface cleanup', () => {
  it('Tags tab uses NoteTagBrowser instead of NoteTagsEditor', () => {
    const panel = readKnowledge('NoteTagsPanel.tsx');
    expect(panel).toContain('NoteTagBrowser');
    expect(panel).not.toContain('NoteTagsEditor');
  });

  it('NoteTagBrowser is browse-only — no tag CRUD imports', () => {
    const browser = readKnowledge('NoteTagBrowser.tsx');
    expect(browser).toContain('onOpenProperties');
    expect(browser).toContain('NoteTagVaultBrowse');
    expect(browser).not.toContain('addTag');
    expect(browser).not.toContain('removeTag');
  });

  it('NoteTagsEditor remains CRUD-only for Properties', () => {
    const editor = readKnowledge('NoteTagsEditor.tsx');
    expect(editor).toContain('addTag(note');
    expect(editor).not.toContain('showVaultBrowse');
    expect(editor).not.toContain('knAllTags');
  });

  it('Stats tab removes duplicate tag cloud', () => {
    const body = readFileSync(join(noteviewRoot, 'NoteContextPanelBody.tsx'), 'utf8');
    expect(body).toContain('k90a2StatsTagBrowseHint');
    expect(body).not.toContain('nvTagCloud');
  });

  it('Tags tab wires open Properties for editing', () => {
    const body = readFileSync(join(noteviewRoot, 'NoteContextPanelBody.tsx'), 'utf8');
    expect(body).toMatch(/NoteTagsPanel[\s\S]*onOpenProperties=\{\(\) => openContextPanel\('properties'\)\}/);
    expect(body).not.toMatch(/rightPanel === 'tags'[\s\S]*onUpdateTags/);
  });

  it('Tags tab has browse hint in panel config', () => {
    const config = readFileSync(join(noteviewRoot, 'useNoteViewPanelConfig.tsx'), 'utf8');
    expect(config).toContain('k90a2TagsTabHint');
  });
});
