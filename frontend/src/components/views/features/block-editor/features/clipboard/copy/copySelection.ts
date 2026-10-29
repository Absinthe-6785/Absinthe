/**
 * copySelection.ts — Resolve copy targets from DOM selection (reading mode + edit mode)
 */
import { readBlockText } from '../../../../../editableDom';
import { getSelectionOffsets } from '../../selection';
import { flattenBlockIds, type Block } from '../../../../../blockUtils';

export interface CopySelectionContext {
  activeBlockId: string;
  activeBlockType: string | null;
  start: number;
  end: number;
  textLength: number;
  host: HTMLElement;
}

export type CopySelectionResolve =
  | { kind: 'single'; ctx: CopySelectionContext }
  | { kind: 'toggle-subtree'; blockId: string }
  | { kind: 'multi-block'; blockIds: string[] }
  | { kind: 'not-focused' }
  | { kind: 'partial-fallback' };

function findBlockHost(node: Node | null): HTMLElement | null {
  if (!node) return null;
  const el = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
  return (el?.closest('[data-block-id]') as HTMLElement | null) ?? null;
}

function findTableCell(node: Node | null): HTMLElement | null {
  if (!node) return null;
  const el = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
  return (el?.closest('td, th') as HTMLElement | null) ?? null;
}

/** True when a live, non-collapsed text range belongs to table cells. */
export function hasTableCellTextSelection(): boolean {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return false;

  const range = selection.getRangeAt(0);
  const startCell = findTableCell(range.startContainer);
  const endCell = findTableCell(range.endContainer);
  if (!startCell || !endCell) return false;

  const table = startCell.closest<HTMLTableElement>('table');
  if (!table || endCell.closest('table') !== table) return false;

  if (table.closest('.be-editor-root.be-reading')) return true;

  const active = document.activeElement as HTMLElement | null;
  return !!active
    && !!active.closest('td, th')
    && active.closest('table') === table
    && (active.isContentEditable || !!active.closest('[contenteditable="true"]'));
}

function findToggleWrap(node: Node | null): HTMLElement | null {
  if (!node) return null;
  const el = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
  return (el?.closest('.be-toggle-wrap') as HTMLElement | null) ?? null;
}

function toggleBlockIdFromWrap(wrap: HTMLElement): string | null {
  const children = wrap.querySelector('.be-toggle-children[data-toggle-id]');
  return children?.getAttribute('data-toggle-id')
    ?? wrap.querySelector('[data-block-id]')?.getAttribute('data-block-id')
    ?? null;
}

function rangeFullyContains(range: Range, el: HTMLElement): boolean {
  const nodeRange = document.createRange();
  nodeRange.selectNodeContents(el);
  const startsBefore = range.compareBoundaryPoints(Range.START_TO_START, nodeRange) <= 0;
  const endsAfter = range.compareBoundaryPoints(Range.END_TO_END, nodeRange) >= 0;
  return startsBefore && endsAfter;
}

function collectBlockIdsBetween(rootBlocks: Block[], startId: string, endId: string): string[] | null {
  const flat = flattenBlockIds(rootBlocks);
  const i0 = flat.indexOf(startId);
  const i1 = flat.indexOf(endId);
  if (i0 === -1 || i1 === -1) return null;
  const [lo, hi] = i0 < i1 ? [i0, i1] : [i1, i0];
  return flat.slice(lo, hi + 1);
}

function contextFromHost(host: HTMLElement): CopySelectionContext {
  const blockId = host.getAttribute('data-block-id')!;
  const text = host.classList.contains('be-editable') ? readBlockText(host) : (host.textContent ?? '');
  const offsets = getSelectionOffsets(host);
  const start = offsets?.start ?? 0;
  const end = offsets?.end ?? text.length;
  return {
    activeBlockId: blockId,
    activeBlockType: host.getAttribute('data-block-type'),
    start,
    end,
    textLength: text.length,
    host,
  };
}

/** Resolve what the user is copying from focus + window selection. */
export function resolveCopySelection(rootBlocks: Block[]): CopySelectionResolve {
  const active = document.activeElement as HTMLElement | null;

  if (active?.classList.contains('be-editable')) {
    const blockId = active.getAttribute('data-block-id');
    if (!blockId) return { kind: 'not-focused' };
    return { kind: 'single', ctx: contextFromHost(active) };
  }

  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
    return { kind: 'not-focused' };
  }

  const range = sel.getRangeAt(0);

  const startToggle = findToggleWrap(range.startContainer);
  const endToggle = findToggleWrap(range.endContainer);
  if (startToggle && endToggle && startToggle === endToggle) {
    const toggleId = toggleBlockIdFromWrap(startToggle);
    if (toggleId) return { kind: 'toggle-subtree', blockId: toggleId };
  }

  const startHost = findBlockHost(range.startContainer);
  const endHost = findBlockHost(range.endContainer);
  if (!startHost || !endHost) return { kind: 'not-focused' };

  if (startHost === endHost) {
    return { kind: 'single', ctx: contextFromHost(startHost) };
  }

  const startId = startHost.getAttribute('data-block-id')!;
  const endId = endHost.getAttribute('data-block-id')!;
  const blockIds = collectBlockIdsBetween(rootBlocks, startId, endId);
  if (!blockIds?.length) return { kind: 'partial-fallback' };

  const startOffsets = getSelectionOffsets(startHost);
  const endOffsets = getSelectionOffsets(endHost);
  const startAt0 = (startOffsets?.start ?? 0) === 0;
  const endLen = endHost.textContent?.length ?? 0;
  const endAtEnd = (endOffsets?.end ?? endLen) === endLen;
  if (!startAt0 || !endAtEnd) return { kind: 'partial-fallback' };

  for (const id of blockIds.slice(1, -1)) {
    const el = document.querySelector(`[data-block-id="${id}"]`) as HTMLElement | null;
    if (!el || !rangeFullyContains(range, el)) return { kind: 'partial-fallback' };
  }

  return { kind: 'multi-block', blockIds };
}
