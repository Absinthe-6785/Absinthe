/**
 * editableRender.ts — Pure inline HTML generation (readOnly + live edit modes)
 */
import React, { type ReactNode } from 'react';
import {
  protectMathSegments,
  restoreMathPlaceholders,
  type MathSlotToken,
} from '../../lib/math/mathParse';
import { renderMathTokenHtml } from '../../lib/math/katexRender';
import { normalizeWikiTitle } from './noteUtils';
import { type WikiTarget, isCurrentWikiTarget, wikiTargetTitle, parseIdWikiLinks, resolveIdWikiTarget } from './wikiLinks';
import type { BlockEditorColors } from './editorTypes';
import { inlineTagSpan, renderInlineTagsInHtml } from './features/knowledge/tags/inlineTagRender';

export function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function escAttr(s: string): string {
  return s.replace(/"/g, '&quot;');
}

/** Highlight query matches in rendered HTML — only in text nodes, never inside tags/attributes. */
export function applySearchHighlight(html: string, searchQuery: string): string {
  if (!searchQuery.trim()) return html;
  const q = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(${q})`, 'gi');
  return html.replace(/(<[^>]+>|[^<]+)/g, (segment) => {
    if (segment.startsWith('<')) return segment;
    return segment.replace(re, '<mark class="be-search-hl">$1</mark>');
  });
}

function wikiSetFrom(targets: WikiTarget[]): Set<string> {
  return new Set(targets.filter(isCurrentWikiTarget).map(target => normalizeWikiTitle(wikiTargetTitle(target))));
}

function protectIdLinks(text: string, targets: WikiTarget[], live: boolean) {
  const slots: string[] = [];
  let prefix = '\uE200WIKI';
  while (text.includes(prefix)) prefix += 'W';
  let cursor = 0;
  let work = '';
  for (const link of parseIdWikiLinks(text, 'inline')) {
    work += text.slice(cursor, link.start) + prefix + slots.length + '\uE201';
    const target = resolveIdWikiTarget(link, targets);
    const shown = live ? link.raw : link.label || target?.title || 'Missing note';
    const cls = live ? 'be-wiki-chip' : 'be-wikilink';
    const data = target ? ` data-note-link="${escAttr(escHtml(link.raw))}"` : '';
    const actionAttrs = !live && target ? ' role="link" tabindex="0"' : '';
    const style = target
      ? 'color:var(--be-accent,inherit);text-decoration:underline;cursor:pointer'
      : 'color:var(--be-text-muted,inherit);text-decoration:underline dashed';
    slots.push(`<span class="${cls}${target ? '' : ' be-wikilink-broken'}"${data}${actionAttrs} style="${style}">${escHtml(shown)}</span>`);
    cursor = link.end;
  }
  work += text.slice(cursor);
  return { work, restore: (html: string) => slots.reduce((value, slot, i) =>
    value.replace(prefix + i + '\uE201', () => slot), html) };
}

function isWikiBroken(title: string, wikiSet: Set<string>): boolean {
  return wikiSet.size > 0 && !wikiSet.has(normalizeWikiTitle(title));
}

function mathMatchesSearch(expr: string, searchQuery: string): boolean {
  const q = searchQuery.trim();
  if (!q) return false;
  return expr.toLowerCase().includes(q.toLowerCase());
}

function wrapMathSearchHighlight(html: string, matched: boolean): string {
  if (!matched) return html;
  return `<mark class="be-search-hl be-math-search-hl">${html}</mark>`;
}

function mathReadOnlyFallback(token: MathSlotToken, c: BlockEditorColors): string {
  const label = escHtml(token.raw);
  return `<code style="background:${c.codeBg};color:${c.danger};padding:1px 5px;border-radius:4px">${label}</code>`;
}

/** readOnly: $…$ inline and $$…$$ display math via bundled KaTeX. */
export function protectInlineMathReadOnly(
  text: string,
  c: BlockEditorColors,
  searchQuery = '',
): { work: string; math: string[] } {
  const { work, slots } = protectMathSegments(text, token => {
    const rendered = renderMathTokenHtml(token);
    const matched = mathMatchesSearch(token.expr, searchQuery);
    if (rendered) {
      const wrapped = wrapMathSearchHighlight(rendered, matched);
      if (token.kind === 'display') {
        return `<div class="be-math-display" data-math-source="${escAttr(token.expr)}">${wrapped}</div>`;
      }
      return `<span class="be-math-inline" data-math-source="${escAttr(token.expr)}">${wrapped}</span>`;
    }
    return mathReadOnlyFallback(token, c);
  });
  return { work, math: slots };
}

/** live edit: math as be-live-code placeholder (raw LaTeX preserved in DOM text). */
export function protectInlineMathLive(
  text: string,
  searchQuery = '',
): { work: string; math: string[] } {
  const { work, slots } = protectMathSegments(text, token => {
    const matched = mathMatchesSearch(token.expr, searchQuery);
    const hlClass = matched ? ' be-math-search-hl' : '';
    if (token.kind === 'display') {
      return `<span class="be-live-math-display${hlClass}"><span class="be-mark">$$</span><code class="be-live-code">${escHtml(token.expr)}</code><span class="be-mark">$$</span></span>`;
    }
    return `<span class="be-live-math-inline${hlClass}"><span class="be-mark">$</span><code class="be-live-code">${escHtml(token.expr)}</code><span class="be-mark">$</span></span>`;
  });
  return { work, math: slots };
}

export { restoreMathPlaceholders };

/** readOnly inline markdown → HTML string */
export function renderInlineMarkdownHtml(
  text: string,
  c: BlockEditorColors,
  searchQuery = '',
  wikiTargets: WikiTarget[] = [],
): string {
  const wikiSet = wikiSetFrom(wikiTargets);
  const idLinks = protectIdLinks(text, wikiTargets, false);
  const { work, math } = protectInlineMathReadOnly(idLinks.work, c, searchQuery);

  let html = escHtml(work)
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\+\+(.+?)\+\+/g, '<u>$1</u>')
    .replace(/~~(.+?)~~/g, '<del>$1</del>')
    .replace(/==(.+?)==/g, `<mark style="background:${c.accentBg};color:${c.accent}">$1</mark>`)
    .replace(/`([^`]+)`/g, `<code style="background:${c.codeBg};color:${c.accent};padding:1px 5px;border-radius:4px;font-size:.88em">$1</code>`)
    .replace(/\[\^([^\]]+)\]/g, (_m, id: string) =>
      `<sup class="be-footnote-ref" data-footnote-id="${escAttr(id)}" style="color:${c.accent};cursor:pointer;font-size:.75em">[${escHtml(id)}]</sup>`)
    .replace(/\[\[(.+?)\]\]/g, (_m, t: string) => {
      const broken = isWikiBroken(t, wikiSet);
      const color = broken ? c.textMuted : c.accent;
      const deco = broken ? 'underline dashed' : 'underline';
      const extra = broken ? ';opacity:0.85;font-style:italic' : '';
      const title = broken ? ' title="Create note"' : '';
      return `<span class="be-wikilink${broken ? ' be-wikilink-broken' : ''}" data-wiki="${escAttr(t)}" role="link" tabindex="0"${title} style="color:${color};text-decoration:${deco};text-underline-offset:2px;cursor:pointer${extra}">${escHtml(t)}</span>`;
    });

  html = renderInlineTagsInHtml(html, tag =>
    inlineTagSpan(tag, 'be-tag', `color:${c.accent};opacity:.85;cursor:pointer`));

  html = applySearchHighlight(idLinks.restore(html), searchQuery);
  return restoreMathPlaceholders(html, math);
}

/** Live edit inline markdown → HTML string (markers visible for caret stability) */
export function liveInlineHtml(
  text: string,
  c: BlockEditorColors,
  wikiTargets: WikiTarget[] = [],
  searchQuery = '',
): string {
  if (!text) return '';
  const wikiSet = wikiSetFrom(wikiTargets);
  const idLinks = protectIdLinks(text, wikiTargets, true);
  const { work, math } = protectInlineMathLive(idLinks.work, searchQuery);

  let html = escHtml(work)
    .replace(/\[\[(.+?)\]\]/g, (_m, t: string) => {
      const broken = isWikiBroken(t, wikiSet);
      const cls = broken ? 'be-wiki-chip be-wiki-chip-broken' : 'be-wiki-chip';
      return `<span class="${cls}" data-wiki="${escAttr(t)}"><span class="be-bracket">[[</span>${escHtml(t)}<span class="be-bracket">]]</span></span>`;
    })
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em><span class="be-mark">***</span>$1<span class="be-mark">***</span></em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong><span class="be-mark">**</span>$1<span class="be-mark">**</span></strong>')
    .replace(/\*(.+?)\*/g, '<em><span class="be-mark">*</span>$1<span class="be-mark">*</span></em>')
    .replace(/\+\+(.+?)\+\+/g, '<u><span class="be-mark">++</span>$1<span class="be-mark">++</span></u>')
    .replace(/~~(.+?)~~/g, '<del><span class="be-mark">~~</span>$1<span class="be-mark">~~</span></del>')
    .replace(/==(.+?)==/g, `<mark class="be-live-mark"><span class="be-mark">==</span>$1<span class="be-mark">==</span></mark>`)
    .replace(/`([^`]+)`/g, `<code class="be-live-code"><span class="be-mark">\`</span>$1<span class="be-mark">\`</span></code>`)
    .replace(/\[\^([^\]]+)\]/g, (_m, id: string) =>
      `<sup class="be-footnote-ref" data-footnote-id="${escAttr(id)}"><span class="be-mark">[</span>^${escHtml(id)}<span class="be-mark">]</span></sup>`);

  html = renderInlineTagsInHtml(html, tag =>
    inlineTagSpan(tag, 'be-tag-chip'));

  html = applySearchHighlight(idLinks.restore(html), searchQuery);
  return restoreMathPlaceholders(html, math);
}

/** readOnly React wrapper */
export function renderInlineMarkdown(
  text: string,
  c: BlockEditorColors,
  searchQuery = '',
  wikiTargets: WikiTarget[] = [],
): ReactNode {
  const html = renderInlineMarkdownHtml(text, c, searchQuery, wikiTargets);
  return React.createElement('span', { dangerouslySetInnerHTML: { __html: html } });
}
