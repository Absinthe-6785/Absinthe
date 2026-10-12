// @vitest-environment happy-dom
import { createElement, StrictMode } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { PreviousScope } from './legacyPreviousCurrentness';
const mocks = vi.hoisted(() => ({ load: vi.fn(async () => ({})) }));
vi.mock('./prevWorkoutFetch', () => ({ fetchPrevWorkoutForBlocks: mocks.load }));
vi.mock('../../../../lib/healthSupabaseBootstrap', () => ({ HEALTH_LOCAL_BOOTSTRAP_COMPLETE_EVENT: 'previous-bootstrap' }));
import { useLegacyPreviousCurrentness } from './useLegacyPreviousCurrentness';
let host: HTMLDivElement, root: Root;
let latest: ReturnType<typeof useLegacyPreviousCurrentness>;
const scope: PreviousScope = { accountId: 'a', beforeDate: '2026-10-12', authority: 'local', parentIdentity: null, rejected: false };
function Harness({ enabled, query = scope }: { enabled: boolean; query?: PreviousScope }) {
  latest = useLegacyPreviousCurrentness(enabled, query);
  return createElement('div', { 'data-current': latest.current });
}
const tick = async () => { await act(async () => { for (let n = 0; n < 10; n++) await Promise.resolve(); }); };
const render = async (enabled = true, query = scope) => {
  await act(async () => root.render(createElement(StrictMode, null, createElement(Harness, { enabled, query }))));
};
beforeEach(() => {
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host); mocks.load.mockClear();
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.restoreAllMocks(); });
it('OFF has zero read/focus/bootstrap subscriptions and no owner publication', async () => {
  const win = vi.spyOn(window, 'addEventListener'), doc = vi.spyOn(document, 'addEventListener');
  await render(false);
  act(() => window.dispatchEvent(new Event('focus'))); act(() => window.dispatchEvent(new Event('previous-bootstrap')));
  await tick(); expect(mocks.load).not.toHaveBeenCalled(); expect(latest.current).toBe(false);
  expect(win.mock.calls.filter(([name]) => ['focus', 'previous-bootstrap'].includes(name))).toHaveLength(0);
  expect(doc.mock.calls.filter(([name]) => name === 'visibilitychange')).toHaveLength(0);
});
it('C14 offline retains proof, focus/visibility burst costs one batch; bootstrap burst one more', async () => {
  await render(); await act(async () => { await latest.owner.ensure(['b1', 'b2', 'b3']); });
  const first = latest.owner.evidence('b1'); expect(mocks.load).toHaveBeenCalledTimes(1);
  act(() => window.dispatchEvent(new Event('offline'))); expect(latest.owner.qualified(first)).toBe(true);
  act(() => { for (let n = 0; n < 20; n++) { window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')); } });
  expect(latest.owner.qualified(first)).toBe(false); await tick(); expect(mocks.load).toHaveBeenCalledTimes(2);
  act(() => { for (let n = 0; n < 20; n++) window.dispatchEvent(new Event('previous-bootstrap')); });
  await tick(); expect(mocks.load).toHaveBeenCalledTimes(3);
});
it('hidden interval revokes immediately and visible recovery requalifies (even in the focus debounce window)', async () => {
  await render(); await act(async () => { await latest.owner.ensure(['b1']); });
  act(() => window.dispatchEvent(new Event('focus'))); await tick();
  const old = latest.owner.evidence('b1');
  const visible = vi.spyOn(document, 'visibilityState', 'get'); visible.mockReturnValue('hidden');
  act(() => document.dispatchEvent(new Event('visibilitychange'))); expect(latest.owner.qualified(old)).toBe(false);
  visible.mockReturnValue('visible'); act(() => document.dispatchEvent(new Event('visibilitychange'))); await tick();
  expect(latest.owner.evidence('b1').state).toBe('NO_MATCH'); expect(mocks.load).toHaveBeenCalledTimes(3);
});
it('committed query changes and typed rejection synchronously invalidate old proof, not child revisions', async () => {
  await render(); await act(async () => { await latest.owner.ensure(['b1']); }); const old = latest.owner.evidence('b1');
  await render(true, { ...scope, parentIdentity: 'device/ns/g2' }); expect(latest.owner.qualified(old)).toBe(false);
  await act(async () => { await latest.owner.ensure(['b1']); }); const next = latest.owner.evidence('b1');
  await render(true, { ...scope, rejected: true }); expect(latest.current).toBe(false); expect(latest.owner.qualified(next)).toBe(false);
});
