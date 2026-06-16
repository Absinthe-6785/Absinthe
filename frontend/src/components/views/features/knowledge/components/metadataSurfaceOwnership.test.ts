import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { KNOWLEDGE_CONTEXT_PRIMARY_TABS } from './KnowledgeContextPanel';

const knowledgeRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const noteviewRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../noteview');

function readKnowledge(relativePath: string) {
  return readFileSync(join(knowledgeRoot, relativePath), 'utf8');
}

describe('K-90A metadata surface ownership', () => {
  it('places Properties on the primary tab strip', () => {
    expect(KNOWLEDGE_CONTEXT_PRIMARY_TABS).toContain('properties');
    expect(KNOWLEDGE_CONTEXT_PRIMARY_TABS).not.toContain('tags');
  });

  it('excludes tags from user-editable properties list', () => {
    const source = readKnowledge('properties/noteProperties.ts');
    expect(source).toMatch(/excludes reserved keys like tags/);
    expect(source).toContain('isTagsPropertyKey');
  });

  it('Tags tab is browse-only via NoteTagBrowser (K-90A2)', () => {
    const tagsPanel = readKnowledge('components/NoteTagsPanel.tsx');
    expect(tagsPanel).toContain('NoteTagBrowser');
    expect(tagsPanel).not.toContain('NoteTagsEditor');
    const propsPanel = readKnowledge('components/NotePropertiesPanel.tsx');
    expect(propsPanel).toContain('NoteTagsEditor');
  });

  it('keeps Tags tab as legacy path in More menu', () => {
    const config = readFileSync(join(noteviewRoot, 'useNoteViewPanelConfig.tsx'), 'utf8');
    expect(config).toContain("'tags'");
    expect(config).toContain("'relations'");
    expect(KNOWLEDGE_CONTEXT_PRIMARY_TABS).not.toContain('tags');
    expect(KNOWLEDGE_CONTEXT_PRIMARY_TABS).not.toContain('relations');
  });

  it('documents relations boundary — separate from listUserProperties', () => {
    const propsPanel = readKnowledge('components/NotePropertiesPanel.tsx');
    expect(propsPanel).toContain('listUserProperties');
    expect(propsPanel).not.toContain('NoteRelationsPanel');
    const relationsPanel = readKnowledge('components/NoteRelationsPanel.tsx');
    expect(relationsPanel).toContain('knOutgoingRelations');
  });

  it('keeps Stats as read-only metrics in NoteContextPanelBody', () => {
    const body = readFileSync(join(noteviewRoot, 'NoteContextPanelBody.tsx'), 'utf8');
    expect(body).toContain("rightPanel === 'stats'");
    expect(body).toContain('nvNoteStats');
    const statsStart = body.indexOf("rightPanel === 'stats'");
    const statsBlock = body.slice(statsStart);
    expect(statsBlock).not.toContain('addTag');
    expect(statsBlock).not.toContain('removeTag');
  });
});
