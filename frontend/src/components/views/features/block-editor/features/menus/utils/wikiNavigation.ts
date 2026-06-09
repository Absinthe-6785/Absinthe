/**
 * wikiNavigation.ts — Wiki trigger detection, insert, and navigation helpers
 */
import { readBlockText } from '../../../../../editableDom';
import { getCaretOffset } from '../../selection';
import { paintEditableLive } from '../../../../../editableLive';
import type { BlockEditorColors } from '../../../../../editorTypes';

/** Unclosed `[[` query before caret, or null. */
export function detectWikiQuery(beforeCaret: string): string | null {
  const m = beforeCaret.match(/\[\[([^\]\n]*)$/);
  return m ? m[1] : null;
}

export function buildWikiInsertText(
  text: string,
  caret: number,
  title: string,
): { newText: string; caret: number } | null {
  const before = text.slice(0, caret);
  const idx = before.lastIndexOf('[[');
  if (idx < 0) return null;
  const ins = `[[${title}]]`;
  return {
    newText: text.slice(0, idx) + ins + text.slice(caret),
    caret: idx + ins.length,
  };
}

/** Wiki link title at plain-text offset, if caret inside `[[...]]`. */
export function findWikiLinkAtOffset(text: string, offset: number): string | null {
  const re = /\[\[([^\]\n]+)\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (offset >= m.index && offset <= m.index + m[0].length) return m[1];
  }
  return null;
}

/** Insert selected wiki title into active contentEditable, preserving caret. */
export function insertWikiAtCaret(
  el: HTMLElement,
  title: string,
  c: BlockEditorColors,
  wikiTargets: string[],
  searchQuery: string,
): string {
  const text = el.innerText.replace(/\n$/, '');
  const caret = getCaretOffset(el);
  const built = buildWikiInsertText(text, caret, title);
  if (!built) return text;
  paintEditableLive(el, built.newText, c, wikiTargets, searchQuery, built.caret);
  return readBlockText(el);
}
