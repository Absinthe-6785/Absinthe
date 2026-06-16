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

describe('K-89B1 knowledge context IA', () => {
  it('promotes Discover to primary navigation', () => {
    expect(KNOWLEDGE_CONTEXT_PRIMARY_TABS).toEqual([
      'toc', 'links', 'graph', 'discover', 'properties',
    ]);
    expect(KNOWLEDGE_CONTEXT_PRIMARY_TABS).toContain('discover');
    expect(KNOWLEDGE_CONTEXT_PRIMARY_TABS).not.toContain('insights');
  });

  it('keeps five primary tabs without increasing tab count', () => {
    expect(KNOWLEDGE_CONTEXT_PRIMARY_TABS).toHaveLength(5);
    expect(CONTEXT_TAB_KEYS).toHaveLength(11);
  });

  it('places Insights in More and Discover on the primary strip', () => {
    const { primary, more } = splitContextTabs(CONTEXT_TAB_KEYS);
    expect(primary).toEqual(['toc', 'links', 'graph', 'discover', 'properties']);
    expect(more[0]).toBe('insights');
    expect(more).toContain('actions');
    expect(more).toContain('relations');
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
