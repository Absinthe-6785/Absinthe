/**
 * copyDiagnostics.ts — TEMPORARY UX-3A copy-path runtime trace (remove after QA)
 */
import type { Block } from './blockUtils';
import { readBlockText } from './editableDom';
import { getSelectionOffsets } from './selectionOffsets';

const PREVIEW_LEN = 1000;

export type CopyPath =
  | 'handler-not-registered-readonly'
  | 'handler-not-registered-nested-depth'
  | 'skipped-no-clipboard'
  | 'multi-select'
  | 'single-gutter-full-block'
  | 'single-gutter-partial-fallback'
  | 'editable-full-block'
  | 'editable-toggle-header'
  | 'editable-partial-fallback'
  | 'editable-no-block-id'
  | 'editable-not-focused';

export interface CopyTraceReport {
  path: CopyPath;
  preventedDefault: boolean;
  selectedBlockIds: string[];
  activeBlockId: string | null;
  activeBlockType: string | null;
  selectionStart: number | null;
  selectionEnd: number | null;
  selectionLength: number | null;
  blocksCopied: number;
  expectedHtml: string | null;
  expectedPlain: string | null;
  clipboardHtmlAfterHandler: string | null;
  clipboardPlainAfterHandler: string | null;
  htmlClassification: ClipboardHtmlKind;
}

export type ClipboardHtmlKind =
  | 'empty'
  | 'semantic-details'
  | 'semantic-btoggle'
  | 'dom-be-toggle'
  | 'dom-other'
  | 'unknown';

export function classifyClipboardHtml(html: string): ClipboardHtmlKind {
  if (!html.trim()) return 'empty';
  if (/<details\b/i.test(html) && /<summary\b/i.test(html)) return 'semantic-details';
  if (/\bbtoggle\b/i.test(html) || /\bbtbody\b/i.test(html)) return 'semantic-btoggle';
  if (/\bbe-toggle-wrap\b/i.test(html) || /\bbe-toggle-children\b/i.test(html)) return 'dom-be-toggle';
  if (/<[a-z]/i.test(html)) return 'dom-other';
  return 'unknown';
}

function preview(text: string | null): string | null {
  if (text == null) return null;
  return text.slice(0, PREVIEW_LEN);
}

export function logCopyTrace(report: CopyTraceReport): void {
  if (!import.meta.env.DEV) return;

  const semantic = report.expectedHtml != null
    && report.clipboardHtmlAfterHandler === report.expectedHtml;

  console.warn('[UX-3A copy:trace]', {
    path: report.path,
    preventedDefault: report.preventedDefault,
    selectedBlockIds: report.selectedBlockIds,
    activeBlockId: report.activeBlockId,
    activeBlockType: report.activeBlockType,
    selection: report.selectionStart != null
      ? { start: report.selectionStart, end: report.selectionEnd, length: report.selectionLength }
      : null,
    blocksCopied: report.blocksCopied,
    htmlClassification: report.htmlClassification,
    semanticHtmlMatchesExpected: semantic,
    expectedHtmlPreview: preview(report.expectedHtml),
    clipboardHtmlPreview: preview(report.clipboardHtmlAfterHandler),
    expectedPlainPreview: preview(report.expectedPlain),
    clipboardPlainPreview: preview(report.clipboardPlainAfterHandler),
  });
}

/** Read clipboard after browser default completes (dev QA only). */
export function schedulePostCopyClipboardRead(label: string): void {
  if (!import.meta.env.DEV || !navigator.clipboard?.read) return;

  window.setTimeout(async () => {
    try {
      const items = await navigator.clipboard.read();
      let html = '';
      let plain = '';
      for (const item of items) {
        if (item.types.includes('text/html')) {
          html = await (await item.getType('text/html')).text();
        }
        if (item.types.includes('text/plain')) {
          plain = await (await item.getType('text/plain')).text();
        }
      }
      console.warn(`[UX-3A copy:post-read:${label}]`, {
        htmlLength: html.length,
        plainLength: plain.length,
        htmlClassification: classifyClipboardHtml(html),
        htmlPreview: preview(html),
        plainPreview: preview(plain),
        hasDetailsSummary: /<details\b/i.test(html) && /<summary\b/i.test(html),
        hasBeToggleWrap: /\bbe-toggle-wrap\b/i.test(html),
      });
    } catch (err) {
      console.warn(`[UX-3A copy:post-read:${label}] clipboard.read failed`, err);
    }
  }, 0);
}

export interface CopyDiagnosticsOptions {
  readOnly: boolean;
  depth: number;
  getRootBlocks: () => Block[];
  getSelectedIds: () => Set<string>;
  onCopy: (e: ClipboardEvent) => CopyTraceReport | null;
}

/**
 * Dev-only listeners:
 * - capture: always logs that copy fired (even when semantic handler not registered)
 * - bubble: logs clipboard after handler / browser default
 */
export function installCopyDiagnostics(opts: CopyDiagnosticsOptions): () => void {
  if (!import.meta.env.DEV) return () => {};

  const onCapture = (e: ClipboardEvent) => {
    const active = document.activeElement as HTMLElement | null;
    const blockId = active?.getAttribute('data-block-id') ?? null;
    let sel: { start: number; end: number } | null = null;
    if (active?.classList.contains('be-editable')) {
      const offsets = getSelectionOffsets(active);
      if (offsets) sel = offsets;
    }

    console.warn('[UX-3A copy:capture]', {
      readOnly: opts.readOnly,
      depth: opts.depth,
      handlerRegistered: opts.depth === 0,
      selectedBlockIds: [...opts.getSelectedIds()],
      activeBlockId: blockId,
      activeTag: active?.tagName ?? null,
      isContentEditable: !!active?.isContentEditable,
      selection: sel,
      defaultPreventedAtCapture: e.defaultPrevented,
    });

    if (opts.depth !== 0) {
      console.warn('[UX-3A copy:capture] semantic handler NOT registered — nested editor depth');
    }
  };

  const onBubble = (e: ClipboardEvent) => {
    const report = opts.onCopy(e);
    if (report) logCopyTrace(report);
    schedulePostCopyClipboardRead(report?.path ?? 'no-handler');

    const html = e.clipboardData?.getData('text/html') ?? '';
    const plain = e.clipboardData?.getData('text/plain') ?? '';
    if (!report) {
      console.warn('[UX-3A copy:bubble-no-semantic-handler]', {
        htmlClassification: classifyClipboardHtml(html),
        htmlPreview: preview(html),
        plainPreview: preview(plain),
        defaultPrevented: e.defaultPrevented,
      });
    }
  };

  window.addEventListener('copy', onCapture, true);
  window.addEventListener('copy', onBubble, false);
  return () => {
    window.removeEventListener('copy', onCapture, true);
    window.removeEventListener('copy', onBubble, false);
  };
}

export function activeSelectionContext(): {
  activeBlockId: string | null;
  activeBlockType: string | null;
  start: number | null;
  end: number | null;
  textLength: number | null;
} {
  const active = document.activeElement as HTMLElement | null;
  if (!active?.classList.contains('be-editable')) {
    return { activeBlockId: null, activeBlockType: null, start: null, end: null, textLength: null };
  }
  const blockId = active.getAttribute('data-block-id');
  const blockType = active.getAttribute('data-block-type');
  const text = readBlockText(active);
  const sel = getSelectionOffsets(active);
  return {
    activeBlockId: blockId,
    activeBlockType: blockType,
    start: sel?.start ?? null,
    end: sel?.end ?? null,
    textLength: text.length,
  };
}
