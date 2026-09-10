// @vitest-environment happy-dom
import { createElement, useRef } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useModalA11y } from './useModalA11y';

function ModalFixture({ onClose, noFocusable = false }: { onClose: () => void; noFocusable?: boolean }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const preferredRef = useRef<HTMLButtonElement>(null);
  useModalA11y({ open: true, onClose, containerRef: panelRef, initialFocusRef: preferredRef });
  return createElement(
    'div',
    { ref: panelRef, role: 'dialog', tabIndex: -1 },
    createElement('button', { ref: preferredRef, type: 'button', hidden: true }, 'hidden'),
    createElement('button', { type: 'button', disabled: true }, 'disabled'),
    noFocusable ? null : createElement('button', { type: 'button', 'data-only-action': true }, 'only'),
  );
}

describe('useModalA11y shared focus authority', () => {
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

  it('excludes hidden and disabled controls and contains a single focusable action', () => {
    act(() => root.render(createElement(ModalFixture, { onClose: vi.fn() })));
    const only = host.querySelector<HTMLButtonElement>('[data-only-action]')!;
    expect(document.activeElement).toBe(only);

    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })));
    expect(document.activeElement).toBe(only);
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true })));
    expect(document.activeElement).toBe(only);
  });

  it('falls back to the dialog container when no control can receive focus', () => {
    act(() => root.render(createElement(ModalFixture, { onClose: vi.fn(), noFocusable: true })));
    expect(document.activeElement).toBe(host.querySelector('[role="dialog"]'));
  });

  it('does not throw while restoring focus if the opener was removed', () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();
    act(() => root.render(createElement(ModalFixture, { onClose: vi.fn() })));
    opener.remove();
    expect(() => act(() => root.unmount())).not.toThrow();
    root = createRoot(host);
  });
});
