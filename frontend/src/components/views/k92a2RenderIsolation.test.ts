// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { getRenderDiagnostics, resetRenderDiagnostics } from './noteview/renderDiagnostics';
import { runScrollAttributionAudit } from './k92a2ScrollAttributionAudit';

describe('K-92A2 virtual scroll render isolation', () => {
  it('scroll rerenders VirtualBlockScrollHost but not BlockEditorInner', () => {
    resetRenderDiagnostics();

    runScrollAttributionAudit({
      blockCount: 1000,
      scrollDurationMs: 5000,
      scrollFps: 60,
      onScrollPhaseStart: resetRenderDiagnostics,
    });

    const diagnostics = getRenderDiagnostics();
    expect(diagnostics.BlockEditorInner?.rerenders ?? 0).toBe(0);
    expect(diagnostics.VirtualBlockScrollHost?.rerenders ?? 0).toBeGreaterThan(0);
  }, 30_000);
});
