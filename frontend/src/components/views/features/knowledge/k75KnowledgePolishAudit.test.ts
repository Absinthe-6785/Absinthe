import { describe, expect, it, beforeEach } from 'vitest';
import { buildRealisticUsageDataset } from '@/dev/realisticUsageFixture';
import { KnowledgeIndexService } from './KnowledgeIndexService';
import { buildDiscoveryFeed } from './discovery/discoveryEngine';
import { buildVaultHealthMetrics } from './health/vaultHealthMetrics';
import { groupRelatedNotes } from './related/groupRelatedNotes';
import { buildWorkspaceSearch } from './workspace/buildWorkspaceSearch';

describe('K-75 knowledge polish audit', () => {
  let service: KnowledgeIndexService;
  const dataset = buildRealisticUsageDataset({ noteCount: 200, eventsPerMonth: 60 });

  beforeEach(() => {
    service = new KnowledgeIndexService();
    service.buildFromNotes(dataset.notes);
  });

  it('discovery feed excludes low-value area/topic sections', () => {
    const feed = buildDiscoveryFeed(dataset.notes, service, { perSectionLimit: 3 });
    expect(feed.sections['recently-active-area']).toHaveLength(0);
    expect(feed.sections['emerging-topic']).toHaveLength(0);
    expect(feed.summary.totalCount).toBeGreaterThan(0);
  });

  it('related notes use two non-overlapping sections', () => {
    const linked = dataset.notes.find(n => n.body?.includes('[['));
    if (!linked) return;
    const grouped = groupRelatedNotes(linked.id, dataset.notes, service);
    const ids = new Set([
      ...grouped.mostRelated.map(r => r.noteId),
      ...grouped.worthRevisiting.map(r => r.noteId),
    ]);
    expect(ids.size).toBe(grouped.mostRelated.length + grouped.worthRevisiting.length);
  });

  it('vault health exposes connected percent', () => {
    const metrics = buildVaultHealthMetrics(dataset.notes, service);
    expect(metrics.connectedPercent).toBeGreaterThanOrEqual(0);
    expect(metrics.connectedPercent).toBeLessThanOrEqual(100);
  });

  it('search enrichment stays within timing budget on realistic vault', () => {
    const start = performance.now();
    const groups = buildWorkspaceSearch('Note', dataset.notes, [], { service });
    const elapsed = performance.now() - start;
    expect(groups.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(500);
  });
});
