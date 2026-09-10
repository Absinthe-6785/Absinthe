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

function NoPreferredFixture({ onClose }: { onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  useModalA11y({ open: true, onClose, containerRef: panelRef });
  return createElement(
    'div',
    { ref: panelRef, role: 'dialog' },
    createElement('div', { hidden: true }, createElement('button', { type: 'button', 'data-hidden-ancestor': true }, 'hidden ancestor')),
    createElement('div', { style: { display: 'none' } }, createElement('button', { type: 'button', 'data-display-none-ancestor': true }, 'display none ancestor')),
    createElement('div', { style: { visibility: 'hidden' } }, createElement('button', { type: 'button', 'data-visibility-hidden-ancestor': true }, 'visibility hidden ancestor')),
    createElement('button', { type: 'button', 'data-first-action': true }, 'first'),
    createElement('button', { type: 'button', 'data-last-action': true }, 'last'),
  );
}

function EmptyNoPreferredFixture({ onClose }: { onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  useModalA11y({ open: true, onClose, containerRef: panelRef });
  return createElement('div', { ref: panelRef, role: 'dialog' }, 'No controls');
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

  it('focuses the first valid control without an initialFocusRef and restores the opener', () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();

    act(() => root.render(createElement(NoPreferredFixture, { onClose: vi.fn() })));
    const dialog = host.querySelector<HTMLElement>('[role="dialog"]')!;
    const first = dialog.querySelector<HTMLButtonElement>('[data-first-action]')!;
    const last = dialog.querySelector<HTMLButtonElement>('[data-last-action]')!;
    expect(document.activeElement).toBe(first);

    first.focus();
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true })));
    expect(document.activeElement).toBe(last);

    act(() => root.unmount());
    expect(document.activeElement).toBe(opener);
    opener.remove();
    root = createRoot(host);
  });

  it('excludes controls under hidden ancestors from initial focus and cycling', () => {
    act(() => root.render(createElement(NoPreferredFixture, { onClose: vi.fn() })));
    const dialog = host.querySelector<HTMLElement>('[role="dialog"]')!;
    const first = dialog.querySelector<HTMLButtonElement>('[data-first-action]')!;
    const last = dialog.querySelector<HTMLButtonElement>('[data-last-action]')!;

    expect(document.activeElement).toBe(first);
    last.focus();
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })));
    expect(document.activeElement).toBe(first);
  });

  it('makes and focuses the dialog container when no ref or focusable child exists', () => {
    act(() => root.render(createElement(EmptyNoPreferredFixture, { onClose: vi.fn() })));
    const dialog = host.querySelector<HTMLElement>('[role="dialog"]')!;

    expect(dialog.getAttribute('tabindex')).toBe('-1');
    expect(document.activeElement).toBe(dialog);
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
