// @vitest-environment happy-dom
/**
 * single-gutter-partial-fallback — exact trigger condition + removeAllRanges patch test.
 * Run: npm test -- gutterPartialFallback.investigation --disable-console-intercept
 */
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BlockEditor } from './BlockEditor';
import { collectBlocksForCopy, handleEditorCopyEvent } from './blockCopy';
import { classifyClipboardHtml } from './copyDiagnostics';
import { EDITOR_CHROME_STYLES } from './editorChromeStyles';
import { readBlockText, setSelectionOffsets } from './editableDom';
import { getSelectionOffsets } from './selectionOffsets';
import { markdownToBlocks, type Block } from './blockUtils';

const EJU_NOTE_MD = `# EJU Study Timeline

> Grammar Module
  ## Particles
  - は vs が
  - を particle usage
  > Vocab nest
    ### Core kanji
    - 読む`;

const ROW_H = 48;

interface DomSelectionSnapshot {
  rangeCount: number;
  isCollapsed: boolean;
  startOffset: number | null;
  endOffset: number | null;
  getSelectionOffsetsOnActive: { start: number; end: number } | null;
  activeTextLength: number | null;
  wouldTriggerPartialFallback: boolean;
  partialFallbackReason: string | null;
}

interface StepTrace {
  step: string;
  selectedBlockIds: string[];
  visualSelectedIds: string[];
  activeBlockId: string | null;
  activeBlockType: string | null;
  activeIsEditable: boolean;
  domSelection: DomSelectionSnapshot;
  removeAllRangesCallCount: number;
}

interface CopyOutcome {
  path: string | null;
  preventedDefault: boolean;
  htmlClassification: string;
  selectionStart: number | null;
  selectionEnd: number | null;
  semanticSkippedReason: string | null;
  clipboardHtmlPreview: string;
}

function rect(left: number, top: number, w: number, h: number): DOMRect {
  return {
    left, top, width: w, height: h, right: left + w, bottom: top + h, x: left, y: top,
    toJSON: () => ({}),
  } as DOMRect;
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

function layoutToggleRects(toggleId: string, childIds: string[]) {
  [toggleId, ...childIds].forEach((id, i) => {
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

function visualSelectedIds(): string[] {
  return [...document.querySelectorAll('.be-block-selected')].map(
    el => el.getAttribute('data-drag-id') ?? '',
  ).filter(Boolean);
}

function firePointer(el: Element, type: 'pointerdown' | 'pointerup', y: number, x = 22) {
  act(() => {
    el.dispatchEvent(new PointerEvent(type, {
      bubbles: true, cancelable: true, clientX: x, clientY: y,
      pointerId: 1, button: 0, buttons: type === 'pointerup' ? 0 : 1, pointerType: 'mouse',
    }));
  });
}

function snapshotDomSelection(removeAllRangesCalls: number): DomSelectionSnapshot {
  const active = document.activeElement as HTMLElement | null;
  const sel = window.getSelection();
  const offsets = active?.classList.contains('be-editable')
    ? getSelectionOffsets(active)
    : null;
  const textLen = active?.classList.contains('be-editable') ? readBlockText(active).length : null;

  let start = offsets?.start ?? 0;
  let end = offsets?.end ?? (textLen ?? 0);
  if (active?.classList.contains('be-editable') && !offsets && textLen != null) {
    start = 0;
    end = textLen;
  }

  const wouldTrigger = !!(active?.classList.contains('be-editable')
    && textLen != null
    && (start !== 0 || end !== textLen));

  let partialFallbackReason: string | null = null;
  if (wouldTrigger) {
    partialFallbackReason = `activeElement is .be-editable (block ${active?.getAttribute('data-block-id')}) `
      + `with non-full text range start=${start} end=${end} textLength=${textLen} `
      + `(condition: start !== 0 || end !== text.length)`;
  }

  return {
    rangeCount: sel?.rangeCount ?? 0,
    isCollapsed: sel?.isCollapsed ?? true,
    startOffset: offsets?.start ?? null,
    endOffset: offsets?.end ?? null,
    getSelectionOffsetsOnActive: offsets,
    activeTextLength: textLen,
    wouldTriggerPartialFallback: wouldTrigger,
    partialFallbackReason,
    removeAllRangesCallCount: removeAllRangesCalls,
  };
}

function captureStep(step: string, removeAllRangesCalls: number): StepTrace {
  const active = document.activeElement as HTMLElement | null;
  return {
    step,
    selectedBlockIds: visualSelectedIds(),
    visualSelectedIds: visualSelectedIds(),
    activeBlockId: active?.getAttribute('data-block-id') ?? null,
    activeBlockType: active?.getAttribute('data-block-type') ?? null,
    activeIsEditable: active?.classList.contains('be-editable') ?? false,
    domSelection: snapshotDomSelection(removeAllRangesCalls),
    removeAllRangesCallCount: removeAllRangesCalls,
  };
}

function runCopy(rootBlocks: Block[], selectedIds: Set<string>): CopyOutcome {
  const data: Record<string, string> = {};
  let prevented = false;
  const clipboard = new DataTransfer();
  const report = handleEditorCopyEvent(
    {
      clipboardData: clipboard,
      preventDefault: () => { prevented = true; },
    },
    rootBlocks,
    selectedIds,
  );

  let semanticSkippedReason: string | null = null;
  if (report?.path === 'single-gutter-partial-fallback') {
    semanticSkippedReason = report.selectionStart != null && report.selectionEnd != null
      ? `single-gutter branch: active .be-editable has partial range `
        + `[${report.selectionStart}, ${report.selectionEnd}] vs text length ${report.selectionLength}`
      : 'single-gutter branch: partial text selection on active .be-editable';
  }

  return {
    path: report?.path ?? null,
    preventedDefault: prevented,
    htmlClassification: report?.htmlClassification ?? classifyClipboardHtml(data['text/html'] ?? ''),
    selectionStart: report?.selectionStart ?? null,
    selectionEnd: report?.selectionEnd ?? null,
    semanticSkippedReason,
    clipboardHtmlPreview: data['text/html'] ?? clipboard.getData('text/html') ?? '',
  };
}

describe('single-gutter-partial-fallback exact condition', () => {
  const ejuBlocks = markdownToBlocks(EJU_NOTE_MD).filter(
    b => b.type !== 'paragraph' || b.content.trim() !== '',
  );
  const grammarToggle = ejuBlocks.find(b => b.type === 'toggle' && b.content === 'Grammar Module')!;
  const childIds = grammarToggle.children.map(c => c.id);

  let root: Root | null = null;
  let removeAllRangesSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    removeAllRangesSpy = vi.spyOn(window.getSelection()!, 'removeAllRanges');
  });

  afterEach(() => {
    act(() => { root?.unmount(); });
    document.body.innerHTML = '';
    document.head.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('exact 5-step sequence — with current gutter removeAllRanges (production)', () => {
    ({ root } = mountEjuEditor(ejuBlocks));
    layoutToggleRects(grammarToggle.id, childIds);
    stubElementFromPoint([grammarToggle.id, ...childIds]);

    const headerEditable = document.querySelector(
      `[data-drag-id="${grammarToggle.id}"] .be-editable`,
    ) as HTMLElement;
    const strip = document.querySelector(
      `[data-gutter-block-id="${grammarToggle.id}"] .be-gutter-strip`,
    ) as HTMLElement;

    const trace: StepTrace[] = [];

    // Step 1: toggle open (default in editor)
    trace.push(captureStep('1: toggle open', removeAllRangesSpy.mock.calls.length));

    // Step 2: click inside toggle text
    act(() => {
      headerEditable.focus();
      headerEditable.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    trace.push(captureStep('2: click inside toggle text', removeAllRangesSpy.mock.calls.length));

    // Step 3: partial text selection active
    act(() => { setSelectionOffsets(headerEditable, 0, 7); });
    trace.push(captureStep('3: partial selection (0..7)', removeAllRangesSpy.mock.calls.length));

    // Step 4: gutter strip click
    removeAllRangesSpy.mockClear();
    firePointer(strip, 'pointerdown', 10);
    firePointer(strip, 'pointerup', 10);
    trace.push(captureStep('4: after gutter strip click', removeAllRangesSpy.mock.calls.length));

    // Step 5: Ctrl+C
    const copy = runCopy(ejuBlocks, new Set([grammarToggle.id]));

    // eslint-disable-next-line no-console
    console.info('\n========== EXACT 5-STEP SEQUENCE (production gutter) ==========');
    // eslint-disable-next-line no-console
    console.info(JSON.stringify({ trace, copy, collected: collectBlocksForCopy(ejuBlocks, [grammarToggle.id]).map(b => b.type) }, null, 2));

    expect(trace[2].domSelection.wouldTriggerPartialFallback).toBe(true);
    expect(trace[3].removeAllRangesCallCount).toBeGreaterThan(0);
    expect(trace[3].domSelection.rangeCount).toBe(0);
    expect(trace[3].domSelection.getSelectionOffsetsOnActive).toBeNull();
    expect(trace[3].domSelection.wouldTriggerPartialFallback).toBe(false);
    expect(copy.path).toBe('single-gutter-full-block');
    expect(copy.preventedDefault).toBe(true);
    expect(copy.semanticSkippedReason).toBeNull();
    expect(copy.clipboardHtmlPreview).toContain('btoggle');
  });

  it('PATCH A/B — noop removeAllRanges on gutter → partial-fallback returns', () => {
    ({ root } = mountEjuEditor(ejuBlocks));
    layoutToggleRects(grammarToggle.id, childIds);

    const headerEditable = document.querySelector(
      `[data-drag-id="${grammarToggle.id}"] .be-editable`,
    ) as HTMLElement;
    const strip = document.querySelector(
      `[data-gutter-block-id="${grammarToggle.id}"] .be-gutter-strip`,
    ) as HTMLElement;

    act(() => {
      headerEditable.focus();
      setSelectionOffsets(headerEditable, 0, 7);
    });

    // Patch OFF: prevent gutter from clearing DOM selection
    removeAllRangesSpy.mockImplementation(() => {});

    firePointer(strip, 'pointerdown', 10);
    firePointer(strip, 'pointerup', 10);

    const afterGutter = captureStep('after gutter (removeAllRanges noop)', removeAllRangesSpy.mock.calls.length);
    const copyWithoutClear = runCopy(ejuBlocks, new Set([grammarToggle.id]));

    // Patch ON: restore real removeAllRanges, re-run copy logic on current DOM
    removeAllRangesSpy.mockRestore();
    window.getSelection()?.removeAllRanges();
    const afterClear = captureStep('after manual removeAllRanges', 1);
    const copyWithClear = runCopy(ejuBlocks, new Set([grammarToggle.id]));

    // eslint-disable-next-line no-console
    console.info('\n========== PATCH A/B: removeAllRanges on gutter selection ==========');
    // eslint-disable-next-line no-console
    console.info(JSON.stringify({
      withoutClear: { afterGutter: afterGutter.domSelection, copy: copyWithoutClear },
      withClear: { afterGutter: afterClear.domSelection, copy: copyWithClear },
      verdict: {
        removeAllRangesMakesCopyDeterministic: copyWithClear.path === 'single-gutter-full-block'
          && copyWithoutClear.path === 'single-gutter-partial-fallback',
        browserSelectionSurvivesGutterWhenNoClear: afterGutter.domSelection.rangeCount > 0
          || afterGutter.domSelection.getSelectionOffsetsOnActive != null,
      },
    }, null, 2));

    expect(afterGutter.domSelection.wouldTriggerPartialFallback).toBe(true);
    expect(copyWithoutClear.path).toBe('single-gutter-partial-fallback');
    expect(copyWithoutClear.semanticSkippedReason).toContain('partial range');
    expect(afterClear.domSelection.wouldTriggerPartialFallback).toBe(false);
    expect(copyWithClear.path).toBe('single-gutter-full-block');
    expect(copyWithClear.clipboardHtmlPreview).toContain('btoggle');
  });

  it('documents exact partial-fallback predicate', () => {
    const predicate = {
      branch: 'selectedIds.size === 1',
      guard: 'activeElement.classList.contains("be-editable")',
      condition: 'start !== 0 || end !== text.length',
      startEndSource: 'getSelectionOffsets(active) ?? { start: 0, end: readBlockText(active).length }',
      note: 'Collapsed caret (getSelectionOffsets returns null) counts as full-block → semantic copy proceeds',
    };

    // eslint-disable-next-line no-console
    console.info('\n========== PARTIAL-FALLBACK PREDICATE ==========');
    // eslint-disable-next-line no-console
    console.info(JSON.stringify(predicate, null, 2));

    expect(predicate.condition).toBeTruthy();
  });
});
