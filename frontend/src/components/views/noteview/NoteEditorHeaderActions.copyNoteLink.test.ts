// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getTranslator } from '../../../lib/i18n';
import { NoteEditorHeaderActions } from './NoteEditorHeaderActions';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const colors = {
  wrap: '#fff', sidebar: '#fff', sideBdr: '#ddd', notelist: '#fff', editor: '#fff', toolbar: '#fff',
  toolBdr: '#ddd', card: '#fff', cardHov: '#fafafa', cardAct: '#f0f0f0', cardActBdr: '#ddd',
  text: '#111', textMuted: '#555', textFaint: '#888', accent: '#7c3aed', accentBg: '#f3e8ff',
  input: '#fff', inputBdr: '#ddd', badge: '#eee', badgeTxt: '#111', tag: '#eee', tagTxt: '#111',
  danger: '#dc2626', green: '#16a34a',
} as never;

let root: Root | undefined;
let host: HTMLDivElement | undefined;

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = undefined;
  host?.remove();
  host = undefined;
});

describe('Notes header Copy note link action', () => {
  it('keeps document copy and exposes the ID-link action as a keyboard-focusable menu item', () => {
    const t = getTranslator('ko');
    const onCopyDocument = vi.fn();
    const onCopyNoteLink = vi.fn();
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => root!.render(createElement(NoteEditorHeaderActions, {
      colors,
      isTrash: false,
      isMobile: false,
      showRightPanel: false,
      viewMode: 'edit',
      viewModeButtons: [],
      starred: false,
      docCopied: false,
      isEvent: false,
      isMilestone: false,
      isArea: false,
      canMarkArea: false,
      onViewModeToggle: vi.fn(),
      onMarkEvent: vi.fn(),
      onMarkMilestone: vi.fn(),
      onToggleArea: vi.fn(),
      onToggleStar: vi.fn(),
      onDuplicate: vi.fn(),
      onTogglePanel: vi.fn(),
      onCopyDocument,
      onCopyNoteLink,
      onExport: vi.fn(),
      onRestore: vi.fn(),
      onTrash: vi.fn(),
    })));

    const trigger = host.querySelector<HTMLButtonElement>('[data-k126c-notes-more-trigger]')!;
    trigger.focus();
    expect(document.activeElement).toBe(trigger);
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
    act(() => trigger.click());

    const menuItems = Array.from(host.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));
    const copyDocument = menuItems.find(item => item.textContent === t('nvCopyDocument'));
    const copyNoteLink = menuItems.find(item => item.textContent === t('nvCopyNoteLink'));
    expect(copyDocument?.tagName).toBe('BUTTON');
    expect(copyNoteLink?.tagName).toBe('BUTTON');
    expect(copyNoteLink?.tabIndex).toBe(0);

    act(() => copyDocument?.click());
    expect(onCopyDocument).toHaveBeenCalledOnce();
    act(() => trigger.click());
    const reopenedNoteLink = Array.from(host.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'))
      .find(item => item.textContent === t('nvCopyNoteLink'));
    act(() => reopenedNoteLink?.click());
    expect(onCopyNoteLink).toHaveBeenCalledOnce();
  });
});
