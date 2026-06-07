/**
 * editableLive.ts — Live preview HTML for contentEditable blocks
 */
import { normalizeWikiTitle } from './noteUtils';
import { setCaretOffset, setSelectionOffsets } from './editableDom';
import type { BlockEditorColors } from './editorTypes';

/** 편집 중 Live Preview — 마크다운 문자는 유지하고 시각만 포맷 (캐럿 offset 보존) */
export function liveInlineHtml(text: string, c: BlockEditorColors, wikiTargets: string[] = [], searchQuery = ''): string {
  if (!text) return '';
  const wikiSet = new Set(wikiTargets.map(normalizeWikiTitle));
  const esc = (s: string) =>
    s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const escAttr = (s: string) => s.replace(/"/g, '&quot;');

  const math: string[] = [];
  const work = text.replace(/\$([^$\n]+)\$/g, (_m, expr: string) => {
    math.push(`<code class="be-live-code">${esc(expr)}</code>`);
    return `\u0000M${math.length - 1}\u0000`;
  });

  let html = esc(work)
    .replace(/\[\[(.+?)\]\]/g, (_m, t: string) => {
      const broken = wikiSet.size > 0 && !wikiSet.has(normalizeWikiTitle(t));
      const cls = broken ? 'be-wiki-chip be-wiki-chip-broken' : 'be-wiki-chip';
      return `<span class="${cls}" data-wiki="${escAttr(t)}"><span class="be-bracket">[[</span>${esc(t)}<span class="be-bracket">]]</span></span>`;
    })
    .replace(/(^|\s)(#[\w\uAC00-\uD7A3]+)/g, (_m, sp: string, tag: string) =>
      `${sp}<span class="be-tag-chip" data-tag="${escAttr(tag.slice(1))}">${tag}</span>`)
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em><span class="be-mark">***</span>$1<span class="be-mark">***</span></em></strong>')
    .replace(/\*\*(.+?)\*\*/g,     '<strong><span class="be-mark">**</span>$1<span class="be-mark">**</span></strong>')
    .replace(/\*(.+?)\*/g,         '<em><span class="be-mark">*</span>$1<span class="be-mark">*</span></em>')
    .replace(/~~(.+?)~~/g,         '<del><span class="be-mark">~~</span>$1<span class="be-mark">~~</span></del>')
    .replace(/==(.+?)==/g,         `<mark class="be-live-mark"><span class="be-mark">==</span>$1<span class="be-mark">==</span></mark>`)
    .replace(/`([^`]+)`/g,         `<code class="be-live-code"><span class="be-mark">\`</span>$1<span class="be-mark">\`</span></code>`);

  if (searchQuery.trim()) {
    const q = searchQuery.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    html = html.replace(new RegExp(`(${q})`, 'gi'), '<mark class="be-search-hl">$1</mark>');
  }

  html = html.replace(/\u0000M(\d+)\u0000/g, (_m, i: string) => math[Number(i)]);
  return html;
}

export function paintEditableLive(
  el: HTMLElement,
  text: string,
  c: BlockEditorColors,
  wikiTargets: string[],
  searchQuery: string,
  caretOffset?: number,
  selection?: { start: number; end: number },
) {
  el.innerHTML = liveInlineHtml(text, c, wikiTargets, searchQuery);
  if (selection) setSelectionOffsets(el, selection.start, selection.end);
  else if (caretOffset != null) setCaretOffset(el, caretOffset);
}
