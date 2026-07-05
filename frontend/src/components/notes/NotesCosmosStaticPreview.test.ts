import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  notesCosmosStaticPreviewFixture,
  type NotesCosmosPreviewFixture,
} from '../../lib/notesCosmosStaticPreviewMockContract';
import { NotesCosmosStaticPreview } from './NotesCosmosStaticPreview';

const componentPath = join(process.cwd(), 'src', 'components', 'notes', 'NotesCosmosStaticPreview.tsx');

function renderFixture(fixture: NotesCosmosPreviewFixture = notesCosmosStaticPreviewFixture): string {
  return renderToStaticMarkup(createElement(NotesCosmosStaticPreview, { fixture }));
}

function renderFixtureInNarrowContainer(
  fixture: NotesCosmosPreviewFixture = notesCosmosStaticPreviewFixture,
): string {
  return renderToStaticMarkup(
    createElement(
      'div',
      {
        style: {
          width: '390px',
          maxWidth: '390px',
          minWidth: 0,
        },
      },
      createElement(NotesCosmosStaticPreview, { fixture }),
    ),
  );
}

function renderedText(fixture: NotesCosmosPreviewFixture = notesCosmosStaticPreviewFixture): string {
  return renderFixture(fixture)
    .replaceAll('&#x27;', "'")
    .replaceAll('&quot;', '"')
    .replaceAll('&amp;', '&');
}

function readComponentSource(): string {
  return readFileSync(componentPath, 'utf8');
}

function cloneFixture(): NotesCosmosPreviewFixture {
  return JSON.parse(JSON.stringify(notesCosmosStaticPreviewFixture)) as NotesCosmosPreviewFixture;
}

describe('NotesCosmosStaticPreview', () => {
  it('renders fixture title and description', () => {
    const html = renderedText();

    expect(html).toContain(notesCosmosStaticPreviewFixture.title);
    expect(html).toContain(notesCosmosStaticPreviewFixture.description);
    expect(html).toContain('data-notes-cosmos-static-preview');
    expect(html).toContain('data-min-mobile-width="390"');
    expect(html).toContain('Read-only signal preview');
    expect(html).toContain('Signal readout');
    expect(html).toContain('Static signal hierarchy readout');
  });

  it('renders all nodes with label, summary, kind, status, tone, cluster, and date text', () => {
    const html = renderedText();

    for (const node of notesCosmosStaticPreviewFixture.nodes) {
      expect(html).toContain(`data-node-id="${node.id}"`);
      expect(html).toContain(`data-node-tone="${node.tone}"`);
      expect(html).toContain(node.label);
      expect(html).toContain(node.summary);
      expect(html).toContain(`Kind: ${node.kind}`);
      expect(html).toContain(`Status: ${node.status}`);
      expect(html).toContain(`Tone: ${node.tone}`);
      expect(html).toContain(node.clusterLabel);
      expect(html).toContain(node.createdAtLabel);
      expect(html).toContain(node.updatedAtLabel);
    }
  });

  it('renders literal primary, secondary, and faint signal hierarchy semantics', () => {
    const html = renderedText();

    expect(html).toContain('Primary signal');
    expect(html).toContain('Secondary signals');
    expect(html).toContain('Faint signals');
    expect(html).toContain("Today's note");
    expect(html).toContain('7 supporting records');
    expect(html).toContain('2 archive traces');
    expect(html).toContain('Signal tier: Primary signal');
    expect(html).toContain('Signal tier: Secondary signal');
    expect(html).toContain('Signal tier: Faint signal');
    expect(html).toContain('Current anchor or active writing focus.');
    expect(html).toContain('Supporting note, reference, or recent context.');
    expect(html).toContain('Older archive trace kept visible without competing.');

    expect(html).toContain('data-node-id="node-today-note"');
    expect(html).toContain('data-signal-tier="primary"');
    expect(html).toContain('data-node-id="node-week-review"');
    expect(html).toContain('data-signal-tier="secondary"');
    expect(html).toContain('data-node-id="node-archive-thread"');
    expect(html).toContain('data-signal-tier="faint"');
  });

  it('renders all relationships with label, source text, target text, kind, and strength', () => {
    const html = renderedText();
    const nodeById = new Map(notesCosmosStaticPreviewFixture.nodes.map(node => [node.id, node]));

    for (const relationship of notesCosmosStaticPreviewFixture.relationships) {
      const source = nodeById.get(relationship.sourceId);
      const target = nodeById.get(relationship.targetId);
      expect(html).toContain(`data-relationship-id="${relationship.id}"`);
      expect(html).toContain(relationship.label);
      expect(html).toContain(`From ${source?.label}`);
      expect(html).toContain(`to ${target?.label}`);
      expect(html).toContain(`Kind: ${relationship.kind}`);
      expect(html).toContain(`Strength: ${relationship.strength}`);
    }
  });

  it('keeps tone literal and does not represent tone by color only', () => {
    const html = renderedText();

    for (const node of notesCosmosStaticPreviewFixture.nodes) {
      expect(html).toContain(`Tone: ${node.tone}`);
    }

    expect(html).toContain('Tone: active');
    expect(html).toContain('Tone: quiet');
    expect(html).toContain('Tone: reference');
    expect(html).toContain('Tone: archival');
  });

  it('uses top-level relationships only and does not require node-level relationship fields', () => {
    const html = renderedText();

    for (const node of notesCosmosStaticPreviewFixture.nodes) {
      expect('relationships' in node).toBe(false);
      expect('relationshipIds' in node).toBe(false);
    }
    expect(html).toContain('Relationships');
    expect(html).not.toContain('relationshipIds');
  });

  it('renders deterministic fallback text/list coverage for every node and relationship', () => {
    const html = renderedText();

    expect(html).toContain('Text fallback');
    expect(html).toContain(notesCosmosStaticPreviewFixture.fallback.title);
    expect(html).toContain(notesCosmosStaticPreviewFixture.fallback.description);
    expect(html).toContain(notesCosmosStaticPreviewFixture.fallback.mobileNote);

    for (const summary of notesCosmosStaticPreviewFixture.fallback.nodeSummaries) {
      expect(html).toContain(summary.label);
      expect(html).toContain(summary.summary);
      expect(html).toContain(summary.dateLabel);
    }

    for (const summary of notesCosmosStaticPreviewFixture.fallback.relationshipSummaries) {
      expect(html).toContain(summary.label);
      expect(html).toContain(`Source: ${summary.sourceId}`);
      expect(html).toContain(`Target: ${summary.targetId}`);
    }
  });

  it('does not mutate the fixture during render', () => {
    const fixture = cloneFixture();
    const before = JSON.stringify(fixture);

    renderFixture(fixture);

    expect(JSON.stringify(fixture)).toBe(before);
  });

  it('keeps coordinate fields and interactive graph/canvas roles out of rendered output', () => {
    const html = renderedText();

    for (const forbidden of [
      '<canvas',
      '<svg',
      'role="application"',
      'role="button"',
      'href=',
      '<button',
      'tabindex=',
      ' x=',
      ' y=',
      'coordinate',
      'savedLayout',
      'layoutState',
    ]) {
      expect(html).not.toContain(forbidden);
    }
  });

  it('represents mobile acceptance and keeps long labels present in the DOM', () => {
    const fixture = cloneFixture();
    fixture.nodes[0] = {
      ...fixture.nodes[0],
      label: 'A deliberately long readable node label that should wrap rather than disappear',
      summary:
        'A deliberately long readable node summary that remains text-first in the static preview skeleton.',
    };
    fixture.fallback.nodeSummaries[0] = {
      ...fixture.fallback.nodeSummaries[0],
      label: fixture.nodes[0].label,
      summary: fixture.nodes[0].summary,
    };

    const html = renderedText(fixture);

    expect(html).toContain('390px minimum');
    expect(html).toContain('no horizontal overflow');
    expect(html).toContain('readable labels');
    expect(html).toContain('no clipped primary content');
    expect(html).toContain('Static signal hierarchy readout');
    expect(html).toContain('Signal tier: Primary signal');
    expect(html).toContain('Signal tier: Secondary signal');
    expect(html).toContain('Signal tier: Faint signal');
    expect(html).toContain(fixture.nodes[0].label);
    expect(html).toContain(fixture.nodes[0].summary);
    expect(html).toContain('break-words');
    expect(html).toContain('min-w-0');
  });

  it('keeps all fixture content present in a 390px narrow-container render', () => {
    const fixture = cloneFixture();
    fixture.nodes[0] = {
      ...fixture.nodes[0],
      label:
        'A very long 390px acceptance node label that remains readable and present without a fixed graph canvas',
      summary:
        'A very long 390px acceptance node summary that remains in the text-first DOM instead of being clipped out of the fixture preview.',
    };
    fixture.relationships[0] = {
      ...fixture.relationships[0],
      label:
        'A very long 390px acceptance relationship label that stays readable in the relationship list',
    };
    fixture.fallback.nodeSummaries[0] = {
      ...fixture.fallback.nodeSummaries[0],
      label: fixture.nodes[0].label,
      summary: fixture.nodes[0].summary,
    };
    fixture.fallback.relationshipSummaries[0] = {
      ...fixture.fallback.relationshipSummaries[0],
      label: fixture.relationships[0].label,
    };

    const html = renderFixtureInNarrowContainer(fixture)
      .replaceAll('&#x27;', "'")
      .replaceAll('&quot;', '"')
      .replaceAll('&amp;', '&');

    expect(html).toContain('width:390px');
    expect(html).toContain('data-min-mobile-width="390"');
    expect(html).toContain('max-w-full');
    expect(html).toContain('min-w-0');
    expect(html).toContain('break-words');
    expect(html).toContain('Static signal hierarchy readout');
    expect(html).toContain('Signal tier: Primary signal');
    expect(html).toContain('Signal tier: Secondary signal');
    expect(html).toContain('Signal tier: Faint signal');
    expect(html).not.toContain('<canvas');
    expect(html).not.toContain('<svg');

    for (const node of fixture.nodes) {
      expect(html).toContain(`data-node-id="${node.id}"`);
      expect(html).toContain(node.label);
      expect(html).toContain(`Tone: ${node.tone}`);
    }

    for (const relationship of fixture.relationships) {
      expect(html).toContain(`data-relationship-id="${relationship.id}"`);
      expect(html).toContain(relationship.label);
    }
  });

  it('keeps semantic list structure and avoids interactive graph affordances', () => {
    const html = renderedText();

    expect(html).toContain('<article');
    expect(html).toContain('<section');
    expect(html).toContain('<h2');
    expect(html).toContain('<h3');
    expect(html).toContain('<ol');
    expect(html).toContain('<li');
    expect(html).not.toContain('role="application"');
    expect(html).not.toContain('role="button"');
    expect(html).not.toContain('<button');
    expect(html).not.toContain('href=');
  });

  it('does not import forbidden runtime services or generated assets', () => {
    const source = readComponentSource();

    for (const forbiddenImport of [
      /from ['"].*NoteGraphView/,
      /from ['"].*NoteGraphViewLazy/,
      /from ['"].*LocalGraphView/,
      /from ['"].*KnowledgeIndexService/,
      /from ['"].*buildGlobalGraphData/,
      /from ['"].*buildExpandedGraphData/,
      /from ['"].*useNotesStore/,
      /from ['"].*store/,
      /from ['"].*provider/i,
      /from ['"].*persistence/i,
      /from ['"].*supabase/i,
      /from ['"].*google/i,
      /from ['"].*attac.*hment/i,
      /from ['"].*\.png/,
      /from ['"].*\.jpg/,
      /from ['"].*\.webp/,
      /from ['"].*\.woff/,
      /from ['"].*\.ttf/,
    ]) {
      expect(source).not.toMatch(forbiddenImport);
    }
  });
});
