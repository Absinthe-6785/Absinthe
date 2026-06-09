/**
 * contentEditable plain-text helpers.
 * Offset math lives in selection/utils/selectionOffsets.ts (re-exported here for compatibility).
 */

export {
  getCaretOffset,
  getSelectionOffsets,
  setCaretOffset,
  setSelectionOffsets,
  nodePlainLength,
} from './features/block-editor/features/selection';

/** DOM subtree → markdown/plain string for a single block. */
export function domToPlainText(el: HTMLElement): string {
  let out = '';
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) out += node.textContent ?? '';
    else if (node.nodeName === 'BR') out += '\n';
    else for (const child of node.childNodes) walk(child);
  };
  for (const child of el.childNodes) walk(child);
  return out;
}

/** Normalize browser phantom newline on empty contenteditables. */
export function readBlockText(el: HTMLElement): string {
  const raw = domToPlainText(el);
  if (raw === '\n' && el.childNodes.length <= 1) return '';
  return raw;
}

/** Delete one char before caret; returns null if nothing to delete. */
export function deleteBeforeCaret(text: string, offset: number): { text: string; caret: number } | null {
  if (offset <= 0) return null;
  return { text: text.slice(0, offset - 1) + text.slice(offset), caret: offset - 1 };
}

/** Delete a plain-text range (non-collapsed selection). */
export function deleteTextRange(
  text: string,
  start: number,
  end: number,
): { text: string; caret: number } | null {
  if (start >= end) return null;
  return { text: text.slice(0, start) + text.slice(end), caret: start };
}
