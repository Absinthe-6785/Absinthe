// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { useAppStore } from '../../store/useAppStore';
import type { BlockEditorColors } from './editorTypes';
import { ShortcutHelpOverlay, isShortcutHelpKey } from './ShortcutHelpOverlay';

const colors: BlockEditorColors = {
  bg: '#fff', text: '#111', textMuted: '#555', textFaint: '#777', accent: '#00f', accentBg: '#eef',
  border: '#ddd', card: '#fff', cardHov: '#eee', input: '#fff', inputBdr: '#ccc', toolbar: '#f8f8f8',
  danger: '#f00', green: '#0a0', codeBg: '#eee', calloutBg: '#eee', toggleBg: '#eee', quoteBdr: '#ddd', selection: '#def',
};

const shortcutKeys = [
  'Ctrl+B', 'Ctrl+I', 'Ctrl+Shift+S', 'Ctrl+Shift+M', 'Ctrl+`', 'Ctrl+Shift+K', 'Ctrl+Shift+H',
  'Ctrl+Shift+0', 'Ctrl+Shift+1–4', 'Ctrl+Shift+7', 'Ctrl+Shift+8', 'Ctrl+Shift+9', 'Ctrl+Shift+C', '/',
  'Ctrl+F', 'Ctrl+Shift+F', 'Ctrl+S', 'Ctrl+Z / Ctrl+Y', 'Ctrl+E', 'Tab / Shift+Tab', 'Esc', '?', 'Ctrl+/',
];

let host: HTMLDivElement;
let root: Root;
let originalLanguage: 'ko' | 'en' | 'ja';
let originalActEnvironment: boolean | undefined;

async function renderOverlay(language: 'ko' | 'en' | 'ja') {
  useAppStore.getState().updateSetting('language', language);
  expect(useAppStore.getState().appSettings.language).toBe(language);
  await act(async () => {
    root.render(createElement(ShortcutHelpOverlay, {
      open: true,
      colors,
      onClose: () => undefined,
    }));
  });
  return host;
}

beforeEach(() => {
  const runtime = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
  originalActEnvironment = runtime.IS_REACT_ACT_ENVIRONMENT;
  originalLanguage = useAppStore.getState().appSettings.language as 'ko' | 'en' | 'ja';
  runtime.IS_REACT_ACT_ENVIRONMENT = true;
  useAppStore.getState().updateSetting('language', 'ko');
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  useAppStore.getState().updateSetting('language', originalLanguage);
  const runtime = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
  if (originalActEnvironment === undefined) delete runtime.IS_REACT_ACT_ENVIRONMENT;
  else runtime.IS_REACT_ACT_ENVIRONMENT = originalActEnvironment;
});

describe('ShortcutHelpOverlay localization', () => {
  it.each([
    ['ko', '키보드 단축키', 'Esc 닫기', ['서식', '제목 · 블록', '탐색 · 편집', '도움말'], ['굵게', '인라인 코드', '본문', '노트 검색', '실행 취소 / 다시 실행']],
    ['en', 'Keyboard shortcuts', 'Esc Close', ['FORMAT', 'HEADINGS & BLOCKS', 'NAVIGATION & EDITING', 'HELP'], ['Bold', 'Inline code', 'Body text', 'Search notes', 'Undo / redo']],
    ['ja', 'キーボードショートカット', 'Esc 閉じる', ['書式', '見出し・ブロック', 'ナビゲーション・編集', 'ヘルプ'], ['太字', 'インラインコード', '本文', 'ノートを検索', '元に戻す / やり直す']],
  ] as const)('%s renders translated help text without changing shortcut keys', async (language, title, closeText, sections, labels) => {
    await renderOverlay(language);
    const dialog = host.querySelector('[role="dialog"]');
    expect(dialog?.getAttribute('aria-label')).toBe(title);
    expect(dialog?.querySelector('h2')?.textContent).toBe(title);
    expect(dialog?.querySelector('button')?.textContent?.trim()).toBe(closeText);
    const visibleText = dialog?.textContent ?? '';
    for (const text of [...sections, ...labels]) expect(visibleText).toContain(text);
    expect([...host.querySelectorAll('kbd')].map(element => element.textContent)).toEqual(shortcutKeys);
    if (language !== 'ko') expect(visibleText).not.toMatch(/[\uac00-\ud7af]/);
  });
});

describe('isShortcutHelpKey', () => {
  it('detects ? outside editable fields', () => {
    const e = new KeyboardEvent('keydown', { key: '?' });
    Object.defineProperty(e, 'target', { value: document.body });
    expect(isShortcutHelpKey(e)).toBe(true);
  });

  it('ignores ? inside contenteditable', () => {
    const el = document.createElement('div');
    el.contentEditable = 'true';
    const e = new KeyboardEvent('keydown', { key: '?' });
    Object.defineProperty(e, 'target', { value: el });
    expect(isShortcutHelpKey(e)).toBe(false);
  });

  it('detects Ctrl+/', () => {
    const e = new KeyboardEvent('keydown', { key: '/', ctrlKey: true });
    expect(isShortcutHelpKey(e)).toBe(true);
  });
});
