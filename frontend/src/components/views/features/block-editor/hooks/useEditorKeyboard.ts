import { useEffect } from 'react';
import { shouldDeleteSelectedBlocks } from '../../../blockKeyboard';

export interface UseEditorKeyboardOptions {
  readOnly: boolean;
  depth: number;
  getSelectedIds: () => Set<string>;
  onClearSelection: () => void;
  onDeleteSelected: () => void;
}

export function useEditorKeyboard({
  readOnly,
  depth,
  getSelectedIds,
  onClearSelection,
  onDeleteSelected,
}: UseEditorKeyboardOptions): void {
  useEffect(() => {
    if (readOnly || depth !== 0) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (getSelectedIds().size > 0) {
          onClearSelection();
        }
        return;
      }
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      if (!shouldDeleteSelectedBlocks(e, getSelectedIds())) return;
      e.preventDefault();
      onDeleteSelected();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [readOnly, depth, onDeleteSelected]);
}
