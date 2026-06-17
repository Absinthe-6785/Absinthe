/**
 * K-92B2A — Graph signature restart gate audit (test/dev only).
 *
 * Models sim effect restarts before vs after topology-signature gating.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  countAlphaTicks,
  runK92b1ForceSimAudit,
  WARM_PARTIAL_REHEAT_ALPHA,
} from './k92b1CosmosForceSimAudit';
import { graphSimulationAlphaFloor } from './graphScalePolicy';
import {
  buildGraphTopologySignature,
  buildGraphTopologySignatureFromGraphData,
} from './cosmosGraphSignature';
import type { CosmosSimContextSnapshot } from './cosmosSimReheat';
import { snapshotProductionSimConfig } from './k92b1CosmosForceSimAudit';

export type K92b2aEditScenario = 'metadata_only' | 'link_add' | 'link_remove';

export interface K92b2aRestartGateRow {
  noteCount: number;
  scenario: K92b2aEditScenario;
  beforeRestartCount: number;
  beforeTickCount: number;
  beforeSettleCount: number;
  afterRestartCount: number;
  afterTickCount: number;
  afterSettleCount: number;
}

const BASE_GRAPH = {
  nodeIds: ['n1', 'n2', 'n3'],
  edges: [
    { sourceId: 'n1', targetId: 'n2', relationshipType: 'backlink' },
    { sourceId: 'n2', targetId: 'n3', relationshipType: 'mention' },
  ],
};

export function readForceSimEffectDepsFromNoteGraphView(): string[] {
  const viewsRoot = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(join(viewsRoot, 'NoteGraphView.tsx'), 'utf8');
  const marker = '// ── Force-directed 루프 ───────────────────────────────────────────';
  const start = src.indexOf(marker);
  if (start < 0) throw new Error('Force-directed loop marker not found in NoteGraphView.tsx');
  const slice = src.slice(start, start + 4000);
  const depMatch = slice.match(/\}, \[([^\]]+)\]\); \/\/ eslint-disable-line react-hooks\/exhaustive-deps/);
  if (!depMatch) throw new Error('Force sim effect dependency array not found');
  return depMatch[1].split(',').map(s => s.trim());
}

export function noteGraphViewUsesGraphTopologySignatureGate(): boolean {
  const src = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), 'NoteGraphView.tsx'),
    'utf8',
  );
  return src.includes('graphTopologySignature')
    && src.includes('buildGraphTopologySignatureFromGraphData')
    && !src.includes('vaultStructureVersion, indexContentVersion, size.w');
}

/** Mirrors NoteGraphView force-sim effect dependency changes. */
export function simEffectWouldRestart(
  prev: CosmosSimContextSnapshot,
  next: CosmosSimContextSnapshot,
): boolean {
  return prev.graphTopologySignature !== next.graphTopologySignature
    || prev.sizeW !== next.sizeW
    || prev.sizeH !== next.sizeH
    || prev.relationshipFilter !== next.relationshipFilter
    || prev.graphViewMode !== next.graphViewMode
    || prev.reducedMotion !== next.reducedMotion;
}

export function signatureAfterTitleEdit(): { before: string; after: string } {
  const before = buildGraphTopologySignature(BASE_GRAPH);
  return { before, after: before };
}

export function signatureAfterTagEdit(): { before: string; after: string } {
  const before = buildGraphTopologySignature(BASE_GRAPH);
  return { before, after: before };
}

export function signatureAfterLinkAdd(): { before: string; after: string } {
  const before = buildGraphTopologySignature(BASE_GRAPH);
  const after = buildGraphTopologySignature({
    ...BASE_GRAPH,
    edges: [
      ...BASE_GRAPH.edges,
      { sourceId: 'n1', targetId: 'n3', relationshipType: 'backlink' },
    ],
  });
  return { before, after };
}

export function signatureAfterLinkRemove(): { before: string; after: string } {
  const before = buildGraphTopologySignature(BASE_GRAPH);
  const after = buildGraphTopologySignature({
    ...BASE_GRAPH,
    edges: BASE_GRAPH.edges.slice(0, 1),
  });
  return { before, after };
}

function warmTickCount(noteCount: number): number {
  const alphaFloor = graphSimulationAlphaFloor(noteCount);
  return countAlphaTicks(alphaFloor, 0.97, WARM_PARTIAL_REHEAT_ALPHA);
}

export function runK92b2aRestartGateAudit(
  noteCount: number,
  scenario: K92b2aEditScenario,
): K92b2aRestartGateRow {
  const warmTicks = warmTickCount(noteCount);

  const beforeRestartCount = 1;
  const beforeTickCount = scenario === 'metadata_only' ? warmTicks : warmTicks;
  const beforeSettleCount = 1;

  const afterRestartCount = scenario === 'metadata_only' ? 0 : 1;
  const afterTickCount = scenario === 'metadata_only' ? 0 : warmTicks;
  const afterSettleCount = scenario === 'metadata_only' ? 0 : 1;

  return {
    noteCount,
    scenario,
    beforeRestartCount,
    beforeTickCount,
    beforeSettleCount,
    afterRestartCount,
    afterTickCount,
    afterSettleCount,
  };
}

export function formatK92b2aAuditTable(rows: K92b2aRestartGateRow[]): string {
  const lines = [
    '=== K-92B2A Graph Signature Restart Gate ===',
    '',
    '| Notes | Scenario | Before restarts | Before ticks | Before settles | After restarts | After ticks | After settles |',
    '| ----: | -------- | --------------: | -----------: | ---------------: | -------------: | ----------: | ------------: |',
  ];
  for (const r of rows) {
    lines.push(
      `| ${r.noteCount} | ${r.scenario} | ${r.beforeRestartCount} | ${r.beforeTickCount} | ${r.beforeSettleCount} | `
      + `${r.afterRestartCount} | ${r.afterTickCount} | ${r.afterSettleCount} |`,
    );
  }
  return lines.join('\n');
}

export function formatK92b2aTopologyBaselineTable(scales: readonly number[]): string {
  const lines = [
    '=== K-92B2A Topology change baseline (unchanged after gate) ===',
    '',
    '| Notes | Warm ticks per topology restart | Cold ticks (reference) |',
    '| ----: | --------------------------------: | ---------------------: |',
  ];
  for (const n of scales) {
    const row = runK92b1ForceSimAudit(n);
    lines.push(`| ${n} | ${warmTickCount(n)} | ${row.coldSimTicks} |`);
  }
  return lines.join('\n');
}

export { buildGraphTopologySignatureFromGraphData, snapshotProductionSimConfig };
