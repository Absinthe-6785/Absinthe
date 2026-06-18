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

describe('K-91 knowledge workflow validation', () => {
  it('places Discover and Insights on primary tab strip (K-104)', () => {
    expect(KNOWLEDGE_CONTEXT_PRIMARY_TABS).toContain('discover');
    expect(KNOWLEDGE_CONTEXT_PRIMARY_TABS).toContain('insights');
    expect(KNOWLEDGE_CONTEXT_PRIMARY_TABS).not.toContain('properties');
  });

  it('keeps Relations in More menu — workflow friction documented (K-91)', () => {
    expect(KNOWLEDGE_CONTEXT_PRIMARY_TABS).not.toContain('relations');
    const config = readFileSync(join(noteviewRoot, 'useNoteViewPanelConfig.tsx'), 'utf8');
    expect(config).toContain('k90a3RelationsTabHint');
  });

  it('wires sidebar plain-text filter to visibleNotes (K-89 gap closed)', () => {
    const noteView = readFileSync(join(noteviewRoot, '../NoteView.tsx'), 'utf8');
    expect(noteView).toContain('filterNotesForSidebarList');
    expect(noteView).toContain('sidebarSearchQuery');
  });

  it('canonical tag edit in Properties; Tags tab browse-only (K-90A1/A2)', () => {
    const propsPanel = readKnowledge('components/NotePropertiesPanel.tsx');
    expect(propsPanel).toContain('NoteTagsEditor');
    const tagsPanel = readKnowledge('components/NoteTagsPanel.tsx');
    expect(tagsPanel).toContain('NoteTagBrowser');
  });

  it('exposes Worth Revisiting in Links related notes grouping', () => {
    const related = readKnowledge('related/groupRelatedNotes.ts');
    expect(related).toContain('worthRevisiting');
    const panel = readKnowledge('components/RelatedNotesPanel.tsx');
    expect(panel).toContain('worthRevisiting');
  });

  it('documents K-91 validation report', () => {
    const doc = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '../../../../../../docs/K-91-knowledge-workflow-validation.md'),
      'utf8',
    );
    expect(doc).toContain('K-91');
    expect(doc).toContain('Follow-Up Branches');
  });
});
