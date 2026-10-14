// @vitest-environment happy-dom
import { act, createElement, startTransition, StrictMode, Suspense, useLayoutEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useHealthWorkoutOperationLifetime } from './useHealthWorkoutOperationLifetime';
import { captureHealthWorkoutOperationScope as capture, isCurrentHealthWorkoutOperationScope as current } from './healthWorkoutOperationScope';

type Owner = ReturnType<typeof useHealthWorkoutOperationLifetime>;
const X = '2026-08-24', Y = '2026-08-25', Z = '2026-08-26';
const account = { accountId: 'account-a', generation: 0 };
let root: Root, host: HTMLDivElement, settled: Owner;
let records: Array<{ date: string; owner: Owner; issued: Owner['publication']; admitted: boolean }>;
function Probe({ date = X, id = account.accountId, generation = 0, suspend }: {
  date?: string; id?: string; generation?: number; suspend?: Promise<void>;
}) {
  const owner = useHealthWorkoutOperationLifetime(id, generation, date);
  useLayoutEffect(() => {
    settled = owner;
    records.push({ date, owner, issued: owner.getCurrent(),
      admitted: !!capture(owner.publication, { accountId: id, generation }, date, owner.getCurrent(), () => true) });
  });
  if (suspend) throw suspend;
  return createElement('div', { 'data-date': date }, date);
}
async function render(props: Parameters<typeof Probe>[0] = {}, strict = false) {
  const node = createElement(Probe, props);
  await act(async () => root.render(strict ? createElement(StrictMode, null, node) : node));
}
beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  records = []; host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); });

describe('committed HealthView-local lifetime owner', () => {
  it('S08 first publication fences entry then binds handlers without an update loop', async () => {
    await render();
    expect(records[0].owner.publication).toBeNull(); expect(records[0].admitted).toBe(false);
    expect(records.at(-1)?.admitted).toBe(true);
    expect(settled.publication).toBe(settled.getCurrent());
    const token = settled.publication!.dateLifetime;
    for (let i = 0; i < 5; i++) await render({ date: X });
    expect(settled.publication!.dateLifetime).toBe(token);
  });
  it('R01 unrelated same-date rerender preserves token and getter', async () => {
    await render(); const first = settled;
    await render({ date: new Date(X + 'T00:00:00Z').toISOString().slice(0, 10) });
    expect(settled.publication).toBe(first.publication);
    expect(settled.getCurrent).toBe(first.getCurrent);
    expect(current(first.publication!, settled.getCurrent(), () => true)).toBe(true);
  });
  it('R02 returning X2 never revives retained X1 closure or scope', async () => {
    await render(); const first = settled;
    const retained = () => capture(first.publication, account, X, first.getCurrent(), () => true);
    expect(retained()).not.toBeNull();
    await render({ date: Y }); expect(retained()).toBeNull();
    await render({ date: X }); expect(retained()).toBeNull();
    expect(settled.publication!.dateLifetime).not.toBe(first.publication!.dateLifetime);
    expect(capture(settled.publication, account, X, settled.getCurrent(), () => true)).not.toBeNull();
  });
  it('R03 committed transitions rotate but a batched uncommitted round trip does not', async () => {
    await render(); const scopes = [settled.publication!];
    for (const date of [Y, Z, X]) { await render({ date }); scopes.push(settled.publication!); }
    expect(new Set(scopes.map(scope => scope.dateLifetime)).size).toBe(4);
    scopes.slice(0, -1).forEach(scope => expect(current(scope, settled.getCurrent(), () => true)).toBe(false));
    const last = settled.publication;
    await act(async () => { root.render(createElement(Probe, { date: Y })); root.render(createElement(Probe, { date: X })); });
    expect(settled.publication).toBe(last);
  });
  it('R04 StrictMode retires replayed setup and admits only the settled replacement', async () => {
    await render({}, true);
    const issued = records.map(record => record.issued).filter(Boolean);
    expect(new Set(issued.map(scope => scope!.dateLifetime)).size).toBeGreaterThan(1);
    for (const scope of issued) if (scope !== settled.getCurrent()) expect(current(scope!, settled.getCurrent(), () => true)).toBe(false);
    expect(settled.publication).toBe(settled.getCurrent());
    expect(capture(settled.publication, account, X, settled.getCurrent(), () => true)).not.toBeNull();
  });
  it('R05 suspended abandoned Y render does not mint or retire committed X', async () => {
    const blocked = new Promise<void>(() => undefined);
    const tree = (date: string, suspend?: Promise<void>) => createElement(Suspense,
      { fallback: createElement('div', { 'data-fallback': true }, 'pending') }, createElement(Probe, { date, suspend }));
    await act(async () => root.render(tree(X))); const first = settled;
    await act(async () => startTransition(() => root.render(tree(Y, blocked))));
    expect(host.querySelector('[data-date]')?.textContent).toBe(X);
    expect(first.getCurrent()).toBe(first.publication);
    expect(current(first.publication!, first.getCurrent(), () => true)).toBe(true);
    await act(async () => root.render(tree(X)));
    expect(settled.publication).toBe(first.publication);
  });
  it('R05 committed layout disconnection retires; reconnect issues fresh authority', async () => {
    const blocked = new Promise<void>(() => undefined);
    const tree = (suspend?: Promise<void>) => createElement(Suspense,
      { fallback: createElement('div', { 'data-fallback': true }) }, createElement(Probe, { date: X, suspend }));
    await act(async () => root.render(tree())); const first = settled;
    act(() => flushSync(() => root.render(tree(blocked))));
    expect(host.querySelector('[data-fallback]')).not.toBeNull(); expect(first.getCurrent()).toBeNull();
    await act(async () => root.render(tree()));
    expect(settled.publication!.dateLifetime).not.toBe(first.publication!.dateLifetime);
    expect(current(first.publication!, settled.getCurrent(), () => true)).toBe(false);
  });
  it('R06 logout, account ABA and same-account/date remount retire old scopes', async () => {
    await render(); const first = settled;
    await render({ id: '' }); expect(settled.getCurrent()).toBeNull();
    await render({ id: 'account-b', generation: 1 }); await render({ id: account.accountId, generation: 2 });
    expect(current(first.publication!, settled.getCurrent(), () => true)).toBe(false);
    const second = settled; act(() => root.unmount()); expect(second.getCurrent()).toBeNull();
    root = createRoot(host); await render();
    expect(settled.publication!.dateLifetime).not.toBe(second.publication!.dateLifetime);
  });
});
