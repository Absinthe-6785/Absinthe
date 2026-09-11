// @vitest-environment happy-dom
import { StrictMode, createElement, useState } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import { MilestoneNoteDialog } from './MilestoneNoteDialog';

vi.mock('../../../../../lib/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const colors: NoteChromeColors = {
  wrap: '#fff',
  sidebar: '#fff',
  sideBdr: '#ddd',
  notelist: '#fff',
  editor: '#fff',
  toolbar: '#fff',
  toolBdr: '#ddd',
  card: '#fff',
  cardHov: '#f5f5f5',
  cardAct: '#eee',
  cardActBdr: '#00f',
  text: '#111',
  textMuted: '#666',
  textFaint: '#999',
  accent: '#00f',
  accentBg: '#eef',
  input: '#fff',
  inputBdr: '#ddd',
  badge: '#eef',
  badgeTxt: '#00f',
  tag: '#eef',
  tagTxt: '#00f',
  danger: '#f00',
  green: '#0a0',
};

function Harness({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState(false);
  return createElement(
    'div',
    null,
    createElement('button', { type: 'button', onClick: () => setOpen(true), 'data-milestone-trigger': true }, 'open'),
    open && createElement(MilestoneNoteDialog, {
      colors,
      noteTitle: 'Milestone note',
      initialValues: { milestoneDate: '2026-09-10' },
      hasExistingMilestone: false,
      onSave: vi.fn(),
      onClose: () => { onClose(); setOpen(false); },
    }),
  );
}

describe('MilestoneNoteDialog shared modal focus contract', () => {
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

  it('focuses its first control without an initialFocusRef and restores its opener', () => {
    const onClose = vi.fn();
    act(() => root.render(createElement(StrictMode, null, createElement(Harness, { onClose }))));
    const trigger = host.querySelector<HTMLButtonElement>('[data-milestone-trigger]')!;
    trigger.focus();

    act(() => trigger.click());
    const dialog = host.querySelector<HTMLElement>('[role="dialog"]')!;
    expect(document.activeElement).toBe(dialog.querySelector('input[type="date"]'));

    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});
