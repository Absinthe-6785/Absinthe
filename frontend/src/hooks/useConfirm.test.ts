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

function Harness({ destructiveAction }: { destructiveAction: () => void | Promise<void> }) {
  const { confirm, showConfirm, clearConfirm, handleConfirm } = useConfirm();
  return createElement(
    'div',
    null,
    createElement('button', {
      type: 'button',
      'data-open-confirm': true,
      onClick: () => showConfirm('Delete folder Research?', destructiveAction),
    }, 'open'),
    createElement('button', {
      type: 'button',
      'data-repeat-confirm': true,
      onClick: () => { void handleConfirm(); void handleConfirm(); },
    }, 'repeat'),
    confirm && createElement(ConfirmModal, {
      message: confirm.message,
      onConfirm: handleConfirm,
      onCancel: clearConfirm,
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

  function open(destructiveAction: () => void | Promise<void>) {
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
});
