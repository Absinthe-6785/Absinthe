/**
 * toolbarFormat.ts — Selection toolbar format state & wrap helpers
 */
import type { BlockType } from '../../../../../blockUtils';
import { readBlockText, getSelectionOffsets, setSelectionOffsets } from '../../../../../editableDom';
import { selectionHasFormat, toggleMarkdownWrap } from '../../../../../inlineFormat';
import { toolbarHeadingLevel } from '../../../../../headingToolbar';

export interface ToolbarFormatState {
  bold: boolean;
  italic: boolean;
  code: boolean;
  strike: boolean;
  highlight: boolean;
  wiki: boolean;
  tag: boolean;
  /** Active heading level (plain or toggle-heading). */
  headingLevel: 1 | 2 | 3 | 4 | null;
  isToggleHeading: boolean;
}

export const EMPTY_FORMATS: ToolbarFormatState = {
  bold: false,
  italic: false,
  code: false,
  strike: false,
  highlight: false,
  wiki: false,
  tag: false,
  headingLevel: null,
  isToggleHeading: false,
};

export function deriveToolbarFormats(
  host: HTMLElement,
  blockId: string | null,
  activeBlockId: string | null,
  getBlockType: (id: string) => BlockType | undefined,
): ToolbarFormatState {
  if (!blockId || blockId !== activeBlockId) return EMPTY_FORMATS;
  const text = readBlockText(host);
  const offsets = getSelectionOffsets(host);
  if (!offsets) return EMPTY_FORMATS;
  const { start, end } = offsets;
  const selected = text.slice(start, end);
  const blockType = getBlockType(blockId);
  const level = blockType ? toolbarHeadingLevel(blockType) : null;
  return {
    bold: selectionHasFormat(text, start, end, '**', '**'),
    italic: selectionHasFormat(text, start, end, '*', '*'),
    code: selectionHasFormat(text, start, end, '`', '`'),
    strike: selectionHasFormat(text, start, end, '~~', '~~'),
    highlight: selectionHasFormat(text, start, end, '==', '=='),
    wiki: selectionHasFormat(text, start, end, '[[', ']]'),
    tag: text[start] === '#' && end > start && !selected.includes(' '),
    headingLevel: level,
    isToggleHeading: blockType?.startsWith('toggleHeading') ?? false,
  };
}

export function applyWrapToBlockSelection(
  el: HTMLElement,
  blockText: string,
  before: string,
  after: string,
  onText: (text: string) => void,
  afterApply?: (el: HTMLElement, text: string, selection: { start: number; end: number }) => void,
): boolean {
  const sel = getSelectionOffsets(el);
  if (!sel) return false;
  const result = toggleMarkdownWrap(blockText, sel.start, sel.end, before, after);
  onText(result.text);
  if (afterApply) afterApply(el, result.text, { start: result.selStart, end: result.selEnd });
  else {
    el.innerText = result.text;
    setSelectionOffsets(el, result.selStart, result.selEnd);
  }
  return true;
}
