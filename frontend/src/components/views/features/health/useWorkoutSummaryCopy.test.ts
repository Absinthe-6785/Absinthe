// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useWorkoutSummaryCopy, type WorkoutSummaryCopyContext } from './useWorkoutSummaryCopy';

const writer = vi.hoisted(() => ({ write: vi.fn<(text: string) => Promise<boolean>>() }));
vi.mock('./workoutSummaryClipboard', () => ({ writeWorkoutSummaryClipboard: writer.write }));

interface HarnessProps {
  readonly context: WorkoutSummaryCopyContext;
  readonly isCurrent: (token: { accountId: string; generation: number }) => boolean;
}

function Harness({ context, isCurrent }: HarnessProps) {
  const copy = useWorkoutSummaryCopy(context, isCurrent);
  return createElement('div', null,
    createElement('button', { type: 'button', onClick: () => { void copy.copy(); } }, 'copy'),
    createElement('output', { 'data-copy-status': copy.status ?? 'none' }, copy.status ?? 'none'));
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

const context = (overrides: Partial<WorkoutSummaryCopyContext> = {}): WorkoutSummaryCopyContext => ({
  accountId: 'A', generation: 1, dateKey: '2026-11-07', summaryText: '📅 오늘\n\n스쿼트', ...overrides,
});

describe('useWorkoutSummaryCopy', () => {
  let host: HTMLDivElement;
  let root: Root | null;

  const render = (owner: WorkoutSummaryCopyContext, current = () => true) => {
    act(() => root!.render(createElement(Harness, { context: owner, isCurrent: current })));
  };
  const click = () => act(() => host.querySelector('button')!.click());
  const status = () => host.querySelector('output')?.getAttribute('data-copy-status');
  const flush = async () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

  beforeEach(() => {
    vi.useRealTimers();
    writer.write.mockReset().mockResolvedValue(true);
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    if (root) act(() => root!.unmount());
    root = null;
    host.remove();
    vi.useRealTimers();
  });

  it('passes exact Unicode text and shows success only after confirmed completion', async () => {
    const pending = deferred<boolean>();
    writer.write.mockReturnValueOnce(pending.promise);
    const owner = context();
    render(owner);
    click();
    expect(writer.write).toHaveBeenCalledExactlyOnceWith(owner.summaryText);
    expect(status()).toBe('none');
    await act(async () => pending.resolve(true));
    expect(status()).toBe('copied');
  });

  it('shows failure when the clipboard operation is unsuccessful', async () => {
    writer.write.mockResolvedValueOnce(false);
    render(context());
    click();
    await flush();
    expect(status()).toBe('failed');
  });

  it('suppresses pending completion across account A-B-A generations', async () => {
    const pending = deferred<boolean>();
    writer.write.mockReturnValueOnce(pending.promise);
    const a1 = context();
    let live = { accountId: 'A', generation: 1 };
    const isCurrent = (token: { accountId: string; generation: number }) => token.accountId === live.accountId && token.generation === live.generation;
    render(a1, isCurrent);
    click();
    live = { accountId: 'B', generation: 2 };
    render(context({ accountId: 'B', generation: 2 }), isCurrent);
    live = { accountId: 'A', generation: 3 };
    render(context({ generation: 3 }), isCurrent);
    await act(async () => pending.resolve(true));
    expect(status()).toBe('none');
  });

  it('suppresses completion after selected-date or summary-source replacement', async () => {
    for (const replacement of [
      context({ dateKey: '2026-11-08' }),
      context({ summaryText: 'replacement source' }),
    ]) {
      const pending = deferred<boolean>();
      writer.write.mockReturnValueOnce(pending.promise);
      render(context());
      click();
      render(replacement);
      await act(async () => pending.resolve(true));
      expect(status()).toBe('none');
    }
  });

  it('does not start a clipboard write for a stale account token', () => {
    render(context(), () => false);
    click();
    expect(writer.write).not.toHaveBeenCalled();
    expect(status()).toBe('none');
  });

  it('lets the newest copy own feedback when requests overlap', async () => {
    const first = deferred<boolean>(), second = deferred<boolean>();
    writer.write.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    render(context());
    click();
    click();
    await act(async () => first.resolve(false));
    expect(status()).toBe('none');
    await act(async () => second.resolve(true));
    expect(status()).toBe('copied');
  });

  it('clears feedback timers on source invalidation and unmount', async () => {
    vi.useFakeTimers();
    render(context());
    click();
    await flush();
    expect(status()).toBe('copied');
    expect(vi.getTimerCount()).toBe(1);
    render(context({ dateKey: '2026-11-08' }));
    expect(status()).toBe('none');
    expect(vi.getTimerCount()).toBe(0);
    click();
    await flush();
    expect(vi.getTimerCount()).toBe(1);
    act(() => { root!.unmount(); root = null; });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not let an old clear timer erase newer feedback', async () => {
    vi.useFakeTimers();
    const first = deferred<boolean>(), second = deferred<boolean>();
    writer.write.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    render(context());
    click();
    await act(async () => first.resolve(true));
    expect(status()).toBe('copied');
    click();
    expect(status()).toBe('none');
    await act(async () => vi.advanceTimersByTimeAsync(2000));
    await act(async () => second.resolve(true));
    expect(status()).toBe('copied');
  });
});
