// @vitest-environment happy-dom
import { createElement, StrictMode } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CompositeWorkoutReadResult } from './compositeWorkoutReadProjection';
import type { WorkoutRangeView } from './verifiedWorkoutRangeSnapshot';
import {
  useHealthWorkoutRangeSnapshot,
  type HealthWorkoutRangeReadModel,
  type WorkoutRangeBounds,
} from './useHealthWorkoutRangeSnapshot';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

const complete: CompositeWorkoutReadResult = {
  status: 'complete', legacyStatus: 'success', canonicalStatus: 'success', records: [],
};

function range(accountId: string, startDate: string, endDate: string): WorkoutRangeView {
  return { accountId, scope: null, startDate, endDate, result: complete, dates: [] };
}

function coordinator(accountId: string) {
  const value = {
    currentSnapshot: null as object | null,
    load: vi.fn(async () => {
      value.currentSnapshot = {};
      return { accountId, scope: null, result: complete };
    }),
    deriveRange: vi.fn(async (startDate: string, endDate: string) => range(accountId, startDate, endDate)),
    invalidate: vi.fn(() => { value.currentSnapshot = null; }),
    close: vi.fn(() => { value.currentSnapshot = null; }),
  };
  return value;
}

let host: HTMLDivElement;
let root: Root | null;
let latest: HealthWorkoutRangeReadModel;
const previous = (endDate = '2026-09-29'): WorkoutRangeBounds => ({ startDate: '2025-09-29', endDate });
const month = (startDate = '2026-09-01'): WorkoutRangeBounds => ({ startDate, endDate: startDate.slice(0, 8) + '30' });

function Harness({ enabled = true, accountId = 'a', previousBounds = previous(), monthBounds = month(), createCoordinator }: {
  enabled?: boolean;
  accountId?: string;
  previousBounds?: WorkoutRangeBounds;
  monthBounds?: WorkoutRangeBounds;
  createCoordinator: (accountId: string, storage: Storage) => ReturnType<typeof coordinator>;
}) {
  latest = useHealthWorkoutRangeSnapshot(enabled, accountId, previousBounds, monthBounds, {
    createCoordinator: createCoordinator as never,
    deviceStorage: window.localStorage,
  });
  return createElement('div', { 'data-phase': latest.phase });
}

async function render(props: Parameters<typeof Harness>[0], strict = false) {
  await act(async () => {
    root ??= createRoot(host);
    root.render(strict
      ? createElement(StrictMode, null, createElement(Harness, props))
      : createElement(Harness, props));
  });
}

async function flush() {
  await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
}

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = null;
});

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  host.remove();
});

describe('single Workout range snapshot hook', () => {
  it('does no work while disabled', async () => {
    const create = vi.fn(coordinator);
    await render({ enabled: false, createCoordinator: create });
    await flush();
    expect(create).not.toHaveBeenCalled();
    expect(latest.phase).toBe('disabled');
  });

  it('loads one source snapshot and derives Previous plus calendar from it', async () => {
    const owner = coordinator('a');
    const create = vi.fn(() => owner);
    await render({ createCoordinator: create });
    await flush();
    expect(create).toHaveBeenCalledTimes(1);
    expect(owner.load).toHaveBeenCalledTimes(1);
    expect(owner.deriveRange).toHaveBeenCalledTimes(2);
    expect(latest.previousView).toMatchObject(previous());
    expect(latest.monthView).toMatchObject(month());
    expect(latest.phase).toBe('settled');
  });

  it('re-derives changed month/reference bounds without rescanning sources or retaining visited ranges', async () => {
    const owner = coordinator('a');
    const create = vi.fn(() => owner);
    await render({ createCoordinator: create });
    await flush();
    await render({ createCoordinator: create, previousBounds: previous('2026-10-01'), monthBounds: month('2026-10-01') });
    await flush();
    expect(owner.load).toHaveBeenCalledTimes(1);
    expect(owner.deriveRange).toHaveBeenCalledTimes(4);
    expect(latest.previousView?.endDate).toBe('2026-10-01');
    expect(latest.monthView?.startDate).toBe('2026-10-01');
    expect(Object.keys(latest)).not.toContain('cache');
  });

  it('invalidates synchronously on retry and fences a late old load', async () => {
    const first = deferred<{ accountId: string; scope: null; result: CompositeWorkoutReadResult } | null>();
    const owner = coordinator('a');
    owner.load.mockImplementationOnce(() => first.promise).mockImplementationOnce(async () => {
      owner.currentSnapshot = {};
      return { accountId: 'a', scope: null, result: complete };
    });
    const create = vi.fn(() => owner);
    await render({ createCoordinator: create });
    await act(async () => latest.invalidateAndReload());
    expect(owner.invalidate).toHaveBeenCalledTimes(1);
    await flush();
    expect(latest.phase).toBe('settled');
    first.resolve({ accountId: 'a', scope: null, result: complete });
    await flush();
    expect(owner.deriveRange).toHaveBeenCalledTimes(2);
    expect(owner.load).toHaveBeenCalledTimes(2);
  });

  it('fences A→B→A and closes each superseded coordinator', async () => {
    const owners: ReturnType<typeof coordinator>[] = [];
    const create = vi.fn((accountId: string) => {
      const owner = coordinator(accountId);
      owners.push(owner);
      return owner;
    });
    await render({ accountId: 'a', createCoordinator: create }); await flush();
    await render({ accountId: 'b', createCoordinator: create }); await flush();
    await render({ accountId: 'a', createCoordinator: create }); await flush();
    expect(owners).toHaveLength(3);
    expect(owners[0]?.close).toHaveBeenCalled();
    expect(owners[1]?.close).toHaveBeenCalled();
    expect(latest.accountId).toBe('a');
  });

  it('cleans StrictMode instances without installing any global listener', async () => {
    const addWindow = vi.spyOn(window, 'addEventListener');
    const addDocument = vi.spyOn(document, 'addEventListener');
    const owners: ReturnType<typeof coordinator>[] = [];
    const create = vi.fn((accountId: string) => {
      const owner = coordinator(accountId); owners.push(owner); return owner;
    });
    await render({ createCoordinator: create }, true); await flush();
    expect(owners.length).toBeGreaterThanOrEqual(2);
    expect(owners[0]?.close).toHaveBeenCalled();
    expect(addWindow).not.toHaveBeenCalled();
    expect(addDocument).not.toHaveBeenCalled();
  });
});
