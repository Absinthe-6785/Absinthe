/**
 * K-92B1B — Cosmos warm reheat benchmark (test/dev only).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runK92b1ForceSimAudit } from './k92b1CosmosForceSimAudit';
import { COSMOS_WARM_REHEAT_ALPHA } from './cosmosSimReheat';

export interface K92b1bWarmReheatRow {
  noteCount: number;
  coldSettleMs: number;
  coldTicks: number;
  warmSettleMs: number;
  warmTicks: number;
  settleImprovementPct: number;
  tickReductionPct: number;
}

export function runK92b1bWarmReheatAudit(noteCount: number): K92b1bWarmReheatRow {
  const row = runK92b1ForceSimAudit(noteCount);
  const settleImprovementPct = row.coldSimSettleMs > 0
    ? Math.round(((row.coldSimSettleMs - row.warmPartialReheatMs) / row.coldSimSettleMs) * 1000) / 10
    : 0;
  const tickReductionPct = row.coldSimTicks > 0
    ? Math.round(((row.coldSimTicks - row.warmPartialReheatTicks) / row.coldSimTicks) * 1000) / 10
    : 0;

  return {
    noteCount,
    coldSettleMs: row.coldSimSettleMs,
    coldTicks: row.coldSimTicks,
    warmSettleMs: row.warmPartialReheatMs,
    warmTicks: row.warmPartialReheatTicks,
    settleImprovementPct,
    tickReductionPct,
  };
}

export function noteGraphViewUsesWarmReheatPolicy(): boolean {
  const viewsRoot = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(join(viewsRoot, 'NoteGraphView.tsx'), 'utf8');
  return src.includes('resolveCosmosSimInitialAlpha')
    && src.includes('preservedNodeCountRef')
    && src.includes('graphTopologySignature')
    && !src.includes('let alpha = 1.0;');
}

export function formatK92b1bAuditTable(rows: K92b1bWarmReheatRow[]): string {
  const lines = [
    '=== K-92B1B Warm Reheat Audit ===',
    '',
    `Warm reheat alpha: ${COSMOS_WARM_REHEAT_ALPHA}`,
    '',
    '| Notes | Cold settle | Warm reheat | Cold ticks | Warm ticks | Settle Δ | Tick Δ |',
    '| ----: | ----------: | ----------: | ---------: | ---------: | -------: | -----: |',
  ];
  for (const r of rows) {
    lines.push(
      `| ${r.noteCount} | ${r.coldSettleMs.toFixed(2)}ms | ${r.warmSettleMs.toFixed(2)}ms | `
      + `${r.coldTicks} | ${r.warmTicks} | ${r.settleImprovementPct.toFixed(1)}% | ${r.tickReductionPct.toFixed(1)}% |`,
    );
  }
  return lines.join('\n');
}
