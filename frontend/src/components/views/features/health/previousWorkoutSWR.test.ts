// @vitest-environment happy-dom
import { act, createElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import useSWR, { SWRConfig } from 'swr';
import { describe, expect, it } from 'vitest';
import { previousWorkoutSWRConfig } from './previousWorkoutSWR';

type ProbeProps = {
  open: boolean;
  fetchRows: () => Promise<string[]>;
};

function PreviousRangeProbe({ open, fetchRows }: ProbeProps) {
  const { data = [] } = useSWR(open ? 'previous-range-A' : null, fetchRows, previousWorkoutSWRConfig);
  return createElement('output', { 'data-previous-range': 'true' }, data.join(','));
}

function Harness({ open, fetchRows }: ProbeProps) {
  return createElement(PreviousRangeProbe, { open, fetchRows });
}

function mount(node: ReactNode): { root: Root; container: HTMLDivElement; unmount: () => void } {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => { root.render(node); });
  return {
    root,
    container,
    unmount: () => {
      act(() => { root.unmount(); });
      container.remove();
    },
  };
}

async function flush(): Promise<void> {
  for (let i = 0; i < 5; i += 1) {
    await act(async () => {
      await new Promise<void>(resolve => setTimeout(resolve, 0));
    });
  }
}

describe('previousWorkoutSWR', () => {
  it('revalidates a cached range after close, historical mutation, and reopen', async () => {
    let rows = ['B:old'];
    let fetchCount = 0;
    const fetchRows = async () => {
      fetchCount += 1;
      return [...rows];
    };
    const cache = new Map();
    const config = { provider: () => cache, dedupingInterval: 0 };
    const first = mount(createElement(SWRConfig, { value: config },
      createElement(Harness, { open: true, fetchRows }),
    ));

    await flush();
    expect(first.container.querySelector('[data-previous-range]')?.textContent).toBe('B:old');
    expect(fetchCount).toBe(1);

    act(() => {
      first.root.render(createElement(SWRConfig, { value: config },
        createElement(Harness, { open: false, fetchRows }),
      ));
    });
    rows = ['B:new'];
    act(() => {
      first.root.render(createElement(SWRConfig, { value: config },
        createElement(Harness, { open: true, fetchRows }),
      ));
    });

    await flush();
    expect(first.container.querySelector('[data-previous-range]')?.textContent).toBe('B:new');
    expect(fetchCount).toBe(2);
    first.unmount();
  });

  it('revalidates cached data when the history renderer remounts', async () => {
    let rows = ['B:old'];
    let fetchCount = 0;
    const fetchRows = async () => {
      fetchCount += 1;
      return [...rows];
    };
    const cache = new Map();
    const config = { provider: () => cache, dedupingInterval: 0 };
    const first = mount(createElement(SWRConfig, { value: config },
      createElement(PreviousRangeProbe, { open: true, fetchRows }),
    ));

    await flush();
    expect(fetchCount).toBe(1);
    rows = ['B:new'];
    act(() => {
      first.root.render(createElement(SWRConfig, { value: config }, null));
    });
    act(() => {
      first.root.render(createElement(SWRConfig, { value: config },
        createElement(PreviousRangeProbe, { open: true, fetchRows }),
      ));
    });

    await flush();
    expect(first.container.querySelector('[data-previous-range]')?.textContent).toBe('B:new');
    expect(fetchCount).toBe(2);
    first.unmount();
  });
});
