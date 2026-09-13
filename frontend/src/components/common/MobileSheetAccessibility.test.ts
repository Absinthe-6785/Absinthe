// @vitest-environment happy-dom
import { act, createElement, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AppSettings } from '../../types';
import type { NoteChromeColors } from '../views/noteEditorTheme';
import { NoteListSortMenu } from '../views/noteview/NoteListSortMenu';
import { MobileMoreSheet } from './MobileMoreSheet';

vi.mock('../../lib/i18n', () => ({
  resolveAppLanguage: () => 'en',
  getTranslator: () => (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key, lang: 'en' }),
}));

const appSettings = {
  darkMode: false,
  defaultCategory: 'Study',
  defaultColor: 'gold',
  language: 'en',
  notesFontFamily: 'system',
  notesFontSize: 16,
  notesTextColor: '',
  notesAccentColor: '',
} as AppSettings;

const noteColors = {
  card: '#fff',
  sideBdr: '#ddd',
  text: '#111',
  textMuted: '#555',
} as NoteChromeColors;

function MoreHarness() {
  const [open, setOpen] = useState(false);
  return createElement(
    'div',
    null,
    createElement('button', { type: 'button', onClick: () => setOpen(true), 'data-more-opener': true }, 'Open more'),
    createElement('button', { type: 'button', 'data-background-control': true }, 'Background'),
    createElement(MobileMoreSheet, {
      open,
      onOpenChange: setOpen,
      appSettings,
      updateSetting: () => undefined,
      userName: 'Ada',
      onSignOut: () => undefined,
      onOpenSettings: () => undefined,
      onOpenSettingsSection: () => undefined,
    }),
  );
}

function NotesSortHarness({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const close = () => { onClose(); setOpen(false); };
  return createElement(
    'div',
    null,
    createElement('button', { ref: anchorRef, type: 'button', onClick: () => setOpen(true), 'data-sort-opener': true }, 'Open sort'),
    createElement(NoteListSortMenu, {
      colors: noteColors,
      anchorRef,
      isMobile: true,
      open,
      sortOrder: 'updated',
      sortDirection: 'desc',
      starredFirst: false,
      onSortOrder: () => undefined,
      onSortDirection: () => undefined,
      onStarredFirst: () => undefined,
      onClose: close,
    }),
  );
}

describe('shared mobile sheet accessibility', () => {
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

  it('moves focus into Mobile More, contains both Tab directions, closes on Escape, and restores the opener', () => {
    act(() => root.render(createElement(MoreHarness)));
    const opener = host.querySelector<HTMLButtonElement>('[data-more-opener]')!;
    opener.focus();
    act(() => opener.click());

    const dialog = document.querySelector<HTMLElement>('[data-k126-mobile-more-sheet]')!;
    const actions = [...dialog.querySelectorAll<HTMLButtonElement>('button')];
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(document.activeElement).toBe(actions[0]);

    actions.at(-1)!.focus();
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })));
    expect(document.activeElement).toBe(actions[0]);

    actions[0]!.focus();
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true })));
    expect(document.activeElement).toBe(actions.at(-1));

    host.querySelector<HTMLButtonElement>('[data-background-control]')!.focus();
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })));
    expect(document.activeElement).toBe(actions[0]);

    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })));
    expect(document.querySelector('[data-k126-mobile-more-sheet]')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('gives the Notes mobile sort sheet the same modal containment and restoration behavior', () => {
    const onClose = vi.fn();
    act(() => root.render(createElement(NotesSortHarness, { onClose })));
    const opener = host.querySelector<HTMLButtonElement>('[data-sort-opener]')!;
    opener.focus();
    act(() => opener.click());

    const dialog = document.querySelector<HTMLElement>('[data-k104-sort-menu]')!;
    const actions = [...dialog.querySelectorAll<HTMLButtonElement>('button')];
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(document.activeElement).toBe(actions[0]);

    actions.at(-1)!.focus();
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })));
    expect(document.activeElement).toBe(actions[0]);

    actions[0]!.focus();
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true })));
    expect(document.activeElement).toBe(actions.at(-1));

    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[data-k104-sort-menu]')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });
});
