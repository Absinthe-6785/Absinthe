/**
 * K-92A2 — Scroll attribution audit (test/dev instrumentation only).
 *
 * Compares React render cost vs layout/measurement work during fast scroll.
 * No production behavior changes.
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
  totalDurationMs: number;
}

export interface LayoutReadCounter {
  getBoundingClientRect: { count: number; ms: number };
  offsetHeight: { count: number; ms: number };
  offsetWidth: { count: number; ms: number };
  getComputedStyle: { count: number; ms: number };
  virtualRowMeasureReads: number;
}

export interface ScrollAttributionReport {
  blockCount: number;
  scrollDurationMs: number;
  scrollEventCount: number;
  maxScrollTop: number;
  listContentHeight: number;
  mountedVirtualRows: number;
  totalReactRenderCount: number;
  totalReactRenderMs: number;
  singleBlock: ComponentRenderCounter;
  toggleBlock: ComponentRenderCounter;
  blockEditorInner: ComponentRenderCounter;
  virtualBlockList: ComponentRenderCounter;
  componentRenders: Record<string, ComponentRenderCounter>;
  layout: LayoutReadCounter;
  totalLayoutMs: number;
  avgRenderMsPerVisibleRow: number;
  avgSingleBlockRenderMs: number;
  avgVirtualBlockListCommitMs: number;
  renderToLayoutRatio: number;
  layoutToRenderRatio: number;
}

export interface ScrollAttributionOptions {
  blockCount?: number;
  scrollDurationMs?: number;
  scrollFps?: number;
  viewportHeightPx?: number;
  /** Called after mount, before scroll counters are reset (test instrumentation hook). */
  onScrollPhaseStart?: () => void;
}

function emptyCounter(): ComponentRenderCounter {
  return { renders: 0, rerenders: 0, totalDurationMs: 0 };
}

function reportSafeDiv(numerator: number, denominator: number): number {
  return numerator / Math.max(denominator, 0.001);
}

function trackRender(
  counters: Map<string, ComponentRenderCounter>,
  label: string,
  durationMs: number,
  phase: 'mount' | 'update' | 'nested-update',
): void {
  const c = counters.get(label) ?? emptyCounter();
  c.renders += 1;
  if (phase === 'update' || phase === 'nested-update') c.rerenders += 1;
  c.totalDurationMs += durationMs;
  counters.set(label, c);
}

function isVirtualRowMeasureTarget(el: Element): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.classList.contains('be-virtual-block-row')) return true;
  return el.hasAttribute('data-index') && el.classList.contains('be-virtual-block-row');
}

function installLayoutSpies(layout: LayoutReadCounter): () => void {
  const origGbcr = Element.prototype.getBoundingClientRect;
  const origOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight');
  const origOffsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth');
  const origGetComputedStyle = window.getComputedStyle;

  Element.prototype.getBoundingClientRect = function getBoundingClientRectPatched() {
    layout.getBoundingClientRect.count += 1;
    const t0 = performance.now();
    const rect = origGbcr.call(this);
    layout.getBoundingClientRect.ms += performance.now() - t0;
    if (isVirtualRowMeasureTarget(this)) layout.virtualRowMeasureReads += 1;
    return rect;
  };

  if (origOffsetHeight?.get) {
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
      configurable: true,
      get() {
        layout.offsetHeight.count += 1;
        const t0 = performance.now();
        const value = origOffsetHeight.get!.call(this);
        layout.offsetHeight.ms += performance.now() - t0;
        return value;
      },
    });
  }

  if (origOffsetWidth?.get) {
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
      configurable: true,
      get() {
        layout.offsetWidth.count += 1;
        const t0 = performance.now();
        const value = origOffsetWidth.get!.call(this);
        layout.offsetWidth.ms += performance.now() - t0;
        return value;
      },
    });
  }

  window.getComputedStyle = function getComputedStylePatched(...args) {
    layout.getComputedStyle.count += 1;
    const t0 = performance.now();
    const result = origGetComputedStyle.apply(window, args);
    layout.getComputedStyle.ms += performance.now() - t0;
    return result;
  };

  return () => {
    Element.prototype.getBoundingClientRect = origGbcr;
    window.getComputedStyle = origGetComputedStyle;
    if (origOffsetHeight) Object.defineProperty(HTMLElement.prototype, 'offsetHeight', origOffsetHeight);
    if (origOffsetWidth) Object.defineProperty(HTMLElement.prototype, 'offsetWidth', origOffsetWidth);
  };
}

export function runScrollAttributionAudit(
  options: ScrollAttributionOptions = {},
): ScrollAttributionReport {
  const blockCount = options.blockCount ?? 1000;
  const scrollDurationMs = options.scrollDurationMs ?? 5000;
  const scrollFps = options.scrollFps ?? 60;
  const viewportHeightPx = options.viewportHeightPx ?? 600;

  const blocks = generateBenchmarkBlocks(blockCount);
  const componentRenders = new Map<string, ComponentRenderCounter>();
  const layout: LayoutReadCounter = {
    getBoundingClientRect: { count: 0, ms: 0 },
    offsetHeight: { count: 0, ms: 0 },
    offsetWidth: { count: 0, ms: 0 },
    getComputedStyle: { count: 0, ms: 0 },
    virtualRowMeasureReads: 0,
  };

  let totalReactRenderCount = 0;
  let totalReactRenderMs = 0;

  const onRender: ProfilerOnRenderCallback = (id, phase, actualDuration) => {
    if (phase !== 'mount' && phase !== 'update') return;
    totalReactRenderCount += 1;
    totalReactRenderMs += actualDuration;
    trackRender(componentRenders, id, actualDuration, phase);
  };

  const restoreLayout = installLayoutSpies(layout);

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
      { id: 'ScrollAuditRoot', onRender },
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
  const parsedListHeight = virtualListEl
    ? Number.parseFloat(virtualListEl.style.height)
    : NaN;
  const listContentHeight = Number.isFinite(parsedListHeight) && parsedListHeight > 0
    ? parsedListHeight
    : (virtualListEl?.scrollHeight ?? 0);

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

  const mountedVirtualRows = document.querySelectorAll('.be-virtual-block-row').length;
  const maxScrollTop = Math.max(0, scrollZone.scrollHeight - scrollZone.clientHeight);

  // Reset counters after mount — measure scroll phase only.
  totalReactRenderCount = 0;
  totalReactRenderMs = 0;
  componentRenders.clear();
  layout.getBoundingClientRect = { count: 0, ms: 0 };
  layout.offsetHeight = { count: 0, ms: 0 };
  layout.offsetWidth = { count: 0, ms: 0 };
  layout.getComputedStyle = { count: 0, ms: 0 };
  layout.virtualRowMeasureReads = 0;
  options.onScrollPhaseStart?.();

  const frameCount = Math.max(1, Math.round((scrollDurationMs / 1000) * scrollFps));
  const frameIntervalMs = scrollDurationMs / frameCount;
  let scrollEventCount = 0;

  const scrollStart = performance.now();
  for (let frame = 0; frame < frameCount; frame++) {
    const progress = frame / Math.max(1, frameCount - 1);
    const nextScrollTop = Math.round(maxScrollTop * progress);
    act(() => {
      scrollZone.scrollTop = nextScrollTop;
      scrollZone.dispatchEvent(new Event('scroll', { bubbles: true }));
      scrollEventCount += 1;
    });
    act(() => {});

    const targetElapsed = (frame + 1) * frameIntervalMs;
    const elapsed = performance.now() - scrollStart;
    const waitMs = targetElapsed - elapsed;
    if (waitMs > 0) {
      const deadline = performance.now() + waitMs;
      while (performance.now() < deadline) {
        // wall-clock pacing for 5s window
      }
    }
  }
  act(() => {});
  const measuredScrollDurationMs = performance.now() - scrollStart;

  const postScrollVirtualRows = document.querySelectorAll('.be-virtual-block-row').length;

  restoreLayout();
  act(() => {
    root?.unmount();
  });

  const totalLayoutMs = layout.getBoundingClientRect.ms
    + layout.offsetHeight.ms
    + layout.offsetWidth.ms
    + layout.getComputedStyle.ms;

  const getCounter = (label: string): ComponentRenderCounter =>
    componentRenders.get(label) ?? emptyCounter();

  const visibleRowProxy = Math.max(mountedVirtualRows, postScrollVirtualRows, 1);
  const singleBlockAvgMs = reportSafeDiv(
    getCounter('SingleBlock').totalDurationMs,
    Math.max(getCounter('SingleBlock').renders, 1),
  );
  const virtualListAvgMs = reportSafeDiv(
    getCounter('VirtualBlockList').totalDurationMs,
    Math.max(getCounter('VirtualBlockList').renders, 1),
  );
  const avgRenderMsPerVisibleRow = reportSafeDiv(totalReactRenderMs, visibleRowProxy);

  return {
    blockCount,
    scrollDurationMs: measuredScrollDurationMs,
    scrollEventCount,
    maxScrollTop,
    listContentHeight,
    mountedVirtualRows: Math.max(mountedVirtualRows, postScrollVirtualRows),
    totalReactRenderCount,
    totalReactRenderMs,
    singleBlock: getCounter('SingleBlock'),
    toggleBlock: getCounter('ToggleBlock'),
    blockEditorInner: getCounter('BlockEditorInner'),
    virtualBlockList: getCounter('VirtualBlockList'),
    componentRenders: Object.fromEntries(componentRenders.entries()),
    layout,
    totalLayoutMs,
    avgRenderMsPerVisibleRow,
    avgSingleBlockRenderMs: singleBlockAvgMs,
    avgVirtualBlockListCommitMs: virtualListAvgMs,
    renderToLayoutRatio: totalReactRenderMs / Math.max(totalLayoutMs, 0.001),
    layoutToRenderRatio: totalLayoutMs / Math.max(totalReactRenderMs, 0.001),
  };
}

export function formatScrollAttributionReport(report: ScrollAttributionReport): string {
  const avgSingleBlockRenderMs = reportSafeDiv(
    report.singleBlock.totalDurationMs,
    Math.max(report.singleBlock.renders, 1),
  );
  const avgVirtualBlockListCommitMs = reportSafeDiv(
    report.virtualBlockList.totalDurationMs,
    Math.max(report.virtualBlockList.renders, 1),
  );
  const lines = [
    '=== K-92A2 Scroll Attribution Audit ===',
    `Blocks: ${report.blockCount}`,
    `Scroll window: ${report.scrollDurationMs.toFixed(0)}ms (${report.scrollEventCount} events, maxScrollTop=${report.maxScrollTop}, listHeight=${report.listContentHeight.toFixed(0)})`,
    `Mounted virtual rows: ${report.mountedVirtualRows}`,
    '',
    '--- React render totals ---',
    `Total profiler commits: ${report.totalReactRenderCount}`,
    `Total React render time: ${report.totalReactRenderMs.toFixed(2)}ms`,
    `SingleBlock: renders=${report.singleBlock.renders} rerenders=${report.singleBlock.rerenders} duration=${report.singleBlock.totalDurationMs.toFixed(2)}ms`,
    `ToggleBlock: renders=${report.toggleBlock.renders} rerenders=${report.toggleBlock.rerenders} duration=${report.toggleBlock.totalDurationMs.toFixed(2)}ms`,
    `BlockEditorInner: renders=${report.blockEditorInner.renders} rerenders=${report.blockEditorInner.rerenders} duration=${report.blockEditorInner.totalDurationMs.toFixed(2)}ms`,
    `VirtualBlockList: renders=${report.virtualBlockList.renders} rerenders=${report.virtualBlockList.rerenders} duration=${report.virtualBlockList.totalDurationMs.toFixed(2)}ms`,
    `Avg React ms / scroll commit: ${avgVirtualBlockListCommitMs.toFixed(2)}ms`,
    `Avg SingleBlock render: ${avgSingleBlockRenderMs.toFixed(3)}ms`,
    `Avg React ms / visible row (root commits): ${report.avgRenderMsPerVisibleRow.toFixed(2)}ms`,
    '',
    '--- Layout / measurement reads ---',
    `getBoundingClientRect: ${report.layout.getBoundingClientRect.count} calls, ${report.layout.getBoundingClientRect.ms.toFixed(2)}ms`,
    `Virtual row measure reads: ${report.layout.virtualRowMeasureReads}`,
    `offsetHeight: ${report.layout.offsetHeight.count} calls, ${report.layout.offsetHeight.ms.toFixed(2)}ms`,
    `offsetWidth: ${report.layout.offsetWidth.count} calls, ${report.layout.offsetWidth.ms.toFixed(2)}ms`,
    `getComputedStyle: ${report.layout.getComputedStyle.count} calls, ${report.layout.getComputedStyle.ms.toFixed(2)}ms`,
    `Total layout read time: ${report.totalLayoutMs.toFixed(2)}ms`,
    '',
    '--- Attribution ---',
    `Render : Layout ratio = ${report.renderToLayoutRatio.toFixed(2)} : 1`,
    `Layout : Render ratio = ${report.layoutToRenderRatio.toFixed(2)} : 1`,
    '',
    '--- Top components by render count ---',
    ...topComponentsByRenderCount(report, 10).map(
      (row, i) => `${i + 1}. ${row.label}: ${row.renders} renders, ${row.durationMs.toFixed(2)}ms`,
    ),
  ];
  return lines.join('\n');
}

export function topComponentsByRenderCount(
  report: ScrollAttributionReport,
  limit = 10,
): { label: string; renders: number; durationMs: number }[] {
  return Object.entries(report.componentRenders)
    .map(([label, c]) => ({ label, renders: c.renders, durationMs: c.totalDurationMs }))
    .sort((a, b) => b.renders - a.renders || b.durationMs - a.durationMs)
    .slice(0, limit);
}
