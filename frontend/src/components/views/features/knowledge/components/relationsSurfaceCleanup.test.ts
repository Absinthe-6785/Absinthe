import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const knowledgeComponents = dirname(fileURLToPath(import.meta.url));
const noteviewRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../noteview');

function readKnowledge(relativePath: string) {
  return readFileSync(join(knowledgeComponents, relativePath), 'utf8');
}

describe('K-90A3 relations surface cleanup', () => {
  it('ConceptRelationsPanel delegates to browse-only ConceptRelationsBrowse', () => {
    const panel = readKnowledge('ConceptRelationsPanel.tsx');
    expect(panel).toContain('ConceptRelationsBrowse');
    expect(panel).not.toContain('addRelationTarget');
    expect(panel).not.toContain('removeRelationTarget');
  });

  it('ConceptRelationsBrowse is browse-only — no relation CRUD', () => {
    const browse = readKnowledge('ConceptRelationsBrowse.tsx');
    expect(browse).toContain('onOpenRelations');
    expect(browse).not.toContain('addRelationTarget');
    expect(browse).not.toContain('removeRelationTarget');
    expect(browse).not.toContain('onUpdateRelations');
  });

  it('NoteRelationsPanel remains canonical relation CRUD editor', () => {
    const relations = readKnowledge('NoteRelationsPanel.tsx');
    expect(relations).toContain('addRelationTarget');
    expect(relations).toContain('removeRelationTarget');
    expect(relations).toContain('k90a3RelationsPanelHint');
  });

  it('Links tab wires open Relations for concept relation editing', () => {
    const body = readFileSync(join(noteviewRoot, 'NoteContextPanelBody.tsx'), 'utf8');
    const start = body.indexOf('<ConceptRelationsPanel');
    const end = body.indexOf('<LearningPathPanel', start);
    const block = body.slice(start, end > start ? end : start + 400);
    expect(block).toContain("onOpenRelations={() => openContextPanel('relations')}");
    expect(block).not.toContain('onUpdateRelations');
  });

  it('Reading source panel keeps workflow-specific linking', () => {
    const panel = readKnowledge('ReadingSourceLinkPanel.tsx');
    expect(panel).toContain('onLinkSource');
    expect(panel).toContain('k90a3ReadingSourceHint');
  });

  it('Related notes clarifies computed vs structured relations', () => {
    const panel = readKnowledge('RelatedNotesPanel.tsx');
    expect(panel).toContain('k90a3RelatedNotesHint');
  });

  it('Relations tab has ownership hint in panel config', () => {
    const config = readFileSync(join(noteviewRoot, 'useNoteViewPanelConfig.tsx'), 'utf8');
    expect(config).toContain('k90a3RelationsTabHint');
  });
});
