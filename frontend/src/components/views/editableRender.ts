/**
 * editableRender.ts — Pure inline HTML generation (readOnly + live edit modes)
 */
import React, { type ReactNode } from 'react';

declare global {
  interface Window {
    katex?: { renderToString: (expr: string, opts?: object) => string };
  }
}
import { normalizeWikiTitle } from './noteUtils';
import type { BlockEditorColors } from './editorTypes';

export function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function escAttr(s: string): string {
  return s.replace(/"/g, '&quot;');
}

export function applySearchHighlight(html: string, searchQuery: string): string {
  if (!searchQuery.trim()) return html;
  const q = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return html.replace(new RegExp(`(${q})`, 'gi'), '<mark class="be-search-hl">$1</mark>');
}

function wikiSetFrom(targets: string[]): Set<string> {
  return new Set(targets.map(normalizeWikiTitle));
}

function isWikiBroken(title: string, wikiSet: Set<string>): boolean {
  return wikiSet.size > 0 && !wikiSet.has(normalizeWikiTitle(title));
}

/** readOnly: $...$ inline math via KaTeX (or code fallback). */
export function protectInlineMathReadOnly(
  text: string,
  c: BlockEditorColors,
): { work: string; math: string[] } {
  const math: string[] = [];
  const work = text.replace(/\$([^$\n]+)\$/g, (_m, expr: string) => {
    let rendered: string;
    if (typeof window !== 'undefined' && window.katex) {
      try {
        rendered = window.katex.renderToString(expr, { displayMode: false, throwOnError: false });
      } catch {
        rendered = `<code style="background:${c.codeBg};color:${c.danger};padding:1px 5px;border-radius:4px">${escHtml('$' + expr + '$')}</code>`;
      }
    } else {
      rendered = `<code style="background:${c.codeBg};color:${c.accent};padding:1px 5px;border-radius:4px;font-size:.88em">${escHtml(expr)}</code>`;
    }
    math.push(rendered);
    return `\u0000M${math.length - 1}\u0000`;
  });
  return { work, math };
}

/** live edit: math as be-live-code placeholder. */
export function protectInlineMathLive(text: string): { work: string; math: string[] } {
  const math: string[] = [];
  const work = text.replace(/\$([^$\n]+)\$/g, (_m, expr: string) => {
    math.push(`<code class="be-live-code">${escHtml(expr)}</code>`);
    return `\u0000M${math.length - 1}\u0000`;
  });
  return { work, math };
}

export function restoreMathPlaceholders(html: string, math: string[]): string {
  return html.replace(/\u0000M(\d+)\u0000/g, (_m, i: string) => math[Number(i)]);
}

/** readOnly inline markdown → HTML string */
export function renderInlineMarkdownHtml(
  text: string,
  c: BlockEditorColors,
  searchQuery = '',
  wikiTargets: string[] = [],
): string {
  const wikiSet = wikiSetFrom(wikiTargets);
  const { work, math } = protectInlineMathReadOnly(text, c);

  let html = escHtml(work)
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\+\+(.+?)\+\+/g, '<u>$1</u>')
    .replace(/~~(.+?)~~/g, '<del>$1</del>')
    .replace(/==(.+?)==/g, `<mark style="background:${c.accentBg};color:${c.accent}">$1</mark>`)
    .replace(/`([^`]+)`/g, `<code style="background:${c.codeBg};color:${c.accent};padding:1px 5px;border-radius:4px;font-size:.88em">$1</code>`)
    .replace(/\[\[(.+?)\]\]/g, (_m, t: string) => {
      const broken = isWikiBroken(t, wikiSet);
      const color = broken ? c.textMuted : c.accent;
      const deco = broken ? 'underline dashed' : 'underline';
      const extra = broken ? ';opacity:0.85;font-style:italic' : '';
      const title = broken ? ' title="Create note"' : '';
      return `<span class="be-wikilink${broken ? ' be-wikilink-broken' : ''}" data-wiki="${escAttr(t)}"${title} style="color:${color};text-decoration:${deco};text-underline-offset:2px;cursor:pointer${extra}">${escHtml(t)}</span>`;
    })
    .replace(/(^|\s)#([\w\uAC00-\uD7A3]+)/g, (_m, sp: string, tag: string) =>
      `${sp}<span class="be-tag" data-tag="${escAttr(tag)}" style="color:${c.accent};opacity:.85;cursor:pointer">#${tag}</span>`);

  html = applySearchHighlight(html, searchQuery);
  return restoreMathPlaceholders(html, math);
}

/** Live edit inline markdown → HTML string (markers visible for caret stability) */
export function liveInlineHtml(
  text: string,
  c: BlockEditorColors,
  wikiTargets: string[] = [],
  searchQuery = '',
): string {
  if (!text) return '';
  const wikiSet = wikiSetFrom(wikiTargets);
  const { work, math } = protectInlineMathLive(text);

  let html = escHtml(work)
    .replace(/\[\[(.+?)\]\]/g, (_m, t: string) => {
      const broken = isWikiBroken(t, wikiSet);
      const cls = broken ? 'be-wiki-chip be-wiki-chip-broken' : 'be-wiki-chip';
      return `<span class="${cls}" data-wiki="${escAttr(t)}"><span class="be-bracket">[[</span>${escHtml(t)}<span class="be-bracket">]]</span></span>`;
    })
    .replace(/(^|\s)(#[\w\uAC00-\uD7A3]+)/g, (_m, sp: string, tag: string) =>
      `${sp}<span class="be-tag-chip" data-tag="${escAttr(tag.slice(1))}">${tag}</span>`)
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em><span class="be-mark">***</span>$1<span class="be-mark">***</span></em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong><span class="be-mark">**</span>$1<span class="be-mark">**</span></strong>')
    .replace(/\*(.+?)\*/g, '<em><span class="be-mark">*</span>$1<span class="be-mark">*</span></em>')
    .replace(/\+\+(.+?)\+\+/g, '<u><span class="be-mark">++</span>$1<span class="be-mark">++</span></u>')
    .replace(/~~(.+?)~~/g, '<del><span class="be-mark">~~</span>$1<span class="be-mark">~~</span></del>')
    .replace(/==(.+?)==/g, `<mark class="be-live-mark"><span class="be-mark">==</span>$1<span class="be-mark">==</span></mark>`)
    .replace(/`([^`]+)`/g, `<code class="be-live-code"><span class="be-mark">\`</span>$1<span class="be-mark">\`</span></code>`);

  html = applySearchHighlight(html, searchQuery);
  return restoreMathPlaceholders(html, math);
}

/** readOnly React wrapper */
export function renderInlineMarkdown(
  text: string,
  c: BlockEditorColors,
  searchQuery = '',
  wikiTargets: string[] = [],
): ReactNode {
  const html = renderInlineMarkdownHtml(text, c, searchQuery, wikiTargets);
  return React.createElement('span', { dangerouslySetInnerHTML: { __html: html } });
}
