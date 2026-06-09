/**
 * UX-5E.1F — Root block virtualization (default on in production).
 *
 * Resolution order:
 * 1. BlockEditor `virtualBlocksPoc` prop (tests / explicit override)
 * 2. Test-only overrides (`setVirtualBlocksPocOverride` / `setVirtualBlocksDisableOverride`)
 * 3. `VITE_DISABLE_VIRTUAL_BLOCKS=true` — opt-out
 * 4. `VITE_VIRTUAL_BLOCKS_POC=false` — legacy opt-out
 * 5. Default: **enabled**
 */

/** Test-only force-enable (null = use env/default). */
let testOverride: boolean | null = null;
/** Test-only force-disable (null = use env/default). */
let testDisableOverride: boolean | null = null;

export function setVirtualBlocksPocOverride(value: boolean | null): void {
  testOverride = value;
}

export function getVirtualBlocksPocOverride(): boolean | null {
  return testOverride;
}

export function setVirtualBlocksDisableOverride(value: boolean | null): void {
  testDisableOverride = value;
}

export function getVirtualBlocksDisableOverride(): boolean | null {
  return testDisableOverride;
}

export function isVirtualBlocksEnvOptedOut(): boolean {
  return import.meta.env.VITE_DISABLE_VIRTUAL_BLOCKS === 'true'
    || import.meta.env.VITE_VIRTUAL_BLOCKS_POC === 'false';
}

/** Whether root block virtualization is active. */
export function isVirtualBlocksPocEnabled(propOverride?: boolean): boolean {
  if (propOverride !== undefined) return propOverride;
  if (testDisableOverride === true) return false;
  if (testOverride !== null) return testOverride;
  if (isVirtualBlocksEnvOptedOut()) return false;
  return true;
}
