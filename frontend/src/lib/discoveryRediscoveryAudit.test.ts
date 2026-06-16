/**
 * K-89D — Knowledge rediscovery audit harness (opt-in benchmark).
 * CI: skipped by default.
 * Manual: npm run audit:discovery
 * Direct: RUN_VAULT_AUDIT=1 npm test -- discoveryRediscoveryAudit
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  DISCOVERY_AUDIT_SCALES,
  measureDiscoveryAtScale,
  relatedNotesOverlapWithFeed,
  type DiscoveryScaleAuditRow,
} from '@/dev/discoveryCollectorBenchmark';
import { measureVaultAtScale, type LargeVaultMetricsRow } from '@/dev/largeVaultBenchmark';
import { buildLargeVaultDataset } from '@/dev/realisticUsageFixture';
import { KnowledgeIndexService } from '@/components/views/features/knowledge/KnowledgeIndexService';
import { buildDiscoveryFeed } from '@/components/views/features/knowledge/discovery/discoveryEngine';
import { shouldRunVaultAudit } from './vaultAuditGate';

interface ObservedMetricsRow {
  notes: number;
  vaultKb: number;
  indexMs: number;
  searchMs: number;
  relatedMs: number;
  discoverMs: number;
  cosmosMs: number;
  healthMs: number;
  sidebarMs: number;
  plainFilterMs: number;
  discovery?: {
    totalFeedMs: number;
    galaxyMapMs: number;
    groupRelatedMs: number;
    feedItems: number;
    rawCandidates: number;
    actionableCount: number;
    collectorsMs: Record<string, number>;
    collectorCandidates: Record<string, number>;
    overlap: { pair: string; sharedNoteIds: number; overlapPct: number }[];
  };
}

const auditRows: DiscoveryScaleAuditRow[] = [];
const vaultRows: LargeVaultMetricsRow[] = [];

function buildMetricsPayload(): ObservedMetricsRow[] {
  return DISCOVERY_AUDIT_SCALES.map(scale => {
    const vault = vaultRows.find(r => r.noteCount === scale);
    const discovery = auditRows.find(r => r.noteCount === scale);
    const collectorsMs: Record<string, number> = {};
    const collectorCandidates: Record<string, number> = {};
    if (discovery) {
      for (const c of discovery.collectors) {
        collectorsMs[c.collector] = Math.round(c.ms);
        collectorCandidates[c.collector] = c.rawCandidates;
      }
    }
    return {
      notes: scale,
      vaultKb: Math.round((vault?.estimatedBytes ?? 0) / 1024),
      indexMs: Math.round(vault?.indexBuildMs ?? 0),
      searchMs: Math.round(vault?.workspaceSearchMs ?? 0),
      relatedMs: Math.round(vault?.relatedNotesMs ?? 0),
      discoverMs: Math.round(vault?.discoveryFeedMs ?? 0),
      cosmosMs: Math.round(vault?.globalGraphMs ?? 0),
      healthMs: Math.round(vault?.vaultHealthMs ?? 0),
      sidebarMs: Math.round(vault?.sidebarSortMs ?? 0),
      plainFilterMs: Math.round(vault?.plainTextFilterMs ?? 0),
      discovery: discovery
        ? {
            totalFeedMs: Math.round(discovery.totalFeedMs),
            galaxyMapMs: Math.round(discovery.galaxyMapMs),
            groupRelatedMs: Math.round(discovery.groupRelatedNotesMs),
            feedItems: discovery.feedItems,
            rawCandidates: discovery.rawCandidatesBeforeRefine,
            actionableCount: discovery.qualityActionableCount,
            collectorsMs,
            collectorCandidates,
            overlap: discovery.overlap,
          }
        : undefined,
    };
  });
}

describe.skipIf(!shouldRunVaultAudit())('K-89D discovery rediscovery audit', () => {
  beforeAll(() => {
    auditRows.length = 0;
    vaultRows.length = 0;
    for (const scale of DISCOVERY_AUDIT_SCALES) {
      auditRows.push(measureDiscoveryAtScale(scale));
      vaultRows.push(measureVaultAtScale(scale));
    }
  }, 300_000);

  for (const scale of DISCOVERY_AUDIT_SCALES) {
    it(`profiles discovery collectors at ${scale} notes`, () => {
      const row = auditRows.find(r => r.noteCount === scale);
      expect(row).toBeDefined();
      expect(row!.totalFeedMs).toBeGreaterThan(0);

      const missingConn = row!.collectors.find(c => c.collector === 'missing-connection');
      const drift = row!.collectors.find(c => c.collector === 'knowledge-drift');
      expect(missingConn).toBeDefined();
      expect(drift).toBeDefined();
    });
  }

  it('documents top collector costs at 3000 notes', () => {
    const row = auditRows.find(r => r.noteCount === 3000);
    expect(row).toBeDefined();

    const ranked = [...row!.collectors]
      .filter(c => !['galaxyMap', 'historyBoost', 'groupRelatedNotes'].includes(c.collector))
      .sort((a, b) => b.ms - a.ms);

    // eslint-disable-next-line no-console
    console.log('K89D_TOP_COLLECTORS_3000', JSON.stringify(ranked.slice(0, 10)));
    expect(ranked[0]!.ms).toBeGreaterThan(0);
  });

  it('measures related-notes vs feed overlap at 1000 notes', () => {
    const now = Date.parse('2026-06-16T12:00:00Z');
    const dataset = buildLargeVaultDataset({ noteCount: 1000 });
    const notes = dataset.notes.map((note, i) => {
      if (note.deletedAt) return note;
      const dayOffset = (i % 150) + 1;
      return {
        ...note,
        updatedAt: now - dayOffset * 86_400_000,
        lastOpenedAt: i % 8 === 0 ? now - (dayOffset + 20) * 86_400_000 : note.lastOpenedAt,
      };
    });
    const service = new KnowledgeIndexService();
    service.buildFromNotes(notes);
    const feed = buildDiscoveryFeed(notes, service, { now, perSectionLimit: 4 });
    const overlap = relatedNotesOverlapWithFeed(notes, service, feed.items, 20);
    expect(overlap.samples).toBeGreaterThan(0);
    expect(feed.items.length).toBeGreaterThan(0);
    // eslint-disable-next-line no-console
    console.log('K89D_RELATED_FEED_OVERLAP_1000', JSON.stringify(overlap));
  }, 60_000);

  it('writes collector-level metrics to k89-observed-metrics.json', () => {
    const payload = buildMetricsPayload();
    const outPath = join(process.cwd(), 'docs', 'k89-observed-metrics.json');

    let existing: unknown = null;
    try {
      existing = JSON.parse(readFileSync(outPath, 'utf8'));
    } catch {
      existing = null;
    }

    const merged = {
      generatedAt: new Date().toISOString().slice(0, 10),
      k89d: 'discovery-collector-audit',
      scales: payload,
      ...(Array.isArray(existing) ? { legacyVaultOnly: existing } : {}),
    };

    // eslint-disable-next-line no-console
    console.log('K89D_METRICS_JSON', JSON.stringify(payload.map(p => ({
      notes: p.notes,
      discoverMs: p.discoverMs,
      discovery: p.discovery,
    }))));
    writeFileSync(outPath, `${JSON.stringify(merged, null, 2)}\n`);

    expect(payload.length).toBe(DISCOVERY_AUDIT_SCALES.length);
    expect(payload.every(p => p.discovery != null)).toBe(true);
  });
});
