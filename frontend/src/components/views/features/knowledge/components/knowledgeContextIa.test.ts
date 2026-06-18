import { describe, expect, it } from 'vitest';
import { KNOWLEDGE_CONTEXT_PRIMARY_TABS } from './KnowledgeContextPanel';
import type { KnowledgeContextTab } from './KnowledgeContextPanel';
import {
  isDiscoverContextTabActive,
  isInsightsContextTabActive,
  resolveDashboardLoadScope,
} from '../../../noteview/contextPanelTabGate';

/** Mirrors `useNoteViewPanelConfig` tab key order (K-89B1). */
const CONTEXT_TAB_KEYS: readonly KnowledgeContextTab[] = [
  'toc', 'links', 'graph', 'discover', 'properties',
  'insights', 'actions', 'timeline', 'tags', 'relations', 'stats',
];

function splitContextTabs(keys: readonly KnowledgeContextTab[]) {
  const primary = keys.filter(k => KNOWLEDGE_CONTEXT_PRIMARY_TABS.includes(k));
  const more = keys.filter(k => !KNOWLEDGE_CONTEXT_PRIMARY_TABS.includes(k));
  return { primary, more };
}

describe('K-104 knowledge context IA', () => {
  it('promotes Discover and Insights to primary navigation', () => {
    expect(KNOWLEDGE_CONTEXT_PRIMARY_TABS).toEqual([
      'discover', 'toc', 'links', 'insights',
    ]);
    expect(KNOWLEDGE_CONTEXT_PRIMARY_TABS).toContain('discover');
    expect(KNOWLEDGE_CONTEXT_PRIMARY_TABS).toContain('insights');
    expect(KNOWLEDGE_CONTEXT_PRIMARY_TABS).not.toContain('graph');
    expect(KNOWLEDGE_CONTEXT_PRIMARY_TABS).not.toContain('properties');
  });

  it('keeps four primary tabs without increasing tab count', () => {
    expect(KNOWLEDGE_CONTEXT_PRIMARY_TABS).toHaveLength(4);
    expect(CONTEXT_TAB_KEYS).toHaveLength(11);
  });

  it('places Cosmos and Properties in More (K-104)', () => {
    const { primary, more } = splitContextTabs(CONTEXT_TAB_KEYS);
    expect(primary).toEqual(['toc', 'links', 'discover', 'insights']);
    expect(more).toContain('graph');
    expect(more).toContain('properties');
    expect(more).toContain('actions');
    expect(more).toContain('timeline');
    expect(more).not.toContain('discover');
  });

  it('activates discovery feed scope when Discover tab is open', () => {
    expect(isDiscoverContextTabActive(true, 'discover')).toBe(true);
    expect(isInsightsContextTabActive(true, 'discover')).toBe(false);
    const scope = resolveDashboardLoadScope({
      isDashboardMode: false,
      showRightPanel: true,
      rightPanel: 'discover',
      viewMode: 'edit',
    });
    expect(scope.discover).toBe(true);
  });

  it('still gates insights data to the Insights tab', () => {
    expect(isInsightsContextTabActive(true, 'insights')).toBe(true);
    expect(isInsightsContextTabActive(true, 'discover')).toBe(false);
    const scope = resolveDashboardLoadScope({
      isDashboardMode: false,
      showRightPanel: true,
      rightPanel: 'insights',
      viewMode: 'edit',
    });
    expect(scope.discover).toBe(false);
  });
});
