import { describe, expect, it } from 'vitest';
import {
  COSMOS_LEGACY_SIM_RENDER_DIVISOR,
  COSMOS_SIM_SETTLE_RENDER_DIVISOR,
  countReactCommitsDuringSimTicks,
  shouldCommitRenderOnSimFrame,
  shouldSuppressSettleDecorations,
} from './cosmosRenderThrottle';

describe('cosmosRenderThrottle', () => {
  it('commits every Nth sim frame', () => {
    expect(shouldCommitRenderOnSimFrame(1, 4)).toBe(false);
    expect(shouldCommitRenderOnSimFrame(4, 4)).toBe(true);
    expect(shouldCommitRenderOnSimFrame(8, 4)).toBe(true);
  });

  it('counts commits for settle ticks', () => {
    expect(countReactCommitsDuringSimTicks(127, COSMOS_LEGACY_SIM_RENDER_DIVISOR)).toBe(43);
    expect(countReactCommitsDuringSimTicks(127, COSMOS_SIM_SETTLE_RENDER_DIVISOR)).toBe(32);
  });

  it('suppresses decorations only while settling', () => {
    expect(shouldSuppressSettleDecorations(true)).toBe(true);
    expect(shouldSuppressSettleDecorations(false)).toBe(false);
  });
});
