// @vitest-environment happy-dom
/**
 * Gutter-selected toggle → Ctrl+C investigation (exact QA reproduction).
 * Run: npm test -- gutterToggleCopy.investigation --disable-console-intercept
 */
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BlockEditor } from './BlockEditor';
import {
  collectBlocksForCopy,
  handleEditorCopyEvent,
} from './blockCopy';
import { blockShape } from './blockCopy.investigationHelpers';
import { classifyClipboardHtml } from './copyDiagnostics';
import { resolveCopySelection } from './copySelection';
import { EDITOR_CHROME_STYLES } from './editorChromeStyles';
import { setSelectionOffsets } from './editableDom';
import { markdownToBlocks, type Block } from './blockUtils';

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

const ROW_H = 48;

function rect(left: number, top: number, w: number, h: number): DOMRect {
  return {
    left, top, width: w, height: h, right: left + w, bottom: top + h, x: left, y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

function layoutToggleRects(toggleId: string, childIds: string[]) {
  const ids = [toggleId, ...childIds];
  ids.forEach((id, i) => {
    const block = document.querySelector(`[data-drag-id="${id}"]`) as HTMLElement | null;
    if (!block) return;
    const top = i * ROW_H;
    block.getBoundingClientRect = () => rect(40, top, 400, ROW_H - 4);
    const strip = document.querySelector(`[data-gutter-block-id="${id}"] .be-gutter-strip`) as HTMLElement | null;
    if (strip) strip.getBoundingClientRect = () => rect(0, top, 44, ROW_H - 4);
  });
}

function stubElementFromPoint(ids: string[]) {
  vi.spyOn(document, 'elementFromPoint').mockImplementation((x: number, y: number) => {
    const idx = Math.floor(y / ROW_H);
    if (idx < 0 || idx >= ids.length) return document.body;
    const id = ids[idx];
    if (x < 44) {
      return document.querySelector(`[data-gutter-block-id="${id}"] .be-gutter-strip`);
    }
    return document.querySelector(`[data-drag-id="${id}"] .be-editable`)
      ?? document.querySelector(`[data-drag-id="${id}"]`);
  });
}

function mountEjuEditor(blocks: Block[]) {
  document.body.innerHTML = '';
  document.head.innerHTML = '';
  const style = document.createElement('style');
  style.textContent = EDITOR_CHROME_STYLES;
  document.head.appendChild(style);

  const outer = document.createElement('div');
  outer.className = 'be-editor-root be-document-edit';
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

function firePointer(el: Element, type: 'pointerdown' | 'pointermove' | 'pointerup', y: number, x = 22) {
  const ev = new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
    pointerId: 1,
    button: 0,
    buttons: type === 'pointerup' ? 0 : 1,
    pointerType: 'mouse',
  });
  act(() => { el.dispatchEvent(ev); });
}

function visualSelectedIds(): string[] {
  return [...document.querySelectorAll('.be-block-selected')].map(
    el => el.getAttribute('data-drag-id') ?? '',
  ).filter(Boolean);
}

function serializeResolve(resolved: ReturnType<typeof resolveCopySelection>): unknown {
  if (resolved.kind === 'single') {
    return {
      kind: resolved.kind,
      activeBlockId: resolved.ctx.activeBlockId,
      activeBlockType: resolved.ctx.activeBlockType,
      start: resolved.ctx.start,
      end: resolved.ctx.end,
      textLength: resolved.ctx.textLength,
    };
  }
  return resolved;
}

function firstTypeDivergence(
  orig: ReturnType<typeof blockShape>,
  copied: ReturnType<typeof blockShape>,
  path = 'root',
): string | null {
  if (orig.length !== copied.length) {
    return `${path}: length ${orig.length} vs ${copied.length} (orig[0].type=${orig[0]?.type} copied[0].type=${copied[0]?.type})`;
  }
  for (let i = 0; i < orig.length; i++) {
    const a = orig[i];
    const b = copied[i];
    const p = `${path}[${i}]`;
    if (a.type !== b.type) return `${p}: type ${a.type} vs ${b.type}`;
    const ac = a.children ?? [];
    const bc = b.children ?? [];
    const d = firstTypeDivergence(ac, bc, `${p}.children`);
    if (d) return d;
  }
  return null;
}

interface GutterCopyTrace {
  label: string;
  selectedBlockIds: string[];
  visualSelectedIds: string[];
  activeBlockId: string | null;
  activeBlockType: string | null;
  activeIsEditable: boolean;
  selectionCollapsed: boolean;
  resolveCopySelection: ReturnType<typeof serializeResolve>;
  collectBlocksForCopy: ReturnType<typeof blockShape>;
  path: string | null;
  preventedDefault: boolean;
  htmlClassification: string;
  blocksCopied: number;
  clipboardHtml: string;
  clipboardPlain: string;
  semanticExecuted: boolean;
  firstDivergence: string | null;
}

function traceGutterCopy(
  label: string,
  rootBlocks: Block[],
  selectedIds: Set<string>,
  expectedBlock: Block,
): GutterCopyTrace {
  const active = document.activeElement as HTMLElement | null;
  const resolved = resolveCopySelection(rootBlocks);
  const collected = collectBlocksForCopy(rootBlocks, selectedIds);

  const data: Record<string, string> = {};
  let prevented = false;
  const clipboard = new DataTransfer();
  const origSetData = clipboard.setData.bind(clipboard);
  vi.spyOn(clipboard, 'setData').mockImplementation((type: string, val: string) => {
    data[type] = val;
    origSetData(type, val);
  });

  const e = {
    clipboardData: clipboard,
    preventDefault: () => { prevented = true; },
  } as Pick<ClipboardEvent, 'clipboardData' | 'preventDefault'>;

  const report = handleEditorCopyEvent(e, rootBlocks, selectedIds);

  const clipboardHtml = data['text/html'] ?? clipboard.getData('text/html') ?? '';
  const clipboardPlain = data['text/plain'] ?? clipboard.getData('text/plain') ?? '';
  const collectedShape = blockShape(collected);
  const copiedFromClipboard = collected.length === 1 ? blockShape(collected) : collectedShape;

  return {
    label,
    selectedBlockIds: [...selectedIds],
    visualSelectedIds: visualSelectedIds(),
    activeBlockId: active?.getAttribute('data-block-id') ?? null,
    activeBlockType: active?.getAttribute('data-block-type') ?? null,
    activeIsEditable: active?.classList.contains('be-editable') ?? false,
    selectionCollapsed: window.getSelection()?.isCollapsed ?? true,
    resolveCopySelection: serializeResolve(resolved),
    collectBlocksForCopy: collectedShape,
    path: report?.path ?? null,
    preventedDefault: prevented,
    htmlClassification: report?.htmlClassification ?? classifyClipboardHtml(clipboardHtml),
    blocksCopied: report?.blocksCopied ?? 0,
    clipboardHtml,
    clipboardPlain,
    semanticExecuted: prevented && (report?.blocksCopied ?? 0) > 0,
    firstDivergence: firstTypeDivergence(
      blockShape([expectedBlock]),
      copiedFromClipboard,
    ),
  };
}

function dumpTrace(t: GutterCopyTrace): void {
  // eslint-disable-next-line no-console
  console.info(`\n${'='.repeat(72)}\n${t.label}\n${'='.repeat(72)}`);
  // eslint-disable-next-line no-console
  console.info(JSON.stringify({
    A_semanticExecuted: t.semanticExecuted,
    B_selectedHasToggleId: t.selectedBlockIds.length > 0,
    C_collectReturnsToggle: t.collectBlocksForCopy[0]?.type === 'toggle',
    selectedBlockIds: t.selectedBlockIds,
    visualSelectedIds: t.visualSelectedIds,
    activeBlockId: t.activeBlockId,
    activeBlockType: t.activeBlockType,
    activeIsEditable: t.activeIsEditable,
    selectionCollapsed: t.selectionCollapsed,
    resolveCopySelection: t.resolveCopySelection,
    collectBlocksForCopy: t.collectBlocksForCopy,
    path: t.path,
    preventedDefault: t.preventedDefault,
    htmlClassification: t.htmlClassification,
    blocksCopied: t.blocksCopied,
    firstDivergence: t.firstDivergence,
  }, null, 2));
  // eslint-disable-next-line no-console
  console.info('CLIPBOARD HTML (FULL):', t.clipboardHtml);
  // eslint-disable-next-line no-console
  console.info('CLIPBOARD PLAIN (FULL):', t.clipboardPlain);
}

describe('gutter-selected toggle → Ctrl+C (exact QA reproduction)', () => {
  const ejuBlocks = markdownToBlocks(EJU_NOTE_MD).filter(
    b => b.type !== 'paragraph' || b.content.trim() !== '',
  );
  const grammarToggle = ejuBlocks.find(b => b.type === 'toggle' && b.content === 'Grammar Module')!;
  const childIds = grammarToggle.children.map(c => c.id);

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

  it('PRIMARY — gutter click toggle header → Ctrl+C (cold, no prior text focus)', () => {
    ({ root } = mountEjuEditor(ejuBlocks));
    layoutToggleRects(grammarToggle.id, childIds);
    stubElementFromPoint([grammarToggle.id, ...childIds]);

    const strip = document.querySelector(
      `[data-gutter-block-id="${grammarToggle.id}"] .be-gutter-strip`,
    ) as HTMLElement;
    expect(strip).toBeTruthy();

    firePointer(strip, 'pointerdown', 10);
    firePointer(strip, 'pointerup', 10);

    expect(visualSelectedIds()).toEqual([grammarToggle.id]);

    const trace = traceGutterCopy(
      'PRIMARY: gutter click Grammar toggle → Ctrl+C (cold)',
      ejuBlocks,
      new Set([grammarToggle.id]),
      grammarToggle,
    );
    dumpTrace(trace);

    expect(trace.selectedBlockIds).toContain(grammarToggle.id);
    expect(trace.collectBlocksForCopy[0]?.type).toBe('toggle');
    expect(trace.path).toBe('single-gutter-full-block');
    expect(trace.preventedDefault).toBe(true);
    expect(trace.htmlClassification).toBe('semantic-details');
    expect(trace.semanticExecuted).toBe(true);
    expect(trace.clipboardHtml).toContain('<details class="btoggle"');
    expect(trace.firstDivergence).toBeNull();
  });

  it('CONTRADICTION — gutter click after partial header text selection (active editable)', () => {
    ({ root } = mountEjuEditor(ejuBlocks));
    layoutToggleRects(grammarToggle.id, childIds);
    stubElementFromPoint([grammarToggle.id, ...childIds]);

    const headerEditable = document.querySelector(
      `[data-drag-id="${grammarToggle.id}"] .be-editable`,
    ) as HTMLElement;
    expect(headerEditable).toBeTruthy();

    act(() => {
      headerEditable.focus();
      setSelectionOffsets(headerEditable, 0, 7); // partial "Grammar"
    });

    const strip = document.querySelector(
      `[data-gutter-block-id="${grammarToggle.id}"] .be-gutter-strip`,
    ) as HTMLElement;
    firePointer(strip, 'pointerdown', 10);
    firePointer(strip, 'pointerup', 10);

    const trace = traceGutterCopy(
      'CONTRADICTION: partial header select → gutter click → Ctrl+C',
      ejuBlocks,
      new Set([grammarToggle.id]),
      grammarToggle,
    );
    dumpTrace(trace);

    // eslint-disable-next-line no-console
    console.info('\n========== GUTTER COPY VERDICT ==========');
    // eslint-disable-next-line no-console
    console.info({
      A_semanticExecuted: trace.semanticExecuted,
      B_selectedHasToggleId: trace.selectedBlockIds.includes(grammarToggle.id),
      C_collectReturnsToggle: trace.collectBlocksForCopy[0]?.type === 'toggle',
      path: trace.path,
      preventedDefault: trace.preventedDefault,
      htmlClassification: trace.htmlClassification,
      activeBlockId: trace.activeBlockId,
      activeBlockType: trace.activeBlockType,
      firstDivergence: trace.firstDivergence,
    });

    expect(trace.selectedBlockIds).toContain(grammarToggle.id);
    expect(trace.collectBlocksForCopy[0]?.type).toBe('toggle');
    expect(trace.path).toBe('single-gutter-full-block');
    expect(trace.preventedDefault).toBe(true);
    expect(trace.semanticExecuted).toBe(true);
  });

  it('UX-3A.4 — gutter selected + partial text retained → semantic toggle copy', () => {
    ({ root } = mountEjuEditor(ejuBlocks));
    layoutToggleRects(grammarToggle.id, childIds);

    const headerEditable = document.querySelector(
      `[data-drag-id="${grammarToggle.id}"] .be-editable`,
    ) as HTMLElement;

    act(() => {
      headerEditable.focus();
      setSelectionOffsets(headerEditable, 0, 7);
    });

    // Simulate gutter select WITHOUT removeAllRanges (bypass gutter handler)
    const trace = traceGutterCopy(
      'UX-3A.4: selectedIds set + partial header selection at copy (no gutter clear)',
      ejuBlocks,
      new Set([grammarToggle.id]),
      grammarToggle,
    );
    dumpTrace(trace);

    expect(trace.path).toBe('single-gutter-full-block');
    expect(trace.preventedDefault).toBe(true);
    expect(trace.semanticExecuted).toBe(true);
    expect(trace.blocksCopied).toBe(1);
    expect(trace.htmlClassification).toBe('semantic-details');
    expect(trace.clipboardHtml).toContain('btoggle');
  });

  it('FAILURE MODE — gutter click while focus in child h2 inside toggle', () => {
    ({ root } = mountEjuEditor(ejuBlocks));
    layoutToggleRects(grammarToggle.id, childIds);
    stubElementFromPoint([grammarToggle.id, ...childIds]);

    const h2Editable = document.querySelector(
      `[data-drag-id="${grammarToggle.children[0].id}"] .be-editable`,
    ) as HTMLElement;
    act(() => {
      h2Editable?.focus();
      setSelectionOffsets(h2Editable, 0, 5); // partial "Parti"
    });

    const strip = document.querySelector(
      `[data-gutter-block-id="${grammarToggle.id}"] .be-gutter-strip`,
    ) as HTMLElement;
    firePointer(strip, 'pointerdown', 10);
    firePointer(strip, 'pointerup', 10);

    const trace = traceGutterCopy(
      'FAILURE MODE: focus in child h2 partial + gutter select toggle → Ctrl+C',
      ejuBlocks,
      new Set([grammarToggle.id]),
      grammarToggle,
    );
    dumpTrace(trace);

    // activeElement is child h2; partial check uses h2 text length
    // After gutter removeAllRanges, getSelectionOffsets returns null → full h2 → passes
    expect(trace.path).toBe('single-gutter-full-block');
    expect(trace.semanticExecuted).toBe(true);
    expect(trace.collectBlocksForCopy[0]?.type).toBe('toggle');
  });

  it('UX-3A.4 — grip click + partial text + toggle selected → semantic copy', () => {
    ({ root } = mountEjuEditor(ejuBlocks));

    const headerEditable = document.querySelector(
      `[data-drag-id="${grammarToggle.id}"] .be-editable`,
    ) as HTMLElement;
    act(() => {
      headerEditable.focus();
      setSelectionOffsets(headerEditable, 0, 7);
    });

    const grip = document.querySelector(
      `[data-drag-id="${grammarToggle.id}"] .be-grip`,
    ) as HTMLButtonElement;
    expect(grip).toBeTruthy();
    act(() => {
      grip.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });

    const trace = traceGutterCopy(
      'UX-3A.4: partial header + grip select (not gutter strip) → Ctrl+C',
      ejuBlocks,
      new Set([grammarToggle.id]),
      grammarToggle,
    );
    dumpTrace(trace);

    expect(trace.path).toBe('single-gutter-full-block');
    expect(trace.preventedDefault).toBe(true);
    expect(trace.semanticExecuted).toBe(true);
    expect(trace.collectBlocksForCopy[0]?.type).toBe('toggle');
    expect(trace.clipboardHtml).toContain('btoggle');
  });

  it('FAILURE MODE — child block gutter (not toggle header gutter)', () => {
    ({ root } = mountEjuEditor(ejuBlocks));
    layoutToggleRects(grammarToggle.id, childIds);
    stubElementFromPoint([grammarToggle.id, ...childIds]);

    const child = grammarToggle.children[0]; // Particles h2
    const strip = document.querySelector(
      `[data-gutter-block-id="${child.id}"] .be-gutter-strip`,
    ) as HTMLElement;
    expect(strip).toBeTruthy();
    firePointer(strip, 'pointerdown', ROW_H + 10);
    firePointer(strip, 'pointerup', ROW_H + 10);

    const trace = traceGutterCopy(
      'FAILURE MODE: gutter click on child h2 inside toggle → Ctrl+C',
      ejuBlocks,
      new Set([child.id]),
      child,
    );
    dumpTrace(trace);

    expect(trace.selectedBlockIds).toEqual([child.id]);
    expect(trace.collectBlocksForCopy[0]?.type).toBe('heading2');
    expect(trace.path).toBe('single-gutter-full-block');
    expect(trace.semanticExecuted).toBe(true);
    expect(trace.clipboardHtml).toContain('<h2>Particles</h2>');
    expect(trace.clipboardHtml).not.toContain('btoggle');
    expect(trace.firstDivergence).toBeNull();
    expect(firstTypeDivergence(
      blockShape([grammarToggle]),
      trace.collectBlocksForCopy,
    )).toMatch(/type toggle vs heading2/);
  });
});
