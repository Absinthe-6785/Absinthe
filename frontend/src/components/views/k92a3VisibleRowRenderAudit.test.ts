// @vitest-environment happy-dom
/**
 * K-92A3 — Visible row render attribution audit.
 * Run: npm test -- k92a3VisibleRowRender
 */
import React, { createElement, type ProfilerOnRenderCallback } from 'react';
import { Profiler } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  formatVisibleRowRenderAuditReport,
  runVisibleRowRenderAudit,
  setVisibleRowAuditInstrumentation,
  topRenderHotspots,
  type ComponentRenderCounter,
} from './k92a3VisibleRowRenderAudit';
import { setVirtualRowShellRenderHook } from './features/block-editor/performance/VirtualRowShell';
import { resetRenderDiagnostics } from './noteview/renderDiagnostics';

const SINGLE_BLOCK_PROP_KEYS = [
  'block', 'isSelected', 'onBlockSelect', 'activeBlockId', 'controlsVisible',
  'readOnly', 'searchQuery', 'depth', 'isMenuOpen', 'headingIndex', 'colors',
  'wikiTargets', 'onAddBelow', 'onSplitBlock', 'onMergeWithPrev', 'onContentChange',
  'bindGripPointer', 'getDragProps', 'onOpenTurnInto', 'onConvertBlock',
  'onSlashOpen', 'onSlashClose', 'onWikiOpen', 'onWikiClose', 'onWikiNavigate',
  'onToggleAddChild', 'onToggleEnter', 'onTableChange', 'onNavigateBlock',
  'onActiveBlockChange', 'onToggleControlsPin', 'onChromeEnter', 'onChromeLeave',
  'onIndentBlock', 'onOutdentBlock', 'onPasteAt', 'onPasteBlocksAt',
  'onGutterPointerDown', 'getRootBlocks', 'onRootChange', 'searchQueryFor',
  'renderToggleNested', 'showPersistentPlaceholder', 'onClearBlockSelection',
] as const;

const auditState = vi.hoisted(() => ({
  renderBlockCalls: 0,
  viewportTurnoverMounts: 0,
  propChanges: new Map<string, number>(),
  lastPropsByBlock: new Map<string, Record<string, unknown>>(),
  mountedBlocks: new Set<string>(),
  counters: new Map<string, ComponentRenderCounter>(),
}));

function resetAuditState(): void {
  auditState.renderBlockCalls = 0;
  auditState.viewportTurnoverMounts = 0;
  auditState.propChanges.clear();
  auditState.lastPropsByBlock.clear();
  auditState.mountedBlocks.clear();
  auditState.counters.clear();
}

function trackProfiler(
  label: string,
  phase: 'mount' | 'update' | 'nested-update',
  durationMs: number,
): void {
  const c = auditState.counters.get(label) ?? {
    renders: 0, rerenders: 0, mounts: 0, totalDurationMs: 0,
  };
  c.renders += 1;
  if (phase === 'mount') c.mounts += 1;
  if (phase === 'update' || phase === 'nested-update') c.rerenders += 1;
  c.totalDurationMs += durationMs;
  auditState.counters.set(label, c);
}

function wrapWithProfiler<P extends object>(
  label: string,
  Component: React.ComponentType<P>,
): React.ComponentType<P> {
  const onRender: ProfilerOnRenderCallback = (_id, phase, actualDuration) => {
    if (phase !== 'mount' && phase !== 'update') return;
    trackProfiler(label, phase, actualDuration);
  };
  return function ProfiledComponent(props: P) {
    return createElement(Profiler, { id: label, onRender }, createElement(Component, props));
  };
}

function snapshotProps(props: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(SINGLE_BLOCK_PROP_KEYS.map(key => [key, props[key]]));
}

function trackSingleBlockProps(props: Record<string, unknown>): void {
  const blockId = (props.block as { id?: string })?.id;
  if (!blockId) return;
  const snap = snapshotProps(props);
  const prev = auditState.lastPropsByBlock.get(blockId);
  if (prev) {
    for (const key of SINGLE_BLOCK_PROP_KEYS) {
      if (prev[key] !== snap[key]) {
        auditState.propChanges.set(key, (auditState.propChanges.get(key) ?? 0) + 1);
      }
    }
  } else if (!auditState.mountedBlocks.has(blockId)) {
    auditState.mountedBlocks.add(blockId);
    auditState.viewportTurnoverMounts += 1;
  }
  auditState.lastPropsByBlock.set(blockId, snap);
}

setVisibleRowAuditInstrumentation({
  reset: resetAuditState,
  getMetrics: () => ({
    renderBlockCalls: auditState.renderBlockCalls,
    viewportTurnoverMounts: auditState.viewportTurnoverMounts,
    propInstability: [...auditState.propChanges.entries()]
      .map(([prop, changeCount]) => ({ prop, changeCount }))
      .sort((a, b) => b.changeCount - a.changeCount),
  }),
});

setVirtualRowShellRenderHook(() => {
  auditState.renderBlockCalls += 1;
});

vi.mock('./features/block-editor/performance/VirtualBlockList', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./features/block-editor/performance/VirtualBlockList')>();
  return {
    ...actual,
    VirtualBlockList: wrapWithProfiler('VirtualBlockList', actual.VirtualBlockList),
  };
});

vi.mock('./features/block-editor/components/SingleBlock', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./features/block-editor/components/SingleBlock')>();
  const Profiled = wrapWithProfiler('SingleBlock', function WrappedSingleBlock(props: Record<string, unknown>) {
    trackSingleBlockProps(props);
    return createElement(actual.SingleBlock, props as never);
  });
  return { ...actual, SingleBlock: Profiled };
});

vi.mock('./ToggleBlock', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./ToggleBlock')>();
  return { ...actual, ToggleBlock: wrapWithProfiler('ToggleBlock', actual.ToggleBlock) };
});

vi.mock('./EditorChrome', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./EditorChrome')>();
  return {
    ...actual,
    BlockHandles: wrapWithProfiler('BlockHandles', actual.BlockHandles),
    BlockGutter: wrapWithProfiler('BlockGutter', actual.BlockGutter),
  };
});

vi.mock('./SafeBlockRenderer', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./SafeBlockRenderer')>();
  class ProfiledSafeBlockRenderer extends actual.SafeBlockRenderer {
    render() {
      return createElement(
        Profiler,
        {
          id: 'SafeBlockRenderer',
          onRender: (_id: string, phase: 'mount' | 'update', actualDuration: number) => {
            if (phase === 'mount' || phase === 'update') trackProfiler('SafeBlockRenderer', phase, actualDuration);
          },
        },
        super.render(),
      );
    }
  }
  return { ...actual, SafeBlockRenderer: ProfiledSafeBlockRenderer };
});

vi.mock('./features/block-editor/performance/DragOverlay', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./features/block-editor/performance/DragOverlay')>();
  return { ...actual, DragOverlay: wrapWithProfiler('DragOverlay', actual.DragOverlay) };
});

vi.mock('./features/block-editor/features/selection/components/SelectionToolbar', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./features/block-editor/features/selection/components/SelectionToolbar')>();
  return { ...actual, SelectionToolbar: wrapWithProfiler('SelectionToolbar', actual.SelectionToolbar) };
});

vi.mock('./features/block-editor/performance/VirtualBlockScrollHost', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./features/block-editor/performance/VirtualBlockScrollHost')>();
  return {
    ...actual,
    VirtualBlockScrollHost: wrapWithProfiler('VirtualBlockScrollHost', actual.VirtualBlockScrollHost),
  };
});

describe('K-92A3 visible row render audit', () => {
  it('attributes scroll-phase visible row render cost @ 1000 blocks', () => {
    resetAuditState();
    const report = runVisibleRowRenderAudit(auditState.counters, {
      blockCount: 1000,
      scrollDurationMs: 5000,
      scrollFps: 60,
      onScrollPhaseStart: resetAuditState,
    });

    // eslint-disable-next-line no-console
    console.log('\n' + formatVisibleRowRenderAuditReport(report));

    expect(report.blockCount).toBe(1000);
    expect(report.renderBlockCalls).toBeGreaterThan(500);
    expect(report.renderBlockCalls).toBeLessThan(5000);
    expect(report.components.SingleBlock?.renders).toBeGreaterThan(0);

    const singleBlock = report.components.SingleBlock!;
    const memoSkipEstimate = report.renderBlockCalls - singleBlock.renders;
    // eslint-disable-next-line no-console
    console.log(`Memo skip estimate (renderBlock - SingleBlock): ${memoSkipEstimate}`);

    expect(topRenderHotspots(report, 5).length).toBeGreaterThan(0);
  }, 30_000);

  it('attributes scroll-phase @ 2000 blocks', () => {
    resetAuditState();
    const report = runVisibleRowRenderAudit(auditState.counters, {
      blockCount: 2000,
      scrollDurationMs: 5000,
      scrollFps: 60,
      onScrollPhaseStart: resetAuditState,
    });

    // eslint-disable-next-line no-console
    console.log('\n' + formatVisibleRowRenderAuditReport(report));

    expect(report.blockCount).toBe(2000);
    expect(report.components.SingleBlock?.renders).toBeGreaterThan(0);
  }, 45_000);

  it('K-92A3A: row memo reduces renderBlock churn @ 1000 blocks', () => {
    resetAuditState();
    resetRenderDiagnostics();

    const report = runVisibleRowRenderAudit(auditState.counters, {
      blockCount: 1000,
      scrollDurationMs: 5000,
      scrollFps: 60,
      onScrollPhaseStart: () => {
        resetAuditState();
        resetRenderDiagnostics();
      },
    });

    const singleBlock = report.components.SingleBlock!;
    // eslint-disable-next-line no-console
    console.log('\n=== K-92A3A row memo @ 1000 blocks ===');
    // eslint-disable-next-line no-console
    console.log(`renderBlock calls: ${report.renderBlockCalls} (K-92A3 baseline ~8152)`);
    // eslint-disable-next-line no-console
    console.log(`SingleBlock renders: ${singleBlock.renders} (K-92A3 baseline ~8295)`);
    // eslint-disable-next-line no-console
    console.log(`Total React time: ${report.totalReactRenderMs.toFixed(2)}ms`);
    // eslint-disable-next-line no-console
    console.log(`Selection rerenders: ${report.selectionPhaseSingleBlockRerenders}`);

    // Primary target: renderBlock 8152 → ~1200–1500 (achieved ~999)
    expect(report.renderBlockCalls).toBeLessThan(2000);
    expect(report.renderBlockCalls).toBeGreaterThan(500);
    // Secondary target: SingleBlock renders 8295 → ~2500–4000 (achieved ~1142)
    expect(singleBlock.renders).toBeLessThan(2000);
    expect(report.selectionPhaseSingleBlockRerenders).toBeGreaterThan(0);
  }, 30_000);

  it('K-92A3A: row memo keeps renderBlock flat @ 2000 blocks', () => {
    resetAuditState();

    const report = runVisibleRowRenderAudit(auditState.counters, {
      blockCount: 2000,
      scrollDurationMs: 5000,
      scrollFps: 60,
      onScrollPhaseStart: resetAuditState,
    });

    const singleBlock = report.components.SingleBlock!;
    // eslint-disable-next-line no-console
    console.log('\n=== K-92A3A row memo @ 2000 blocks ===');
    // eslint-disable-next-line no-console
    console.log(`renderBlock calls: ${report.renderBlockCalls}`);
    // eslint-disable-next-line no-console
    console.log(`SingleBlock renders: ${singleBlock.renders} mounts=${singleBlock.mounts}`);
    // eslint-disable-next-line no-console
    console.log(`Total React time: ${report.totalReactRenderMs.toFixed(2)}ms`);

    expect(report.renderBlockCalls).toBeLessThan(2000);
    expect(singleBlock.renders).toBeLessThan(3500);
    expect(singleBlock.mounts).toBeGreaterThan(2000);
  }, 45_000);
});
