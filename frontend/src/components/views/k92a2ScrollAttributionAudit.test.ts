// @vitest-environment happy-dom
/**
 * K-92A2 — Scroll jank attribution: render cost vs layout/measurement.
 * Run: npm test -- k92a2ScrollAttribution
 */
import React, { createElement, type ProfilerOnRenderCallback } from 'react';
import { Profiler } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  formatScrollAttributionReport,
  runScrollAttributionAudit,
  topComponentsByRenderCount,
  type ScrollAttributionReport,
} from './k92a2ScrollAttributionAudit';

const renderCounts = vi.hoisted(() => ({
  singleBlock: { renders: 0, rerenders: 0, totalDurationMs: 0 },
  toggleBlock: { renders: 0, rerenders: 0, totalDurationMs: 0 },
  blockEditorInner: { renders: 0, rerenders: 0, totalDurationMs: 0 },
  virtualBlockList: { renders: 0, rerenders: 0, totalDurationMs: 0 },
}));

const blockEditorInnerHookState = vi.hoisted(() => ({ callCount: 0 }));

function trackWrappedRender(
  bucket: typeof renderCounts.singleBlock,
  phase: 'mount' | 'update' | 'nested-update',
  durationMs: number,
): void {
  bucket.renders += 1;
  if (phase === 'update' || phase === 'nested-update') bucket.rerenders += 1;
  bucket.totalDurationMs += durationMs;
}

function wrapWithProfiler<P extends object>(
  id: keyof typeof renderCounts,
  Component: React.ComponentType<P>,
): React.ComponentType<P> {
  const onRender: ProfilerOnRenderCallback = (_profilerId, phase, actualDuration) => {
    if (phase !== 'mount' && phase !== 'update') return;
    trackWrappedRender(renderCounts[id], phase, actualDuration);
  };
  return function ProfiledComponent(props: P) {
    return createElement(
      Profiler,
      { id, onRender },
      createElement(Component, props),
    );
  };
}

vi.mock('./features/block-editor/components/SingleBlock', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./features/block-editor/components/SingleBlock')>();
  return {
    ...actual,
    SingleBlock: wrapWithProfiler('singleBlock', actual.SingleBlock),
  };
});

vi.mock('./ToggleBlock', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./ToggleBlock')>();
  return {
    ...actual,
    ToggleBlock: wrapWithProfiler('toggleBlock', actual.ToggleBlock),
  };
});

vi.mock('./features/block-editor/performance/VirtualBlockList', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./features/block-editor/performance/VirtualBlockList')>();
  return {
    ...actual,
    VirtualBlockList: wrapWithProfiler('virtualBlockList', actual.VirtualBlockList),
  };
});

vi.mock('./features/block-editor/performance/useVirtualBlockList', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./features/block-editor/performance/useVirtualBlockList')>();
  return {
    ...actual,
    useVirtualBlockList: (...args: Parameters<typeof actual.useVirtualBlockList>) => {
      blockEditorInnerHookState.callCount += 1;
      renderCounts.blockEditorInner.renders = blockEditorInnerHookState.callCount;
      renderCounts.blockEditorInner.rerenders = Math.max(0, blockEditorInnerHookState.callCount - 1);
      return actual.useVirtualBlockList(...args);
    },
  };
});

function mergeInstrumentedCounters(report: ScrollAttributionReport): ScrollAttributionReport {
  return {
    ...report,
    singleBlock: { ...renderCounts.singleBlock },
    toggleBlock: { ...renderCounts.toggleBlock },
    blockEditorInner: { ...renderCounts.blockEditorInner },
    virtualBlockList: { ...renderCounts.virtualBlockList },
    componentRenders: {
      ...report.componentRenders,
      SingleBlock: { ...renderCounts.singleBlock },
      ToggleBlock: { ...renderCounts.toggleBlock },
      BlockEditorInner: { ...renderCounts.blockEditorInner },
      VirtualBlockList: { ...renderCounts.virtualBlockList },
    },
  };
}

function resetInstrumentedCounters(): void {
  blockEditorInnerHookState.callCount = 0;
  (Object.keys(renderCounts) as (keyof typeof renderCounts)[]).forEach((key) => {
    const bucket = renderCounts[key];
    bucket.renders = 0;
    bucket.rerenders = 0;
    bucket.totalDurationMs = 0;
  });
}

describe('K-92A2 scroll attribution audit', () => {
  it('measures render vs layout during 5s fast scroll @ 1000 blocks', () => {
    resetInstrumentedCounters();

    const raw = runScrollAttributionAudit({
      blockCount: 1000,
      scrollDurationMs: 5000,
      scrollFps: 60,
      onScrollPhaseStart: resetInstrumentedCounters,
    });
    const report = mergeInstrumentedCounters(raw);

    // eslint-disable-next-line no-console
    console.log('\n' + formatScrollAttributionReport(report));

    expect(report.blockCount).toBe(1000);
    expect(report.scrollEventCount).toBeGreaterThanOrEqual(280);
    expect(report.scrollDurationMs).toBeGreaterThanOrEqual(4500);
    expect(report.mountedVirtualRows).toBeGreaterThan(0);
    expect(report.mountedVirtualRows).toBeLessThan(80);
    expect(Number.isFinite(report.renderToLayoutRatio)).toBe(true);
    expect(Number.isFinite(report.layoutToRenderRatio)).toBe(true);

    const top = topComponentsByRenderCount(report, 10);
    expect(top.length).toBeGreaterThan(0);
  }, 30_000);

  it('measures @ 2000 blocks (scale check)', () => {
    resetInstrumentedCounters();

    const raw = runScrollAttributionAudit({
      blockCount: 2000,
      scrollDurationMs: 5000,
      scrollFps: 60,
      onScrollPhaseStart: resetInstrumentedCounters,
    });
    const report = mergeInstrumentedCounters(raw);

    // eslint-disable-next-line no-console
    console.log('\n' + formatScrollAttributionReport(report));

    expect(report.blockCount).toBe(2000);
    expect(report.mountedVirtualRows).toBeLessThan(80);
  }, 45_000);
});
