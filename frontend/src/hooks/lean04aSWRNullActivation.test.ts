// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import useSWR, { SWRConfig } from 'swr';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type ProbeProps = {
  active: boolean;
  account: string;
  date: string;
  fetcher: (key: readonly [string, string, string]) => Promise<string[]>;
};

function Probe({ active, account, date, fetcher }: ProbeProps) {
  const { data = [] } = useSWR(
    active ? ['lean04a-activation', account, date] as const : null,
    fetcher,
    { dedupingInterval: 0, revalidateOnFocus: false },
  );
  return createElement('output', { 'data-testid': 'lean04a-swr-value' }, data.join('|'));
}

async function flush(): Promise<void> {
  for (let i = 0; i < 6; i += 1) {
    await act(async () => {
      await new Promise<void>(resolve => setTimeout(resolve, 0));
    });
  }
}

describe('LEAN_04A null-key activation semantics', () => {
  let root: Root | null = null;
  let host: HTMLDivElement | null = null;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  afterEach(() => {
    if (root) act(() => root?.unmount());
    host?.remove();
    root = null;
    host = null;
  });

  it('suppresses inactive fetches, activates with the current account/date, and revalidates after a later activation', async () => {
    let version = 'A';
    const calls: Array<readonly [string, string, string]> = [];
    const fetcher = async (key: readonly [string, string, string]) => {
      calls.push(key);
      return [`${key[1]}:${key[2]}:${version}`];
    };
    const cache = new Map();
    const config = { provider: () => cache, dedupingInterval: 0 };

    await act(async () => {
      root = createRoot(host!);
      root.render(createElement(SWRConfig, { value: config }, createElement(Probe, {
        active: false, account: 'account-a', date: '2026-08-18', fetcher,
      })));
    });
    await flush();
    expect(calls).toHaveLength(0);

    act(() => {
      root?.render(createElement(SWRConfig, { value: config }, createElement(Probe, {
        active: true, account: 'account-a', date: '2026-08-18', fetcher,
      })));
    });
    await flush();
    expect(calls).toEqual([['lean04a-activation', 'account-a', '2026-08-18']]);
    expect(host?.querySelector('[data-testid="lean04a-swr-value"]')?.textContent).toBe('account-a:2026-08-18:A');

    act(() => {
      root?.render(createElement(SWRConfig, { value: config }, createElement(Probe, {
        active: false, account: 'account-a', date: '2026-08-18', fetcher,
      })));
    });
    version = 'B';
    act(() => {
      root?.render(createElement(SWRConfig, { value: config }, createElement(Probe, {
        active: true, account: 'account-a', date: '2026-08-18', fetcher,
      })));
    });
    await flush();
    expect(calls).toHaveLength(2);
    expect(host?.querySelector('[data-testid="lean04a-swr-value"]')?.textContent).toBe('account-a:2026-08-18:B');

    act(() => {
      root?.render(createElement(SWRConfig, { value: config }, createElement(Probe, {
        active: true, account: 'account-b', date: '2026-08-19', fetcher,
      })));
    });
    await flush();
    expect(calls.at(-1)).toEqual(['lean04a-activation', 'account-b', '2026-08-19']);
    expect(host?.querySelector('[data-testid="lean04a-swr-value"]')?.textContent).toBe('account-b:2026-08-19:B');
  });
});
