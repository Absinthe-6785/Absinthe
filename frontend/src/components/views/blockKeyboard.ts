/**
 * blockKeyboard.ts — When Delete/Backspace should delete selected blocks (not edit text)
 */
import { readBlockText } from './editableDom';
import { getCaretOffset, getSelectionOffsets } from './features/block-editor/features/selection';

function isEditableEmpty(el: HTMLElement): boolean {
  return readBlockText(el).trim().length === 0;
}

/** Block shell id from a DOM node inside the editor. */
export function blockIdFromElement(el: HTMLElement | null): string | null {
  if (!el || typeof el.closest !== 'function') return null;
  return el.closest('[data-drag-id]')?.getAttribute('data-drag-id') ?? null;
}

export function shouldDeleteSelectedBlocks(
  e: KeyboardEvent,
  selectedIds: Set<string>,
): boolean {
  if (selectedIds.size === 0) return false;
  if (selectedIds.size > 1) return true;

  const t = e.target as HTMLElement | null;
  if (!t) return true;

  // Form controls (tag inputs, search fields, …) — never steal Backspace/Delete
  const tag = t.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return false;

  const selectedId = [...selectedIds][0]!;
  const focusBlockId = blockIdFromElement(t);

  // Focus in a different block than the sole selection → block delete (gutter/shell select).
  if (focusBlockId && focusBlockId !== selectedId) return true;

  // Non-text focus (divider shell, image shell, body after blur, …) → block delete
  if (!t.isContentEditable) return true;

  if (e.key === 'Backspace' || e.key === 'Delete') {
    const sel = getSelectionOffsets(t);
    if (sel) return false;

    if (t.isContentEditable) {
      // Never delete a non-empty text block from the capture handler — EditableBlock handles merge/chars.
      if (!isEditableEmpty(t)) return false;
      if (e.key === 'Backspace' && getCaretOffset(t) !== 0) return false;
      // Single empty text block: EditableBlock merge focuses the previous block at caret end.
      if (e.key === 'Backspace' && selectedIds.size === 1) return false;
      return true;
    }
    return true;
  }

  return false;
}
