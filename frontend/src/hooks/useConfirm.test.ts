// @vitest-environment happy-dom
import { StrictMode, createElement } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { useConfirm } from './useConfirm';

vi.mock('../lib/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

function Harness({ destructiveAction }: { destructiveAction: (reconfirm: () => void) => void | Promise<void> }) {
  const { confirm, showConfirm, clearConfirm, handleConfirm } = useConfirm();
  const openSecond = () => showConfirm(
    'Delete folder Research renamed? Affected notes: 2.',
    () => destructiveAction(openSecond),
  );
  return createElement(
    'div',
    null,
    createElement('button', {
      type: 'button',
      'data-open-confirm': true,
      onClick: () => showConfirm(
        'Delete folder Research? Affected notes: 1.',
        () => destructiveAction(openSecond),
      ),
    }, 'open'),
    createElement('button', {
      type: 'button',
      'data-repeat-confirm': true,
      onClick: () => {
        if (!confirm) return;
        void handleConfirm(confirm.requestId);
        void handleConfirm(confirm.requestId);
      },
    }, 'repeat'),
    confirm && createElement(ConfirmModal, {
      key: confirm.requestId,
      message: confirm.message,
      onConfirm: () => handleConfirm(confirm.requestId),
      onCancel: () => { clearConfirm(confirm.requestId); },
    }),
  );
}

describe('useConfirm destructive callback authority', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    delete (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  });

  function open(destructiveAction: (reconfirm: () => void) => void | Promise<void>) {
    act(() => root.render(createElement(
      StrictMode,
      null,
      createElement(Harness, { destructiveAction }),
    )));
    act(() => host.querySelector<HTMLButtonElement>('[data-open-confirm]')!.click());
  }

  it('cancels without invoking the destructive callback', () => {
    const destructiveAction = vi.fn();
    open(destructiveAction);

    const dialog = host.querySelector<HTMLElement>('[role="dialog"]')!;
    act(() => dialog.querySelectorAll<HTMLButtonElement>('button')[0]!.click());

    expect(destructiveAction).not.toHaveBeenCalled();
    expect(host.querySelector('[role="dialog"]')).toBeNull();
  });

  it('consumes repeated confirmation delivery exactly once', async () => {
    const destructiveAction = vi.fn(async () => Promise.resolve());
    open(destructiveAction);

    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-repeat-confirm]')!.click();
      await Promise.resolve();
    });

    expect(destructiveAction).toHaveBeenCalledTimes(1);
    expect(host.querySelector('[role="dialog"]')).toBeNull();
  });

  it('cannot let a stale repeated handler consume a synchronously rearmed request', async () => {
    let first = true;
    const destructiveAction = vi.fn((reconfirm: () => void) => {
      if (first) {
        first = false;
        reconfirm();
      }
    });
    open(destructiveAction);

    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-repeat-confirm]')!.click();
      await Promise.resolve();
    });

    const dialog = host.querySelector<HTMLElement>('[role="dialog"]')!;
    expect(dialog.textContent).toContain('Research renamed');
    expect(dialog.textContent).toContain('Affected notes: 2.');
    expect(destructiveAction).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(dialog.querySelectorAll<HTMLButtonElement>('button')[0]);

    await act(async () => {
      dialog.querySelectorAll<HTMLButtonElement>('button')[1]!.click();
      await Promise.resolve();
    });
    expect(destructiveAction).toHaveBeenCalledTimes(2);
  });
});
