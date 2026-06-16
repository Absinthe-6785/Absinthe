import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { KNOWLEDGE_CONTEXT_PRIMARY_TABS } from './KnowledgeContextPanel';

const knowledgeRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const noteviewRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../noteview');
const viewsRoot = join(dirname(fileURLToPath(import.meta.url)), '../../..');

function readKnowledge(relativePath: string) {
  return readFileSync(join(knowledgeRoot, relativePath), 'utf8');
}

describe('K-89B2B discovery presentation consolidation', () => {
  it('routes Insights connection suggestions to Discover instead of duplicating cards', () => {
    const source = readKnowledge('components/CosmosInsightsPanel.tsx');
    expect(source).toContain('onOpenDiscover');
    expect(source).toContain('k89b2InsightsDiscoverHint');
    expect(source).not.toContain('WhyThisRecommendation');
    expect(source).not.toContain('suggestedConnections.map');
  });

  it('routes Actions connection recommendations to Discover instead of ConnectionRecommendationList', () => {
    const source = readKnowledge('cosmos/actions/CosmosActionsPanel.tsx');
    expect(source).toContain('k89b2ActionsDiscoverHint');
    expect(source).not.toContain('ConnectionRecommendationList');
  });

  it('wires onOpenDiscover into Insights from NoteContextPanelBody', () => {
    const source = readFileSync(join(noteviewRoot, 'NoteContextPanelBody.tsx'), 'utf8');
    expect(source).toMatch(/CosmosInsightsPanel[\s\S]*onOpenDiscover=\{handleOpenDiscover\}/);
  });

  it('reuses shared discoveryFeed in Cosmos HUD instead of always rebuilding', () => {
    const graphSource = readFileSync(join(viewsRoot, 'NoteGraphView.tsx'), 'utf8');
    const editorSource = readFileSync(join(noteviewRoot, 'NoteViewEditorArea.tsx'), 'utf8');
    expect(graphSource).toContain('sharedDiscoveryFeed');
    expect(graphSource).toContain('sharedDiscoveryFeed === undefined');
    expect(editorSource).toContain('sharedDiscoveryFeed={discoveryFeed}');
  });

  it('clarifies dashboard card as Discover entry pointer', () => {
    const source = readKnowledge('components/DiscoveryDashboardCard.tsx');
    expect(source).toContain('k89b2DashboardDiscoverHint');
  });

  it('expands Worth Revisiting when Most Related has fewer than three items', () => {
    const source = readKnowledge('components/RelatedNotesPanel.tsx');
    expect(source).toContain('grouped.mostRelated.length >= 3');
    expect(source).not.toContain('grouped.mostRelated.length > 0');
  });

  it('keeps Discover as the canonical primary tab for vault rediscovery', () => {
    expect(KNOWLEDGE_CONTEXT_PRIMARY_TABS).toContain('discover');
  });
});
