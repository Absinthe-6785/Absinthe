/**
 * UX-5E.1B — Root block virtualization POC feature flag.
 * Default off; production behavior unchanged unless explicitly enabled.
 */

/** Test-only override (null = use env). */
let testOverride: boolean | null = null;

export function setVirtualBlocksPocOverride(value: boolean | null): void {
  testOverride = value;
}

export function getVirtualBlocksPocOverride(): boolean | null {
  return testOverride;
}

/** Env: VITE_VIRTUAL_BLOCKS_POC=true */
export function isVirtualBlocksPocEnabled(propOverride?: boolean): boolean {
  if (propOverride !== undefined) return propOverride;
  if (testOverride !== null) return testOverride;
  return import.meta.env.VITE_VIRTUAL_BLOCKS_POC === 'true';
}
