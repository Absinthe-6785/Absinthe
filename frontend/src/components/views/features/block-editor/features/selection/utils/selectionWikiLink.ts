import { getSelectionOffsets, readBlockText } from '../../../../../editableDom';
import { isTextBlockType, type BlockType } from '../../../../../blockUtils';
import { isCurrentWikiTarget, parseIdWikiLinks, serializeIdWikiLink, type WikiTarget } from '../../../../../wikiLinks';

/** Only ordinary text within a single editable block is eligible. */
export function captureWikiSelection(el: HTMLElement, type: BlockType | undefined) {
  const range = window.getSelection()?.rangeCount ? window.getSelection()!.getRangeAt(0) : null;
  const offsets = getSelectionOffsets(el);
  if (!type || !isTextBlockType(type) || !range || !offsets || el.closest('table')) return null;
  for (const protectedNode of el.querySelectorAll('code, [data-math-source], .be-live-math-inline, .be-live-math-display, .be-wiki-chip, a, .be-footnote-ref')) {
    if (range.intersectsNode(protectedNode)) return null;
  }
  const text = readBlockText(el);
  if (/[\r\n]/.test(text.slice(offsets.start, offsets.end))) return null;
  return { text, ...offsets };
}

export function buildSelectedWikiInsertText(text: string, start: number, end: number, target: WikiTarget) {
  if (typeof target === 'string' || !isCurrentWikiTarget(target) || start < 0 || end <= start || end > text.length) return null;
  const label = text.slice(start, end);
  if (/[\r\n]/.test(label)) return null;
  let token: string;
  try { token = serializeIdWikiLink(target.id, label); } catch { return null; }
  const newText = text.slice(0, start) + token + text.slice(end);
  // Do not insert a token that becomes escaped, code/math, or another link's payload.
  if (!parseIdWikiLinks(newText, 'inline').some(link => link.start === start && link.raw === token)) return null;
  return { newText, caret: start + token.length };
}
