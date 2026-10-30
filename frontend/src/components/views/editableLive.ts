/**
 * editableLive.ts — DOM paint for contentEditable blocks (uses editableRender)
 */
import { setCaretOffset, setSelectionOffsets } from './features/block-editor/features/selection';
import { liveInlineHtml } from './editableRender';
import type { BlockEditorColors } from './editorTypes';

export { liveInlineHtml } from './editableRender';

export function paintEditableLive(
  el: HTMLElement,
  text: string,
  c: BlockEditorColors,
  wikiTargets: WikiTarget[],
  searchQuery: string,
  caretOffset?: number,
  selection?: { start: number; end: number },
  unavailableLabel = 'Linked note unavailable',
) {
  el.innerHTML = liveInlineHtml(text, c, wikiTargets, searchQuery, unavailableLabel);
  if (selection) setSelectionOffsets(el, selection.start, selection.end);
  else if (caretOffset != null) setCaretOffset(el, caretOffset);
}
import type { WikiTarget } from '@/components/views/wikiLinks';
