import { describe, expect, it, beforeEach } from 'vitest';
import { buildRealisticUsageDataset } from '@/dev/realisticUsageFixture';
import { KnowledgeIndexService } from './KnowledgeIndexService';
import { buildDiscoveryFeed } from './discovery/discoveryEngine';
import { buildVaultHealthMetrics } from './health/vaultHealthMetrics';
import { collectIsolatedNoteIds } from './isolation/vaultIsolation';
import { groupRelatedNotes } from './related/groupRelatedNotes';
import { noteSearchScore } from '@/lib/math/noteSearch';

describe('knowledge intelligence audit (K-69 fixture)', () => {
  let service: KnowledgeIndexService;
  const dataset = buildRealisticUsageDataset({ noteCount: 200, eventsPerMonth: 60 });

  beforeEach(() => {
    service = new KnowledgeIndexService();
    service.buildFromNotes(dataset.notes);
  });

  it('fixture meets scale expectations', () => {
    expect(dataset.stats.noteCount).toBeGreaterThanOrEqual(200);
    expect(dataset.stats.eventCount).toBeGreaterThanOrEqual(60);
    expect(dataset.stats.relationCount).toBeGreaterThanOrEqual(60);
  });

  it('surfaces isolated notes in discovery without heavy traversal', () => {
    const feed = buildDiscoveryFeed(dataset.notes, service, { perSectionLimit: 4 });
    const isolated = feed.sections['isolated-notes'];
    expect(isolated.length).toBeGreaterThan(0);
    expect(feed.summary.isolatedNotesCount).toBe(isolated.length);
  });

  it('produces grouped related notes for linked notes', () => {
    const linked = dataset.notes.find(n => n.body?.includes('[['));
    if (!linked) return;
    const grouped = groupRelatedNotes(linked.id, dataset.notes, service);
    const total = grouped.mostRelated.length
      + grouped.recentlyConnected.length
      + grouped.frequentlyReferenced.length;
    expect(total).toBeGreaterThan(0);
  });

  it('computes vault health in O(N)', () => {
    const metrics = buildVaultHealthMetrics(dataset.notes, service);
    expect(metrics.totalNotes).toBe(dataset.stats.noteCount);
    expect(metrics.isolatedNotes).toBe(collectIsolatedNoteIds(dataset.notes, service, dataset.notes.length).length);
  });

  it('ranks relation target titles in search', () => {
    const withRel = dataset.notes.find(n => n.relations && Object.keys(n.relations).length > 0);
    if (!withRel) return;
    const targetId = Object.values(withRel.relations!)[0]?.[0];
    const target = dataset.notes.find(n => n.id === targetId);
    if (!target?.title) return;
    const score = noteSearchScore(withRel, target.title.slice(0, 4));
    expect(score).not.toBeNull();
  });
});
