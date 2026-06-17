/**
 * K-92A3 — Visible row render attribution audit (test/dev instrumentation only).
 */
import { createElement, type ProfilerOnRenderCallback } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { Profiler } from 'react';
import { BlockEditor } from './BlockEditor';
import { generateBenchmarkBlocks } from './editorBenchmark';
import { EDITOR_CHROME_STYLES } from './editorChromeStyles';

const AUDIT_COLORS = {
  bg: '#fff', text: '#111', textMuted: '#666', textFaint: '#999',
  accent: '#8B5CF6', accentBg: '#eee', border: '#ddd', card: '#fff',
  cardHov: '#f5f5f5', input: '#fff', inputBdr: '#ccc', toolbar: '#f9f9f9',
  danger: '#f00', green: '#0f0', codeBg: '#f1f5f9', calloutBg: '#fafafa',
  toggleBg: 'transparent', quoteBdr: '#ccc', selection: '#eef',
};

export interface ComponentRenderCounter {
  renders: number;
  rerenders: number;
  mounts: number;
  totalDurationMs: number;
}

export interface PropInstabilityRow {
  prop: string;
  changeCount: number;
}

export interface VisibleRowRenderAuditReport {
  blockCount: number;
  scrollDurationMs: number;
  scrollEventCount: number;
  mountedVirtualRows: number;
  renderBlockCalls: number;
  uniqueBlocksRendered: number;
  viewportTurnoverMounts: number;
  components: Record<string, ComponentRenderCounter>;
  propInstability: PropInstabilityRow[];
  totalReactRenderMs: number;
  selectionPhaseSingleBlockRerenders: number;
  dragPhaseDragOverlayRerenders: number;
}

export interface VisibleRowAuditMetrics {
  renderBlockCalls: number;
  viewportTurnoverMounts: number;
  propInstability: PropInstabilityRow[];
}

export interface VisibleRowAuditInstrumentation {
  reset?: () => void;
  getMetrics?: () => VisibleRowAuditMetrics;
}

let instrumentation: VisibleRowAuditInstrumentation = {};

export function setVisibleRowAuditInstrumentation(next: VisibleRowAuditInstrumentation): void {
  instrumentation = next;
}

export function resetVisibleRowAuditInstrumentation(): void {
  instrumentation = {};
}

export interface VisibleRowRenderAuditOptions {
  blockCount?: number;
  scrollDurationMs?: number;
  scrollFps?: number;
  viewportHeightPx?: number;
  onScrollPhaseStart?: () => void;
}

function emptyCounter(): ComponentRenderCounter {
  return { renders: 0, rerenders: 0, mounts: 0, totalDurationMs: 0 };
}

export function runVisibleRowRenderAudit(
  counters: Map<string, ComponentRenderCounter>,
  options: VisibleRowRenderAuditOptions = {},
): VisibleRowRenderAuditReport {
  const blockCount = options.blockCount ?? 1000;
  const scrollDurationMs = options.scrollDurationMs ?? 5000;
  const scrollFps = options.scrollFps ?? 60;
  const viewportHeightPx = options.viewportHeightPx ?? 600;

  const blocks = generateBenchmarkBlocks(blockCount);
  let totalReactRenderMs = 0;

  const onRootRender: ProfilerOnRenderCallback = (_id, phase, actualDuration) => {
    if (phase !== 'mount' && phase !== 'update') return;
    totalReactRenderMs += actualDuration;
  };

  instrumentation.reset?.();

  document.body.innerHTML = '';
  document.head.innerHTML = '';
  const style = document.createElement('style');
  style.textContent = EDITOR_CHROME_STYLES;
  document.head.appendChild(style);

  const scrollZone = document.createElement('div');
  scrollZone.className = 'editor-drop-zone';
  scrollZone.style.height = `${viewportHeightPx}px`;
  scrollZone.style.overflow = 'auto';
  scrollZone.style.width = '800px';
  document.body.appendChild(scrollZone);

  const host = document.createElement('div');
  scrollZone.appendChild(host);
  const virtualScrollParentRef = { current: scrollZone };

  let root: Root | null = null;
  act(() => {
    root = createRoot(host);
    root.render(createElement(
      Profiler,
      { id: 'VisibleRowAuditRoot', onRender: onRootRender },
      createElement(BlockEditor, {
        blocks,
        onChange: () => {},
        colors: AUDIT_COLORS,
        readOnly: false,
        virtualBlocksPoc: true,
        virtualScrollParentRef,
      }),
    ));
  });
  act(() => {});
  act(() => {});

  const virtualListEl = scrollZone.querySelector('.be-virtual-block-list') as HTMLElement | null;
  const listContentHeight = virtualListEl
    ? Number.parseFloat(virtualListEl.style.height)
    : 0;
  if (listContentHeight > viewportHeightPx) {
    Object.defineProperty(scrollZone, 'scrollHeight', {
      configurable: true,
      get: () => listContentHeight,
    });
    Object.defineProperty(scrollZone, 'clientHeight', {
      configurable: true,
      get: () => viewportHeightPx,
    });
  }

  const mountedVirtualRows = scrollZone.querySelectorAll('.be-virtual-block-row').length;
  const maxScrollTop = Math.max(0, scrollZone.scrollHeight - scrollZone.clientHeight);

  counters.clear();
  totalReactRenderMs = 0;
  instrumentation.reset?.();
  options.onScrollPhaseStart?.();

  const frameCount = Math.max(1, Math.round((scrollDurationMs / 1000) * scrollFps));
  const frameIntervalMs = scrollDurationMs / frameCount;
  let scrollEventCount = 0;
  const scrollStart = performance.now();

  for (let frame = 0; frame < frameCount; frame++) {
    const progress = frame / Math.max(1, frameCount - 1);
    act(() => {
      scrollZone.scrollTop = Math.round(maxScrollTop * progress);
      scrollZone.dispatchEvent(new Event('scroll', { bubbles: true }));
      scrollEventCount += 1;
    });
    act(() => {});

    const targetElapsed = (frame + 1) * frameIntervalMs;
    const elapsed = performance.now() - scrollStart;
    const waitMs = targetElapsed - elapsed;
    if (waitMs > 0) {
      const deadline = performance.now() + waitMs;
      while (performance.now() < deadline) { /* pace 5s window */ }
    }
  }

  act(() => {});
  const measuredScrollDurationMs = performance.now() - scrollStart;

  // Selection phase — gutter click on first mounted block
  const beforeSelection = counters.get('SingleBlock')?.rerenders ?? 0;
  const firstStrip = scrollZone.querySelector('.be-gutter-strip') as HTMLElement | null;
  if (firstStrip) {
    act(() => {
      firstStrip.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        clientX: 22,
        clientY: 30,
        pointerId: 2,
        button: 0,
        buttons: 1,
        pointerType: 'mouse',
      }));
      firstStrip.dispatchEvent(new PointerEvent('pointerup', {
        bubbles: true,
        cancelable: true,
        clientX: 22,
        clientY: 30,
        pointerId: 2,
        button: 0,
        buttons: 0,
        pointerType: 'mouse',
      }));
    });
    act(() => {});
  }
  const afterSelection = counters.get('SingleBlock')?.rerenders ?? 0;

  act(() => { root?.unmount(); });

  const metrics = instrumentation.getMetrics?.() ?? {
    renderBlockCalls: 0,
    viewportTurnoverMounts: 0,
    propInstability: [],
  };

  return {
    blockCount,
    scrollDurationMs: measuredScrollDurationMs,
    scrollEventCount,
    mountedVirtualRows,
    renderBlockCalls: metrics.renderBlockCalls,
    uniqueBlocksRendered: 0,
    viewportTurnoverMounts: metrics.viewportTurnoverMounts,
    components: Object.fromEntries(counters.entries()),
    propInstability: metrics.propInstability,
    totalReactRenderMs,
    selectionPhaseSingleBlockRerenders: Math.max(0, afterSelection - beforeSelection),
    dragPhaseDragOverlayRerenders: 0,
  };
}

export function formatVisibleRowRenderAuditReport(report: VisibleRowRenderAuditReport): string {
  const lines = [
    '=== K-92A3 Visible Row Render Audit ===',
    `Blocks: ${report.blockCount}`,
    `Scroll: ${report.scrollDurationMs.toFixed(0)}ms (${report.scrollEventCount} events)`,
    `Mounted virtual rows: ${report.mountedVirtualRows}`,
    `Render-block calls: ${report.renderBlockCalls}`,
    `Unique blocks touched: ${report.uniqueBlocksRendered}`,
    `Viewport turnover mounts: ${report.viewportTurnoverMounts}`,
    `Total React time (root profiler): ${report.totalReactRenderMs.toFixed(2)}ms`,
    '',
    '--- Component renders (scroll + interaction phases) ---',
  ];

  const ranked = Object.entries(report.components)
    .map(([label, c]) => ({
      label,
      renders: c.renders,
      mounts: c.mounts,
      rerenders: c.rerenders,
      totalDurationMs: c.totalDurationMs,
      avgMs: c.renders > 0 ? c.totalDurationMs / c.renders : 0,
    }))
    .sort((a, b) => b.totalDurationMs - a.totalDurationMs || b.renders - a.renders);

  for (const row of ranked) {
    lines.push(
      `${row.label}: renders=${row.renders} mounts=${row.mounts} rerenders=${row.rerenders} `
      + `total=${row.totalDurationMs.toFixed(2)}ms avg=${row.avgMs.toFixed(3)}ms`,
    );
  }

  lines.push(
    '',
    '--- Prop instability (same block, consecutive render-block calls) ---',
  );
  if (report.propInstability.length === 0) {
    lines.push('(none recorded)');
  } else {
    for (const row of report.propInstability.slice(0, 20)) {
      lines.push(`${row.prop}: ${row.changeCount} changes`);
    }
  }

  lines.push(
    '',
    '--- Interaction phases ---',
    `Selection → SingleBlock rerenders: ${report.selectionPhaseSingleBlockRerenders}`,
    `Drag → DragOverlay rerenders: ${report.dragPhaseDragOverlayRerenders}`,
  );

  return lines.join('\n');
}

export function topRenderHotspots(
  report: VisibleRowRenderAuditReport,
  limit = 20,
): { label: string; renders: number; totalMs: number; avgMs: number; mounts: number }[] {
  return Object.entries(report.components)
    .map(([label, c]) => ({
      label,
      renders: c.renders,
      totalMs: c.totalDurationMs,
      avgMs: c.renders > 0 ? c.totalDurationMs / c.renders : 0,
      mounts: c.mounts,
    }))
    .sort((a, b) => b.totalMs - a.totalMs || b.renders - a.renders)
    .slice(0, limit);
}
