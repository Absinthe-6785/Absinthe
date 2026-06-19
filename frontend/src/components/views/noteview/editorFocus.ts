import type { RefObject } from 'react';
import type { BlockEditorHandle } from '../BlockEditor';

/** Focus editor after entering edit mode — K-108A. */
export function scheduleEditorFocus(
  ref: RefObject<BlockEditorHandle | null>,
  blockId?: string,
): void {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      ref.current?.focusEditor(blockId);
    });
  });
}

export const K108A_EDITOR_FOCUS_HOOKS = [
  'focusEditor',
  'scheduleEditorFocus',
  'data-k108-editor-focus',
] as const;
