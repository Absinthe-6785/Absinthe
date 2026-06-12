/**
 * blockKeyboard.ts — When Delete/Backspace should delete selected blocks (not edit text)
 */
import { getSelectionOffsets } from './features/block-editor/features/selection';

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

  // Text range inside CE → char delete (EditableBlock). Collapsed caret + block selected → delete block.
  if (e.key === 'Backspace' || e.key === 'Delete') {
    if (!t.isContentEditable) return true;
    const sel = getSelectionOffsets(t);
    if (sel) return false;
    return true;
  }

  return false;
}
