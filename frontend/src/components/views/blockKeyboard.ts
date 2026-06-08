/**
 * blockKeyboard.ts — When Delete/Backspace should delete selected blocks (not edit text)
 */
import { readBlockText } from './editableDom';
import { getCaretOffset, getSelectionOffsets } from './selectionOffsets';

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

  // Backspace in text block → merge / char delete (EditableBlock). Shell focus → delete block.
  if (e.key === 'Backspace') {
    return !t.isContentEditable;
  }

  if (e.key === 'Delete') {
    const sel = getSelectionOffsets(t);
    if (sel) return false;
    const text = readBlockText(t);
    if (text.trim() === '') return true;
    return false;
  }

  return false;
}
