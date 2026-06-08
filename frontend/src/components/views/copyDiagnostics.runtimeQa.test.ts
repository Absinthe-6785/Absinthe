// @vitest-environment happy-dom
/**
 * Runtime QA — full diagnostic pipeline (installCopyDiagnostics + dispatchEvent).
 * Run: npm test -- copyDiagnostics.runtimeQa --disable-console-intercept
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { classifyClipboardHtml, installCopyDiagnostics } from './copyDiagnostics';
import { installEditorCopyListener } from './copyListener';
import { markdownToBlocks } from './blockUtils';

const EJU_NOTE_MD = `# EJU Study Timeline

> Grammar Module
  ## Particles
  - は vs が
  - を particle usage
    - nested bullet
  1. Drill set A
  2. Drill set B
  > Vocab nest
    ### Core kanji
    - 読む
    - 書く

> Reading Module
  ## Comprehension
  - Main idea questions
  - Detail matching
  1. Practice passage 1
  2. Practice passage 2

## Global review checklist
- Redo wrong answers
- Time yourself`;

/** DOM HTML Chromium produces when copying from .be-toggle-wrap (non-semantic). */
const EJU_DOM_CLIPBOARD_HTML = `<meta charset='utf-8'>
<div class="be-toggle-wrap">
  <div class="be-toggle-header-block be-block">
    <div class="be-content">
      <div style="display:flex;gap:6px">
        <button type="button" aria-label="접기"></button>
        <span class="be-editable" style="font-weight:600">Grammar Module</span>
      </div>
    </div>
  </div>
  <div class="be-toggle-children be-toggle-drop" data-toggle-id="t1">
    <div class="be-block"><div class="be-content"><h2 class="be-editable">Particles</h2></div></div>
    <div class="be-block"><div class="be-content">
      <div style="display:flex;gap:8px"><span>•</span><span class="be-editable">は vs が</span></div>
    </div></div>
  </div>
</div>`;

interface RuntimeQaResult {
  gesture: string;
  readOnly: boolean;
  handlerRegistered: boolean;
  path: string | null;
  preventedDefault: boolean;
  htmlClassification: string;
  selectedBlockIds: string[];
  activeBlockType: string | null;
  logs: string;
}

function makeClipboardEvent(browserHtml?: string, browserPlain?: string): ClipboardEvent {
  const clipboard = new DataTransfer();
  if (browserHtml) clipboard.setData('text/html', browserHtml);
  if (browserPlain) clipboard.setData('text/plain', browserPlain);
  return new ClipboardEvent('copy', {
    clipboardData: clipboard,
    bubbles: true,
    cancelable: true,
  });
}

function focusReadingBlock(
  blockId: string,
  blockType: string,
  text: string,
  selectStart?: number,
  selectEnd?: number,
): void {
  const wrap = document.createElement('div');
  wrap.className = 'be-toggle-wrap';
  const el = document.createElement('span');
  el.className = 'be-block-text';
  el.setAttribute('data-block-id', blockId);
  el.setAttribute('data-block-type', blockType);
  el.textContent = text;
  wrap.appendChild(el);
  const children = document.createElement('div');
  children.className = 'be-toggle-children';
  children.setAttribute('data-toggle-id', blockId);
  wrap.appendChild(children);
  document.body.appendChild(wrap);
  const range = document.createRange();
  if (selectStart != null && selectEnd != null && el.firstChild) {
    range.setStart(el.firstChild, selectStart);
    range.setEnd(el.firstChild, selectEnd);
  } else {
    range.selectNodeContents(el);
  }
  const sel = window.getSelection()!;
  sel.removeAllRanges();
  sel.addRange(range);
}

function focusEditable(
  blockId: string,
  blockType: string,
  text: string,
  selectStart?: number,
  selectEnd?: number,
): void {
  const el = document.createElement('span');
  el.className = 'be-editable';
  el.setAttribute('data-block-id', blockId);
  el.setAttribute('data-block-type', blockType);
  el.textContent = text;
  document.body.appendChild(el);
  el.focus();
  const range = document.createRange();
  if (selectStart != null && selectEnd != null && el.firstChild) {
    range.setStart(el.firstChild, selectStart);
    range.setEnd(el.firstChild, selectEnd);
  } else {
    range.selectNodeContents(el);
  }
  const sel = window.getSelection()!;
  sel.removeAllRanges();
  sel.addRange(range);
}

function runRuntimeCopy(opts: {
  gesture: string;
  readOnly: boolean;
  blocks: ReturnType<typeof markdownToBlocks>;
  selectedIds: Set<string>;
  browserHtml?: string;
  browserPlain?: string;
  setup?: () => void;
}): RuntimeQaResult {
  const warnLines: string[] = [];
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
    warnLines.push(args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
  });

  let tracePath: string | null = null;
  let prevented = false;
  let captureReadOnly = false;
  let captureHandlerRegistered = false;
  let captureSelectedIds: string[] = [];
  let captureActiveType: string | null = null;
  let bubbleClassification = 'empty';

  const uninstallCopy = installEditorCopyListener({
    getRootBlocks: () => opts.blocks,
    getSelectedIds: () => opts.selectedIds,
  });

  const uninstallDiag = installCopyDiagnostics({
    readOnly: opts.readOnly,
    depth: 0,
    getRootBlocks: () => opts.blocks,
    getSelectedIds: () => opts.selectedIds,
  });

  const uninstall = () => {
    uninstallCopy();
    uninstallDiag();
  };

  opts.setup?.();

  const e = makeClipboardEvent(opts.browserHtml, opts.browserPlain);
  window.dispatchEvent(e);

  // Parse capture log for fields
  for (const line of warnLines) {
    if (line.includes('[UX-3A copy:capture]') && line.includes('handlerRegistered')) {
      try {
        const json = line.replace(/^[^[]*\[UX-3A copy:capture\]\s*/, '');
        const parsed = JSON.parse(json);
        captureReadOnly = parsed.readOnly;
        captureHandlerRegistered = parsed.handlerRegistered;
        captureSelectedIds = parsed.selectedBlockIds ?? [];
        if (!captureActiveType) captureActiveType = null;
      } catch { /* ignore */ }
    }
    if (line.includes('[UX-3A copy:bubble-no-semantic-handler]')) {
      try {
        const json = line.replace(/^[^[]*\[UX-3A copy:bubble-no-semantic-handler\]\s*/, '');
        const parsed = JSON.parse(json);
        bubbleClassification = parsed.htmlClassification ?? bubbleClassification;
        prevented = parsed.defaultPrevented ?? prevented;
      } catch { /* ignore */ }
    }
    if (line.includes('[UX-3A copy:trace]')) {
      try {
        const json = line.replace(/^[^[]*\[UX-3A copy:trace\]\s*/, '');
        const parsed = JSON.parse(json);
        tracePath = parsed.path ?? tracePath;
        prevented = parsed.preventedDefault ?? prevented;
        captureActiveType = parsed.activeBlockType ?? captureActiveType;
        bubbleClassification = parsed.htmlClassification ?? bubbleClassification;
        captureSelectedIds = parsed.selectedBlockIds ?? captureSelectedIds;
      } catch { /* ignore */ }
    }
  }

  uninstall();
  warnSpy.mockRestore();
  document.body.innerHTML = '';

  const pathLabel = tracePath ?? (!captureHandlerRegistered ? 'handler-not-registered' : 'no-trace');

  const result: RuntimeQaResult = {
    gesture: opts.gesture,
    readOnly: captureReadOnly,
    handlerRegistered: captureHandlerRegistered,
    path: pathLabel,
    preventedDefault: prevented,
    htmlClassification: bubbleClassification,
    selectedBlockIds: captureSelectedIds,
    activeBlockType: captureActiveType,
    logs: warnLines.join('\n'),
  };

  // eslint-disable-next-line no-console
  console.info(`\n========== RUNTIME QA: ${opts.gesture} ==========`);
  // eslint-disable-next-line no-console
  console.info(JSON.stringify({
    readOnly: result.readOnly,
    handlerRegistered: result.handlerRegistered,
    path: result.path,
    preventedDefault: result.preventedDefault,
    htmlClassification: result.htmlClassification,
    selectedBlockIds: result.selectedBlockIds,
    activeBlockType: result.activeBlockType,
  }, null, 2));
  // eslint-disable-next-line no-console
  console.info(result.logs);

  return result;
}

describe('runtime QA — EJU failing reproduction gestures', () => {
  const ejuBlocks = markdownToBlocks(EJU_NOTE_MD).filter(
    b => b.type !== 'paragraph' || b.content.trim() !== '',
  );
  const grammarToggle = ejuBlocks.find(b => b.type === 'toggle' && b.content === 'Grammar Module')!;
  const bulletBlock = grammarToggle.children.find(b => b.type === 'bullet' && b.content === 'は vs が')!;

  beforeEach(() => {
    vi.stubEnv('DEV', 'true');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('GESTURE A: reading/preview mode Ctrl+C (semantic toggle copy)', () => {
    const result = runRuntimeCopy({
      gesture: 'Preview/reading mode — select visible EJU text, Ctrl+C',
      readOnly: true,
      blocks: ejuBlocks,
      selectedIds: new Set(),
      setup: () => {
        focusReadingBlock(grammarToggle.id, 'toggle', 'Grammar Module', 0, 6);
      },
    });

    expect(result.handlerRegistered).toBe(true);
    expect(result.path).toBe('editable-toggle-header');
    expect(result.preventedDefault).toBe(true);
    expect(result.htmlClassification).toBe('semantic-details');
  });

  it('GESTURE B: edit mode partial selection inside toggle bullet', () => {
    const result = runRuntimeCopy({
      gesture: 'Edit mode — partial text drag-select in bullet, Ctrl+C',
      readOnly: false,
      blocks: ejuBlocks,
      selectedIds: new Set(),
      browserHtml: EJU_DOM_CLIPBOARD_HTML,
      browserPlain: 'は vs',
      setup: () => {
        focusEditable(bulletBlock.id, 'bullet', 'は vs が', 0, 3);
      },
    });

    expect(result.handlerRegistered).toBe(true);
    expect(result.path).toBe('editable-partial-fallback');
    expect(result.preventedDefault).toBe(false);
    expect(result.htmlClassification).toBe('dom-be-toggle');
  });

  it('GESTURE C: edit mode gutter-select toggle but partial header text', () => {
    const result = runRuntimeCopy({
      gesture: 'Edit mode — gutter-select toggle + partial header selection, Ctrl+C',
      readOnly: false,
      blocks: ejuBlocks,
      selectedIds: new Set([grammarToggle.id]),
      browserHtml: EJU_DOM_CLIPBOARD_HTML,
      setup: () => {
        focusEditable(grammarToggle.id, 'toggle', 'Grammar Module', 0, 7);
      },
    });

    expect(result.path).toBe('single-gutter-partial-fallback');
    expect(result.preventedDefault).toBe(false);
  });

  it('GESTURE D: edit mode gutter multi-select (should NOT reproduce bug)', () => {
    const result = runRuntimeCopy({
      gesture: 'Edit mode — gutter multi-select all root blocks, Ctrl+C',
      readOnly: false,
      blocks: ejuBlocks,
      selectedIds: new Set(ejuBlocks.map(b => b.id)),
      setup: () => {},
    });

    expect(result.path).toBe('multi-select');
    expect(result.preventedDefault).toBe(true);
    expect(result.htmlClassification).toBe('semantic-details');
  });

  it('identify failing gesture classification', () => {
    const failing = [
      runRuntimeCopy({
        gesture: 'A preview reading',
        readOnly: true,
        blocks: ejuBlocks,
        selectedIds: new Set(),
        setup: () => focusReadingBlock(grammarToggle.id, 'toggle', 'Grammar Module'),
      }),
      runRuntimeCopy({
        gesture: 'B partial bullet',
        readOnly: false,
        blocks: ejuBlocks,
        selectedIds: new Set(),
        browserHtml: EJU_DOM_CLIPBOARD_HTML,
        setup: () => focusEditable(bulletBlock.id, 'bullet', 'は vs が', 0, 3),
      }),
    ];

    const fixedReading = failing.find(r => r.gesture === 'A preview reading')!;
    const stillPartial = failing.find(r => r.gesture === 'B partial bullet')!;

    // eslint-disable-next-line no-console
    console.info('\n========== GESTURE VERDICT (UX-3A.2) ==========');
    // eslint-disable-next-line no-console
    console.info({ fixedReading, stillPartial });

    expect(fixedReading.path).toBe('editable-toggle-header');
    expect(fixedReading.preventedDefault).toBe(true);
    expect(fixedReading.htmlClassification).toBe('semantic-details');
    expect(stillPartial.path).toBe('editable-partial-fallback');
    expect(stillPartial.preventedDefault).toBe(false);
  });
});
