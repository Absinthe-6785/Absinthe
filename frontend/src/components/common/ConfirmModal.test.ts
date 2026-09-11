// @vitest-environment happy-dom
import { StrictMode, createElement, useState } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmModal } from './ConfirmModal';
import { WORKSPACE_SURFACE_ROLE } from './workspaceCardSizes';

vi.mock('../../lib/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

function ConfirmHarness({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  const [open, setOpen] = useState(false);
  return createElement(
    'div',
    null,
    createElement('button', { type: 'button', onClick: () => setOpen(true), 'data-confirm-trigger': true }, 'open'),
    open && createElement(ConfirmModal, {
      message: 'Delete this item?',
      onCancel: () => { onCancel(); setOpen(false); },
      onConfirm: () => { onConfirm(); setOpen(false); },
    }),
  );
}

describe('ConfirmModal interaction contract', () => {
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

  function renderHarness(onConfirm = vi.fn(), onCancel = vi.fn()) {
    act(() => root.render(createElement(StrictMode, null, createElement(ConfirmHarness, { onConfirm, onCancel }))));
    const trigger = host.querySelector<HTMLButtonElement>('[data-confirm-trigger]')!;
    trigger.focus();
    act(() => trigger.click());
    const dialog = host.querySelector<HTMLElement>('[role="dialog"]')!;
    const buttons = [...dialog.querySelectorAll<HTMLButtonElement>('button')];
    return { trigger, dialog, cancel: buttons[0]!, confirm: buttons[1]!, onConfirm, onCancel };
  }

  it('provides valid dialog semantics and initially focuses the safe cancel action', () => {
    const { dialog, cancel } = renderHarness();
    const titleId = dialog.getAttribute('aria-labelledby');
    const backdrop = dialog.parentElement!;

    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(titleId).toBe('confirm-modal-title');
    expect(dialog.querySelector(`#${titleId}`)?.textContent).toBe('Delete this item?');
    expect(document.activeElement).toBe(cancel);
    expect(cancel.className).toContain('abs-focus-ring');
    expect(backdrop.classList.contains('bg-overlay')).toBe(true);
    expect(backdrop.style.background).toBe('');
    for (const surfaceClass of WORKSPACE_SURFACE_ROLE.modal.colorClass.split(/\s+/)) {
      expect(dialog.classList.contains(surfaceClass)).toBe(true);
    }
  });

  it('contains forward, backward, and outside Tab movement', () => {
    const { trigger, cancel, confirm } = renderHarness();

    confirm.focus();
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })));
    expect(document.activeElement).toBe(cancel);

    cancel.focus();
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true })));
    expect(document.activeElement).toBe(confirm);

    trigger.focus();
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })));
    expect(document.activeElement).toBe(cancel);
  });

  it('dismisses on Escape without confirming and restores focus under StrictMode', () => {
    const { trigger, onCancel, onConfirm } = renderHarness();

    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('preserves backdrop and callback semantics without double invocation', () => {
    const first = renderHarness();
    act(() => first.dialog.click());
    expect(first.onCancel).not.toHaveBeenCalled();

    act(() => first.dialog.parentElement!.click());
    expect(first.onCancel).toHaveBeenCalledTimes(1);
    expect(first.onConfirm).not.toHaveBeenCalled();

    act(() => first.trigger.click());
    const dialog = host.querySelector<HTMLElement>('[role="dialog"]')!;
    const confirm = dialog.querySelectorAll<HTMLButtonElement>('button')[1]!;
    act(() => confirm.click());
    expect(first.onConfirm).toHaveBeenCalledTimes(1);
    expect(first.onCancel).toHaveBeenCalledTimes(1);
  });
});
