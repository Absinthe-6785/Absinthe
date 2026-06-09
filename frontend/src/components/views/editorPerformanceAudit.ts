/**
 * editorPerformanceAudit.ts — UX-5D large-document performance instrumentation
 *
 * Development/test-only measurement helpers. No production behavior changes.
 */
import { createElement, type ProfilerOnRenderCallback } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { Profiler } from 'react';
import { BlockEditor } from './BlockEditor';
import { EDITOR_CHROME_STYLES } from './editorChromeStyles';
import {
  blocksToMarkdown,
  findBlockById,
  flattenBlockIds,
  markdownToBlocks,
  updateBlockById,
  type Block,
} from './blockUtils';
import { collectEditorSearchMatches } from './editorSearch';
import { commitDragDrop } from './editorDragDrop';
import { generateBenchmarkBlocks, measureMs } from './editorBenchmark';
import {
  applySemanticCopy,
  applyPasteBlocksAt,
  blocksToCopyHtml,
  clipboardToBlocks,
  collectBlocksForCopy,
} from './features/block-editor/features/clipboard';
import { validateBlockTree } from './features/block-editor/validation/blockTreeValidator';

export const AUDIT_SIZES = [100, 250, 500, 1000, 2000] as const;
export type AuditSize = (typeof AUDIT_SIZES)[number];

const SEARCH_QUERY = 'paragraph';
const MIDDLE_CHAR = 'x';

export interface DataLayerMetrics {
  blocks: number;
  totalNodes: number;
  markdownBytes: number;
  parseMs: number;
  serializeMs: number;
  keystrokeMs: number;
  backspaceMs: number;
  tableEditMs: number;
  searchIndexMs: number;
  searchNavigateMs: number;
  copy1Ms: number;
  copy50Ms: number;
  copy200Ms: number;
  paste1Ms: number;
  paste50Ms: number;
  paste200Ms: number;
  validateTreeMs: number;
  dragCommitMs: number;
}

export interface MountMetrics {
  mountMs: number;
  domBlockCount: number;
  domEditableCount: number;
  profilerCommitMs: number;
  profilerRenderCount: number;
}

export interface InvalidationMetrics {
  selectionChangeRerenders: number;
  multiSelectRerenders: number;
  dragStateRerenders: number;
  searchHighlightRerenders: number;
}

export interface PerformanceAuditRow extends DataLayerMetrics, MountMetrics, InvalidationMetrics {}

const AUDIT_COLORS = {
  bg: '#fff', text: '#111', textMuted: '#666', textFaint: '#999',
  accent: '#8B5CF6', accentBg: '#eee', border: '#ddd', card: '#fff',
  cardHov: '#f5f5f5', input: '#fff', inputBdr: '#ccc', toolbar: '#f9f9f9',
  danger: '#f00', green: '#0f0', codeBg: '#f1f5f9', calloutBg: '#fafafa',
  toggleBg: 'transparent', quoteBdr: '#ccc', selection: '#eef',
};

function middleBlockId(blocks: Block[]): string {
  const ids = flattenBlockIds(blocks);
  return ids[Math.floor(ids.length / 2)] ?? ids[0];
}

/** Mirrors useBlockEditor.handleBlockChange hot path (update + serialize). */
export function simulateKeystroke(blocks: Block[], blockId: string): Block[] {
  const next = updateBlockById(blocks, blockId, b => ({
    ...b,
    content: `${b.content}${MIDDLE_CHAR}`,
  }));
  blocksToMarkdown(next);
  return next;
}

/** Mirrors backspace merge: delete char + serialize. */
export function simulateBackspace(blocks: Block[], blockId: string): Block[] {
  const next = updateBlockById(blocks, blockId, b => ({
    ...b,
    content: b.content.slice(0, -1),
  }));
  blocksToMarkdown(next);
  return next;
}

/** Table cell edit path. */
export function simulateTableEdit(blocks: Block[]): Block[] {
  const table = blocks.find(b => b.type === 'table');
  if (!table) return blocks;
  const headers = [...(table.tableHeaders ?? [])];
  const rows = (table.tableRows ?? []).map(r => [...r]);
  if (rows[0]) rows[0][0] = `${rows[0][0]}!`;
  const next = updateBlockById(blocks, table.id, b => ({
    ...b,
    tableHeaders: headers,
    tableRows: rows,
  }));
  blocksToMarkdown(next);
  return next;
}

function measureCopy(blocks: Block[], count: number): number {
  const ids = flattenBlockIds(blocks).slice(0, count);
  return measureMs(() => {
    const subset = collectBlocksForCopy(blocks, ids);
    const html = blocksToCopyHtml(subset);
    const clipboard = {
      setData: () => {},
      getData: (type: string) => (type === 'text/html' ? html : blocksToMarkdown(subset)),
    };
    applySemanticCopy(subset, clipboard);
    void clipboard.getData('text/html');
  });
}

function paragraphTargetId(blocks: Block[]): string {
  for (const id of flattenBlockIds(blocks)) {
    const b = findBlockById(blocks, id);
    if (b?.type === 'paragraph') return id;
  }
  return middleBlockId(blocks);
}

function measurePaste(blocks: Block[], count: number): number {
  const ids = flattenBlockIds(blocks).slice(0, count);
  const subset = collectBlocksForCopy(blocks, ids);
  const html = blocksToCopyHtml(subset);
  const clipboard = {
    getData: (type: string) => (type === 'text/html' ? html : blocksToMarkdown(subset)),
  };
  const targetId = paragraphTargetId(blocks);
  const target = blocks.find(b => b.id === targetId);
  const offset = Math.min(5, target?.content?.length ?? 0);

  return measureMs(() => {
    const pasted = clipboardToBlocks(clipboard);
    if (!pasted) return;
    applyPasteBlocksAt(blocks, targetId, offset, offset, pasted);
    assertValidBlockTreeQuick(pasted);
  });
}

function assertValidBlockTreeQuick(blocks: Block[]): void {
  validateBlockTree(blocks);
}

export function measureSearchNavigate(blocks: Block[], steps = 10): number {
  const matches = collectEditorSearchMatches(blocks, SEARCH_QUERY);
  if (matches.length === 0) return 0;
  return measureMs(() => {
    for (let i = 0; i < steps; i++) {
      const idx = i % matches.length;
      collectEditorSearchMatches(blocks, SEARCH_QUERY);
      void matches[idx];
    }
  });
}

export function estimateInvalidation(blocks: Block[]): InvalidationMetrics {
  const rootCount = blocks.length;
  const totalNodes = flattenBlockIds(blocks).length;
  const matchCount = collectEditorSearchMatches(blocks, SEARCH_QUERY).length;

  return {
    selectionChangeRerenders: 2,
    multiSelectRerenders: Math.min(10, rootCount),
    dragStateRerenders: rootCount,
    searchHighlightRerenders: matchCount,
  };
}

export function runDataLayerAudit(size: number): DataLayerMetrics {
  const blocks = generateBenchmarkBlocks(size);
  const ids = flattenBlockIds(blocks);
  const mid = middleBlockId(blocks);
  const md = blocksToMarkdown(blocks);

  const parseMs = measureMs(() => { markdownToBlocks(md); });
  const serializeMs = measureMs(() => { blocksToMarkdown(blocks); });

  const keystrokeMs = measureMs(() => { simulateKeystroke(blocks, mid); });
  const backspaceMs = measureMs(() => { simulateBackspace(blocks, mid); });
  const tableEditMs = measureMs(() => { simulateTableEdit(blocks); });

  const searchIndexMs = measureMs(() => {
    collectEditorSearchMatches(blocks, SEARCH_QUERY);
  });
  const searchNavigateMs = measureSearchNavigate(blocks);

  const copy1Ms = measureCopy(blocks, 1);
  const copy50Ms = size >= 50 ? measureCopy(blocks, 50) : copy1Ms;
  const copy200Ms = size >= 200 ? measureCopy(blocks, 200) : measureCopy(blocks, Math.min(size, ids.length));

  const paste1Ms = measurePaste(blocks, 1);
  const paste50Ms = size >= 50 ? measurePaste(blocks, 50) : paste1Ms;
  const paste200Ms = size >= 200 ? measurePaste(blocks, 200) : measurePaste(blocks, Math.min(size, ids.length));

  const validateTreeMs = measureMs(() => {
    validateBlockTree(blocks);
  });

  const dragCommitMs = measureMs(() => {
    if (ids.length < 3) return;
    const dragId = ids[1];
    const overId = ids[ids.length - 2];
    commitDragDrop(blocks, [dragId], overId, 'after');
  });

  return {
    blocks: size,
    totalNodes: ids.length,
    markdownBytes: md.length,
    parseMs,
    serializeMs,
    keystrokeMs,
    backspaceMs,
    tableEditMs,
    searchIndexMs,
    searchNavigateMs,
    copy1Ms,
    copy50Ms,
    copy200Ms,
    paste1Ms,
    paste50Ms,
    paste200Ms,
    validateTreeMs,
    dragCommitMs,
  };
}

export interface MountEditorAuditOptions {
  virtualBlocksPoc?: boolean;
  scrollHeightPx?: number;
}

export function mountEditorForAudit(
  blocks: Block[],
  options: MountEditorAuditOptions = {},
): { root: Root; container: HTMLDivElement } {
  document.body.innerHTML = '';
  document.head.innerHTML = '';
  const style = document.createElement('style');
  style.textContent = EDITOR_CHROME_STYLES;
  document.head.appendChild(style);

  const scrollZone = document.createElement('div');
  scrollZone.className = 'editor-drop-zone';
  scrollZone.style.height = `${options.scrollHeightPx ?? 600}px`;
  scrollZone.style.overflow = 'auto';
  scrollZone.style.width = '100%';
  document.body.appendChild(scrollZone);

  const container = document.createElement('div');
  scrollZone.appendChild(container);

  const virtualScrollParentRef = { current: scrollZone };

  let root: Root | null = null;
  act(() => {
    root = createRoot(container);
    root.render(createElement(BlockEditor, {
      blocks,
      onChange: () => {},
      colors: AUDIT_COLORS,
      readOnly: false,
      searchQuery: SEARCH_QUERY,
      virtualBlocksPoc: options.virtualBlocksPoc,
      virtualScrollParentRef,
    }));
  });

  if (options.virtualBlocksPoc) {
    act(() => {});
    act(() => {});
  }

  return { root: root!, container };
}

export function measureMount(
  blocks: Block[],
  options: MountEditorAuditOptions = {},
): MountMetrics {
  const t0 = performance.now();
  mountEditorForAudit(blocks, options);
  const mountMs = performance.now() - t0;

  const domBlockCount = document.querySelectorAll('[data-drag-id]').length;
  const domEditableCount = document.querySelectorAll('.be-editable').length;

  return {
    mountMs,
    domBlockCount,
    domEditableCount,
    profilerCommitMs: 0,
    profilerRenderCount: 0,
  };
}

export function measureMountWithProfiler(blocks: Block[]): MountMetrics {
  document.body.innerHTML = '';
  document.head.innerHTML = '';
  const style = document.createElement('style');
  style.textContent = EDITOR_CHROME_STYLES;
  document.head.appendChild(style);

  const container = document.createElement('div');
  container.className = 'be-editor-root be-document-edit';
  document.body.appendChild(container);

  let profilerCommitMs = 0;
  let profilerRenderCount = 0;
  const onRender: ProfilerOnRenderCallback = (_id, phase, actualDuration) => {
    if (phase === 'mount' || phase === 'update') {
      profilerCommitMs += actualDuration;
      profilerRenderCount += 1;
    }
  };

  const t0 = performance.now();
  act(() => {
    const root = createRoot(container);
    root.render(
      createElement(
        Profiler,
        { id: 'BlockEditorAudit', onRender },
        createElement(BlockEditor, {
          blocks,
          onChange: () => {},
          colors: AUDIT_COLORS,
          readOnly: false,
        }),
      ),
    );
  });
  const mountMs = performance.now() - t0;

  return {
    mountMs,
    domBlockCount: document.querySelectorAll('[data-drag-id]').length,
    domEditableCount: document.querySelectorAll('.be-editable').length,
    profilerCommitMs,
    profilerRenderCount,
  };
}

export function runFullAudit(size: number, includeMount = true): PerformanceAuditRow {
  const data = runDataLayerAudit(size);
  const invalidation = estimateInvalidation(generateBenchmarkBlocks(size));
  const mount = includeMount ? measureMount(generateBenchmarkBlocks(size)) : {
    mountMs: 0,
    domBlockCount: 0,
    domEditableCount: 0,
    profilerCommitMs: 0,
    profilerRenderCount: 0,
  };

  return { ...data, ...mount, ...invalidation };
}

export function formatAuditTable(rows: PerformanceAuditRow[]): string {
  const header = '| Metric | ' + rows.map(r => r.blocks).join(' | ') + ' |';
  const sep = '| --- | ' + rows.map(() => '---').join(' | ') + ' |';
  const lines = [
    header,
    sep,
    row('Mount (ms)', rows, r => r.mountMs.toFixed(0)),
    row('DOM blocks', rows, r => String(r.domBlockCount)),
    row('Keystroke (ms)', rows, r => r.keystrokeMs.toFixed(2)),
    row('Serialize/keystroke (ms)', rows, r => r.serializeMs.toFixed(2)),
    row('Search index (ms)', rows, r => r.searchIndexMs.toFixed(2)),
    row('Copy 50 (ms)', rows, r => r.copy50Ms.toFixed(1)),
    row('Copy 200 (ms)', rows, r => r.copy200Ms.toFixed(1)),
    row('Paste 50 (ms)', rows, r => r.paste50Ms.toFixed(1)),
    row('Paste 200 (ms)', rows, r => r.paste200Ms.toFixed(1)),
    row('Drag rerenders', rows, r => String(r.dragStateRerenders)),
    row('Search highlight blocks', rows, r => String(r.searchHighlightRerenders)),
    row('Markdown (KB)', rows, r => (r.markdownBytes / 1024).toFixed(1)),
  ];
  return lines.join('\n');
}

function row(label: string, rows: PerformanceAuditRow[], fmt: (r: PerformanceAuditRow) => string): string {
  return `| ${label} | ${rows.map(fmt).join(' | ')} |`;
}
