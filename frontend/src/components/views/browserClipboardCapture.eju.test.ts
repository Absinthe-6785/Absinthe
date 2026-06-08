// @vitest-environment happy-dom
/**
 * Browser clipboard capture — gutter toggle Ctrl+C QA reproduction.
 * Run: npm test -- browserClipboardCapture.eju --disable-console-intercept
 */
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getLastBrowserClipboardReport,
  readAllClipboardMimeTypes,
  scheduleBrowserClipboardCapture,
} from './browserClipboardCapture';
import { blocksToCopyHtml, handleEditorCopyEvent } from './blockCopy';
import { installEditorCopyListener } from './copyListener';
import { BlockEditor } from './BlockEditor';
import { EDITOR_CHROME_STYLES } from './editorChromeStyles';
import { markdownToBlocks } from './blockUtils';

const EJU_NOTE_MD = `# EJU Study Timeline

> Grammar Module
  ## Particles
  - は vs が
  - を particle usage
  > Vocab nest
    ### Core kanji
    - 読む`;

const ROW_H = 48;

function mountEjuEditor(blocks: ReturnType<typeof markdownToBlocks>) {
  document.body.innerHTML = '';
  document.head.innerHTML = '';
  const style = document.createElement('style');
  style.textContent = EDITOR_CHROME_STYLES;
  document.head.appendChild(style);
  const outer = document.createElement('div');
  document.body.appendChild(outer);
  let root: Root | null = null;
  act(() => {
    root = createRoot(outer);
    root.render(createElement(BlockEditor, {
      blocks,
      onChange: () => {},
      colors: {
        bg: '#fff', text: '#111', textMuted: '#666', textFaint: '#999',
        accent: '#8B5CF6', accentBg: '#eee', border: '#ddd', card: '#fff',
        cardHov: '#f5f5f5', input: '#fff', inputBdr: '#ccc', toolbar: '#f9f9f9',
        danger: '#f00', green: '#0f0', codeBg: '#f1f5f9', calloutBg: '#fafafa',
        toggleBg: 'transparent', quoteBdr: '#ccc', selection: '#eef',
      },
      readOnly: false,
    }));
  });
  return { root };
}

function firePointer(el: Element, type: 'pointerdown' | 'pointerup', y: number) {
  act(() => {
    el.dispatchEvent(new PointerEvent(type, {
      bubbles: true, cancelable: true, clientX: 22, clientY: y,
      pointerId: 1, button: 0, buttons: type === 'pointerup' ? 0 : 1, pointerType: 'mouse',
    }));
  });
}

function mockClipboardRead(payloads: Array<{ type: string; data: string }>) {
  const read = vi.fn(async () => [{
    types: payloads.map(p => p.type),
    getType: async (t: string) => {
      const hit = payloads.find(p => p.type === t);
      return {
        text: async () => hit?.data ?? '',
      } as Blob;
    },
  }]);
  vi.stubGlobal('navigator', {
    ...navigator,
    clipboard: { read, writeText: vi.fn(), write: vi.fn() },
  });
  return read;
}

describe('browser clipboard capture — gutter toggle Ctrl+C', () => {
  const ejuBlocks = markdownToBlocks(EJU_NOTE_MD).filter(
    b => b.type !== 'paragraph' || b.content.trim() !== '',
  );
  const grammarToggle = ejuBlocks.find(b => b.type === 'toggle' && b.content === 'Grammar Module')!;
  const expectedHtml = blocksToCopyHtml([grammarToggle]);

  let root: Root | null = null;

  beforeEach(() => {
    vi.stubEnv('DEV', 'true');
  });

  afterEach(() => {
    act(() => { root?.unmount(); });
    document.body.innerHTML = '';
    document.head.innerHTML = '';
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('QA — sync clipboardData matches blocksToCopyHtml on gutter copy', async () => {
    ({ root } = mountEjuEditor(ejuBlocks));
    const strip = document.querySelector(
      `[data-gutter-block-id="${grammarToggle.id}"] .be-gutter-strip`,
    ) as HTMLElement;
    firePointer(strip, 'pointerdown', 10);
    firePointer(strip, 'pointerup', 10);

    const uninstall = installEditorCopyListener({
      getRootBlocks: () => ejuBlocks,
      getSelectedIds: () => new Set([grammarToggle.id]),
    });

    mockClipboardRead([
      { type: 'text/html', data: expectedHtml },
      { type: 'text/plain', data: '> Grammar Module\n  ## Particles' },
    ]);

    const clipboard = new DataTransfer();
    const e = new ClipboardEvent('copy', {
      clipboardData: clipboard,
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(e);

    await new Promise(r => setTimeout(r, 10));

    const report = getLastBrowserClipboardReport()!;

    // eslint-disable-next-line no-console
    console.info('\n========== BROWSER CLIPBOARD QA ==========');
    // eslint-disable-next-line no-console
    console.info(JSON.stringify({
      syncHtmlMatchesExpected: report.syncClipboardData.htmlMatchesExpected,
      asyncHtmlMatchesSync: report.asyncNavigatorClipboard.htmlMatchesSync,
      asyncMimeTypes: report.asyncNavigatorClipboard.allMimeTypes,
      chromiumBehavior: report.chromiumBehavior,
      verdict: report.verdict,
      firstDiffAsyncVsSync: report.asyncNavigatorClipboard.firstHtmlDiffVsSync,
    }, null, 2));

    expect(report.syncClipboardData.htmlVariant).toBe('A-semantic-details-summary');
    expect(report.syncClipboardData.htmlMatchesExpected).toBe(true);
    expect(report.asyncNavigatorClipboard.htmlMatchesSync).toBe(true);
    expect(report.chromiumBehavior).toBe('unchanged');
    uninstall();
  });

  it('Chromium augmented — async wraps semantic with meta/fragment', async () => {
    const augmentedHtml = `<meta charset='utf-8'><!--StartFragment-->${expectedHtml}<!--EndFragment-->`;
    const data: Record<string, string> = {};
    const clipboard = {
      setData: (t: string, v: string) => { data[t] = v; },
      getData: (t: string) => data[t] ?? '',
    } as DataTransfer;

    const report = handleEditorCopyEvent(
      {
        clipboardData: clipboard,
        preventDefault: () => {},
      },
      ejuBlocks,
      new Set([grammarToggle.id]),
    )!;

    const e = {
      clipboardData: clipboard,
    } as ClipboardEvent;

    mockClipboardRead([
      { type: 'text/html', data: augmentedHtml },
      { type: 'text/plain', data: data['text/plain'] ?? '' },
    ]);

    scheduleBrowserClipboardCapture(e, report, 'chromium-augmented');
    await new Promise(r => setTimeout(r, 10));

    const captured = getLastBrowserClipboardReport()!;
    expect(captured.syncClipboardData.htmlMatchesExpected).toBe(true);
    expect(captured.asyncNavigatorClipboard.htmlMatchesSync).toBe(false);
    expect(captured.chromiumBehavior).toBe('augmented');
    expect(captured.asyncNavigatorClipboard.html).toContain('StartFragment');
    expect(captured.asyncNavigatorClipboard.html).toContain('btoggle');
  });

  it('Chromium replaced — async has be-toggle-wrap while sync is semantic', async () => {
    const domHtml = `<meta charset='utf-8'><div class="be-toggle-wrap"><span class="be-editable">Grammar Module</span></div>`;
    const data: Record<string, string> = {};
    const clipboard = {
      setData: (t: string, v: string) => { data[t] = v; },
      getData: (t: string) => data[t] ?? '',
    } as DataTransfer;

    const report = handleEditorCopyEvent(
      { clipboardData: clipboard, preventDefault: () => {} },
      ejuBlocks,
      new Set([grammarToggle.id]),
    )!;

    mockClipboardRead([
      { type: 'text/html', data: domHtml },
      { type: 'text/plain', data: 'Grammar Module' },
    ]);

    scheduleBrowserClipboardCapture({ clipboardData: clipboard } as ClipboardEvent, report, 'dom-replace');
    await new Promise(r => setTimeout(r, 10));

    const captured = getLastBrowserClipboardReport()!;
    expect(captured.syncClipboardData.htmlVariant).toBe('A-semantic-details-summary');
    expect(captured.asyncNavigatorClipboard.htmlVariant).toBe('C-dom-be-toggle-wrap');
    expect(captured.chromiumBehavior).toBe('replaced-with-dom');
    expect(captured.syncClipboardData.html).not.toContain('be-toggle-wrap');
    expect(captured.asyncNavigatorClipboard.html).toContain('be-toggle-wrap');
    // sync starts with `<details`, async with `<meta` — first divergence at index 1
    expect(captured.asyncNavigatorClipboard.firstHtmlDiffVsSync?.index).toBe(1);
  });

  it('readAllClipboardMimeTypes dumps every MIME type', async () => {
    mockClipboardRead([
      { type: 'text/html', data: '<details class="btoggle">x</details>' },
      { type: 'text/plain', data: '> x' },
    ]);

    const result = await readAllClipboardMimeTypes();
    expect(result.allMimeTypes).toEqual(['text/html', 'text/plain']);
    expect(result.payloads).toHaveLength(2);
    expect(result.payloads.every(p => p.payload.length > 0)).toBe(true);
  });
});
