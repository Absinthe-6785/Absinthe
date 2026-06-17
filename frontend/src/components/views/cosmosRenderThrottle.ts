/**
 * K-92B3A — Cosmos render throttle policy during force simulation settle.
 */

/** Pre-K-92B3A production divisor (audit baseline). */
export const COSMOS_LEGACY_SIM_RENDER_DIVISOR = 3;

/** Commit React render every Nth simulation rAF frame while alpha >= floor. */
export const COSMOS_SIM_SETTLE_RENDER_DIVISOR = 4;

export function shouldCommitRenderOnSimFrame(
  renderTickRefValue: number,
  divisor = COSMOS_SIM_SETTLE_RENDER_DIVISOR,
): boolean {
  if (divisor <= 1) return true;
  return renderTickRefValue % divisor === 0;
}

export function countReactCommitsDuringSimTicks(
  simTicks: number,
  divisor = COSMOS_SIM_SETTLE_RENDER_DIVISOR,
): number {
  if (simTicks <= 0) return 0;
  return Math.ceil(simTicks / divisor);
}

/** Decorative SVG (labels, nebula, glow, orbits) hidden while sim is settling. */
export function shouldSuppressSettleDecorations(simSettling: boolean): boolean {
  return simSettling;
}
