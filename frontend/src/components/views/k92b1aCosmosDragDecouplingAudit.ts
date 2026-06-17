/**
 * K-92B1A — Cosmos drag-decoupled simulation audit (test/dev only).
 *
 * Models sim restart cost for pointer events before vs after K-92B1A.
 * Before: dragging in force-sim useEffect deps → full reheat (α=1.0) per mousedown/mouseup.
 * After: draggingRef only → zero sim restarts on click/drag when topology unchanged.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runK92b1ForceSimAudit } from './k92b1CosmosForceSimAudit';

export interface K92b1aDragEventTiming {
  /** mousedown + mouseup with no movement (two effect restarts before K-92B1A). */
  clickNodeMs: number;
  /** mousedown only (one effect restart before K-92B1A). */
  dragStartMs: number;
  /** mouseup after drag (one effect restart before K-92B1A). */
  dragEndMs: number;
  /** vaultStructureVersion change — still restarts sim (unchanged). */
  topologyChangeMs: number;
}

export interface K92b1aDragDecouplingRow {
  noteCount: number;
  coldSimSettleMs: number;
  before: K92b1aDragEventTiming;
  after: K92b1aDragEventTiming;
}

const AFTER_POINTER_MS = 0;

export function modelBeforeDragDecoupling(coldSimSettleMs: number): K92b1aDragEventTiming {
  return {
    clickNodeMs: Math.round(coldSimSettleMs * 2 * 100) / 100,
    dragStartMs: Math.round(coldSimSettleMs * 100) / 100,
    dragEndMs: Math.round(coldSimSettleMs * 100) / 100,
    topologyChangeMs: Math.round(coldSimSettleMs * 100) / 100,
  };
}

export function modelAfterDragDecoupling(coldSimSettleMs: number): K92b1aDragEventTiming {
  return {
    clickNodeMs: AFTER_POINTER_MS,
    dragStartMs: AFTER_POINTER_MS,
    dragEndMs: AFTER_POINTER_MS,
    topologyChangeMs: Math.round(coldSimSettleMs * 100) / 100,
  };
}

export function runK92b1aDragDecouplingAudit(noteCount: number): K92b1aDragDecouplingRow {
  const row = runK92b1ForceSimAudit(noteCount);
  const cold = row.coldSimSettleMs;
  return {
    noteCount,
    coldSimSettleMs: cold,
    before: modelBeforeDragDecoupling(cold),
    after: modelAfterDragDecoupling(cold),
  };
}

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

export function formatK92b1aAuditTable(rows: K92b1aDragDecouplingRow[]): string {
  const lines = [
    '=== K-92B1A Drag-Decoupled Simulation Audit ===',
    '',
    '| Notes | Cold settle | Click before | Click after | Drag start before | Drag start after | Drag end before | Drag end after | Topology (unchanged) |',
    '| ----: | ----------: | -----------: | ----------: | ----------------: | ---------------: | --------------: | -------------: | ---------------------: |',
  ];
  for (const r of rows) {
    lines.push(
      `| ${r.noteCount} | ${r.coldSimSettleMs.toFixed(2)}ms | ${r.before.clickNodeMs.toFixed(2)}ms | ${r.after.clickNodeMs.toFixed(2)}ms | `
      + `${r.before.dragStartMs.toFixed(2)}ms | ${r.after.dragStartMs.toFixed(2)}ms | `
      + `${r.before.dragEndMs.toFixed(2)}ms | ${r.after.dragEndMs.toFixed(2)}ms | ${r.after.topologyChangeMs.toFixed(2)}ms |`,
    );
  }
  return lines.join('\n');
}
