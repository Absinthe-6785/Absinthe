/**
 * K-95A — Discovery feed context sharing audit (test/dev only).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildLargeVaultDataset } from '@/dev/realisticUsageFixture';
import type { NoteBase } from '@/components/views/noteUtils';
import { KnowledgeIndexService } from '@/components/views/features/knowledge/KnowledgeIndexService';
import {
  buildDiscoveryFeed,
  buildDiscoveryRefreshBundle,
} from '@/components/views/features/knowledge/discovery';
import { buildCosmosVaultAnalysis } from '@/components/views/features/knowledge/cosmos/intelligence/cosmosAnalysis';

export const K95A_NOTE_COUNTS = [100, 300, 1000] as const;
export type K95aNoteCount = (typeof K95A_NOTE_COUNTS)[number];

export interface K95aLegacyRefreshCounts {
  galaxyMapBuilds: number;
  contextCreates: number;
}

export interface K95aSharedRefreshCounts {
  galaxyMapBuilds: number;
  contextCreates: number;
}

export interface K95aRefreshAttribution {
  noteCount: number;
  legacy: K95aLegacyRefreshCounts;
  shared: K95aSharedRefreshCounts;
  galaxyMapReductionPct: number;
  contextReductionPct: number;
}

export interface K95aCandidateRow {
  noteCount: number;
  connectionSignalCount: number;
  connectionSignalBytes: number;
  relationshipForgottenCount: number;
  relationshipDriftCount: number;
  candidatePoolGalaxyBuckets: number;
  candidatePoolTokenBuckets: number;
  feedItemCount: number;
  feedBytes: number;
  vaultAnalysisBytes: number;
}

export interface K95aAllocationEstimate {
  noteCount: number;
  legacyTransientBytes: number;
  sharedTransientBytes: number;
  reductionPct: number;
}

const LEGACY_GALAXY_MAP_BUILDS = 2;
const LEGACY_CONTEXT_CREATES = 2;
const SHARED_GALAXY_MAP_BUILDS = 1;
const SHARED_CONTEXT_CREATES = 1;

function viewsRoot(): string {
  return dirname(fileURLToPath(import.meta.url));
}

function featuresRoot(): string {
  return join(viewsRoot(), 'features', 'knowledge');
}

function jsonBytes(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

function pctReduction(before: number, after: number): number {
  if (before <= 0) return 0;
  return Math.round(((before - after) / before) * 1000) / 10;
}

function buildFixture(noteCount: number): { notes: NoteBase[]; service: KnowledgeIndexService } {
  const dataset = buildLargeVaultDataset({ noteCount });
  const service = new KnowledgeIndexService();
  service.buildFromNotes(dataset.notes);
  return { notes: dataset.notes, service };
}

export function readK95aPolicySnapshot(): {
  refreshBundleExported: boolean;
  contextCachesConnectionSignals: boolean;
  contextCachesRelationshipSignals: boolean;
  cosmosAnalysisAcceptsContext: boolean;
  noteGraphUsesRefreshBundle: boolean;
} {
  const engineSrc = readFileSync(join(featuresRoot(), 'discovery', 'discoveryEngine.ts'), 'utf8');
  const ctxSrc = readFileSync(join(featuresRoot(), 'discovery', 'discoveryFeedContext.ts'), 'utf8');
  const cosmosSrc = readFileSync(join(featuresRoot(), 'cosmos', 'intelligence', 'cosmosAnalysis.ts'), 'utf8');
  const graphSrc = readFileSync(join(viewsRoot(), 'NoteGraphView.tsx'), 'utf8');

  return {
    refreshBundleExported: engineSrc.includes('buildDiscoveryRefreshBundle'),
    contextCachesConnectionSignals: ctxSrc.includes('connectionSignals'),
    contextCachesRelationshipSignals: ctxSrc.includes('relationshipSignals'),
    cosmosAnalysisAcceptsContext: cosmosSrc.includes('ctx?: DiscoveryFeedContext'),
    noteGraphUsesRefreshBundle: graphSrc.includes('buildDiscoveryRefreshBundle'),
  };
}

/** Legacy refresh: separate feed + vault analysis (pre-K-95A Cosmos HUD path). */
export function runLegacyDiscoveryRefresh(
  notes: readonly NoteBase[],
  service: KnowledgeIndexService,
  galaxyCacheKey = 'k95a-audit',
): { feedBytes: number; analysisBytes: number } {
  const feed = buildDiscoveryFeed(notes, service, { perSectionLimit: 4, galaxyCacheKey });
  const analysis = buildCosmosVaultAnalysis(notes, service);
  return { feedBytes: jsonBytes(feed), analysisBytes: jsonBytes(analysis) };
}

export function estimateLegacyRefreshCounts(): K95aLegacyRefreshCounts {
  return {
    galaxyMapBuilds: LEGACY_GALAXY_MAP_BUILDS,
    contextCreates: LEGACY_CONTEXT_CREATES,
  };
}

export function estimateSharedRefreshCounts(): K95aSharedRefreshCounts {
  return {
    galaxyMapBuilds: SHARED_GALAXY_MAP_BUILDS,
    contextCreates: SHARED_CONTEXT_CREATES,
  };
}

export function measureK95aRefreshAttribution(noteCount: K95aNoteCount): K95aRefreshAttribution {
  const legacy = estimateLegacyRefreshCounts();
  const shared = estimateSharedRefreshCounts();
  return {
    noteCount,
    legacy,
    shared,
    galaxyMapReductionPct: pctReduction(legacy.galaxyMapBuilds, shared.galaxyMapBuilds),
    contextReductionPct: pctReduction(legacy.contextCreates, shared.contextCreates),
  };
}

export function runK95aCandidateRow(noteCount: K95aNoteCount): K95aCandidateRow {
  const { notes, service } = buildFixture(noteCount);
  const bundle = buildDiscoveryRefreshBundle(notes, service, {
    perSectionLimit: 4,
    galaxyCacheKey: 'k95a-candidates',
  });
  const pool = bundle.context.candidatePool ?? bundle.context.connectionIndex;

  return {
    noteCount,
    connectionSignalCount: bundle.context.connectionSignals?.length ?? 0,
    connectionSignalBytes: jsonBytes(bundle.context.connectionSignals ?? []),
    relationshipForgottenCount: bundle.context.relationshipSignals?.forgotten.length ?? 0,
    relationshipDriftCount: bundle.context.relationshipSignals?.drift.length ?? 0,
    candidatePoolGalaxyBuckets: pool?.galaxyMembers.size ?? 0,
    candidatePoolTokenBuckets: pool?.titleTokens.size ?? 0,
    feedItemCount: bundle.feed.items.length,
    feedBytes: jsonBytes(bundle.feed),
    vaultAnalysisBytes: jsonBytes(bundle.vaultAnalysis),
  };
}

export function estimateK95aAllocation(noteCount: K95aNoteCount): K95aAllocationEstimate {
  const { notes, service } = buildFixture(noteCount);
  const legacy = runLegacyDiscoveryRefresh(notes, service, 'k95a-alloc');
  const shared = buildDiscoveryRefreshBundle(notes, service, {
    perSectionLimit: 4,
    galaxyCacheKey: 'k95a-alloc',
  });

  const legacyBytes = legacy.feedBytes + legacy.analysisBytes;
  const sharedBytes = jsonBytes(shared.feed) + jsonBytes(shared.vaultAnalysis);

  return {
    noteCount,
    legacyTransientBytes: legacyBytes,
    sharedTransientBytes: sharedBytes,
    reductionPct: pctReduction(legacyBytes, sharedBytes),
  };
}

export function feedsAreEquivalent(
  notes: readonly NoteBase[],
  service: KnowledgeIndexService,
): boolean {
  const standalone = buildDiscoveryFeed(notes, service, { perSectionLimit: 4, galaxyCacheKey: 'k95a-equiv' });
  const bundle = buildDiscoveryRefreshBundle(notes, service, { perSectionLimit: 4, galaxyCacheKey: 'k95a-equiv' });
  return JSON.stringify(standalone) === JSON.stringify(bundle.feed);
}

export function vaultAnalysisIsEquivalent(
  notes: readonly NoteBase[],
  service: KnowledgeIndexService,
): boolean {
  const standalone = buildCosmosVaultAnalysis(notes, service);
  const shared = buildDiscoveryRefreshBundle(notes, service, { galaxyCacheKey: 'k95a-equiv-analysis' });
  return JSON.stringify(standalone) === JSON.stringify(shared.vaultAnalysis);
}
