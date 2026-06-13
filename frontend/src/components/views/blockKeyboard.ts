/**
 * blockKeyboard.ts — When Delete/Backspace should delete selected blocks (not edit text)
 */
import { readBlockText } from './editableDom';
import { getCaretOffset, getSelectionOffsets } from './features/block-editor/features/selection';

function isEditableEmpty(el: HTMLElement): boolean {
  return readBlockText(el).trim().length === 0;
}

export function shouldDeleteSelectedBlocks(
  e: KeyboardEvent,
  selectedIds: Set<string>,
): boolean {
  if (selectedIds.size === 0) return false;
  if (selectedIds.size > 1) return true;

  const t = e.target as HTMLElement | null;
  if (!t) return true;

  // Non-text focus (divider shell, image shell, …) → block delete
  if (!t.isContentEditable) return true;

  if (e.key === 'Backspace' || e.key === 'Delete') {
    const sel = getSelectionOffsets(t);
    if (sel) return false;

    if (t.isContentEditable) {
      // Never delete a non-empty text block from the capture handler — EditableBlock handles merge/chars.
      if (!isEditableEmpty(t)) return false;
      if (e.key === 'Backspace' && getCaretOffset(t) !== 0) return false;
      return true;
    }
    return true;
  }

  return false;
}
