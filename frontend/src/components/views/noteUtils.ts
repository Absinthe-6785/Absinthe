/**
 * noteUtils.ts — NoteView 순수 유틸리티
 *
 * React 의존성 없는 함수들을 모아 NoteView에서 분리.
 * 테스트 작성 및 재사용이 용이하도록 독립 모듈로 관리.
 */

import type { Note, NoteFolder } from '../../store/useAppStore';

// ── localStorage 키 ──────────────────────────────────────────────────
export const NV_NOTES_KEY   = 'noteview-notes-v1';
export const NV_FOLDERS_KEY = 'noteview-folders-v1';
export const NV_ACTIVE_KEY  = 'noteview-active-v1';

// ── localStorage helpers ─────────────────────────────────────────────
export function nvLoadNotes(): Note[] {
  try {
    const raw = localStorage.getItem(NV_NOTES_KEY);
    if (raw) return JSON.parse(raw) as Note[];
  } catch { /**/ }
  return [{
    id: `note-${Date.now()}`,
    title: 'Welcome to Note',
    body: '## Getting Started\n\nStart writing your notes here.',
    updatedAt: Date.now(),
    folderId: null,
    deletedAt: null,
    starred: false,
  }];
}

export function nvLoadFolders(): NoteFolder[] {
  try {
    const raw = localStorage.getItem(NV_FOLDERS_KEY);
    if (raw) return JSON.parse(raw) as NoteFolder[];
  } catch { /**/ }
  return [];
}

export function nvSaveNotes(notes: Note[]): void {
  try { localStorage.setItem(NV_NOTES_KEY, JSON.stringify(notes)); } catch { /**/ }
}

export function nvSaveFolders(folders: NoteFolder[]): void {
  try { localStorage.setItem(NV_FOLDERS_KEY, JSON.stringify(folders)); } catch { /**/ }
}

// ── 문자열 유틸 ──────────────────────────────────────────────────────
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function highlightText(text: string, query: string): string {
  const safe = escapeHtml(text);
  if (!query.trim()) return safe;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return safe.replace(new RegExp(`(${escaped})`, 'gi'), '<mark class="bshl">$1</mark>');
}

// ── 마크다운 파서 ────────────────────────────────────────────────────
export function parseMarkdown(md: string, allNotes: Note[]): string {
  if (!md) return '';

  // 1. 수식 보호
  const mathBlocks: string[] = [];
  let text = md
    .replace(/\$\$[\s\S]+?\$\$/g, m => { mathBlocks.push(m); return `%%M${mathBlocks.length - 1}%%`; })
    .replace(/\$[^$\n]+\$/g,      m => { mathBlocks.push(m); return `%%M${mathBlocks.length - 1}%%`; });

  // 2. 코드블록 보호
  const codeBlocks: string[] = [];
  text = text.replace(/```([\w]*)\n([\s\S]*?)```/gm, (_, lang, code) => {
    codeBlocks.push(`<pre class="bpre"><code class="blang-${lang}">${code.trimEnd()}</code></pre>`);
    return `%%C${codeBlocks.length - 1}%%`;
  });

  // 3. 줄 단위 처리
  const lines = text.split('\n');
  const out: string[] = [];
  let i = 0;

  const flushToggle = (summary: string, bodyLines: string[]): string => {
    const inner = bodyLines.join('\n');
    const uid = Math.random().toString(36).slice(2);
    return `<details class="btoggle" id="btg-${uid}"><summary class="btsummary">${summary}</summary><div class="btbody">${inner}</div></details>`;
  };

  const getIndent = (line: string) => {
    const m = line.match(/^(\s+)/);
    return m ? Math.floor(m[1].length / 2) : 0;
  };

  while (i < lines.length) {
    const line = lines[i];

    // 토글 블록
    if (/^> /.test(line)) {
      const summary = line.replace(/^> /, '');
      const bodyLines: string[] = [];
      i++;
      while (i < lines.length && (lines[i].startsWith('  ') || lines[i] === '')) {
        bodyLines.push(lines[i]);
        i++;
      }
      out.push(flushToggle(processInline(summary, allNotes), bodyLines.map(l => processLine(l.replace(/^  /, ''), allNotes)).join('\n')));
      continue;
    }

    // 번호 목록
    if (/^\d+\. /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\. /.test(lines[i])) {
        const indent = getIndent(lines[i]);
        const content = lines[i].replace(/^\s*\d+\. /, '');
        items.push(`<li class="bol" style="margin-left:${indent * 16}px">${processInline(content, allNotes)}</li>`);
        i++;
      }
      out.push(`<ol class="bol-group">${items.join('')}</ol>`);
      continue;
    }

    // 불릿 목록
    if (/^(\s*)[-*] /.test(line) && !/^(\s*)[-*] \[[ x]\]/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^(\s*)[-*] /.test(lines[i]) && !/^(\s*)[-*] \[[ x]\]/.test(lines[i])) {
        const indent = getIndent(lines[i]);
        const content = lines[i].replace(/^\s*[-*] /, '');
        items.push(`<li class="bul" style="margin-left:${indent * 16}px">${processInline(content, allNotes)}</li>`);
        i++;
      }
      out.push(`<ul class="bul-group">${items.join('')}</ul>`);
      continue;
    }

    out.push(processLine(line, allNotes));
    i++;
  }

  let html = out.join('\n');

  // 4. 코드블록 복원
  html = html.replace(/%%C(\d+)%%/g, (_, idx) => codeBlocks[Number(idx)]);

  // 5. 수식 복원
  html = html.replace(/%%M(\d+)%%/g, (_, idx: string) => {
    const m = mathBlocks[Number(idx)];
    if (!window.katex) return `<code>${m}</code>`;
    const isBlock = m.startsWith('$$');
    const expr = m.replace(/^\$\$?/, '').replace(/\$\$?$/, '').trim();
    try {
      return isBlock
        ? `<div class="bmathb">${window.katex.renderToString(expr, { displayMode: true, throwOnError: false })}</div>`
        : `<span class="bmathi">${window.katex.renderToString(expr, { displayMode: false, throwOnError: false })}</span>`;
    } catch { return `<code class="bmerr">${m}</code>`; }
  });

  return `<div class="broot">${html}</div>`;
}

export function processInline(text: string, allNotes: Note[]): string {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\[\[(.+?)\]\]/g, (_, t: string) => {
      const f = allNotes.find(n => n.title === t && !n.deletedAt);
      return f ? `<span class="bwl" data-id="${f.id}">[[${t}]]</span>`
               : `<span class="bwlm">[[${t}]]</span>`;
    })
    .replace(/(^|\s)#([\w\uAC00-\uD7A3]+)/g, (_: string, sp: string, tag: string) =>
      `${sp}<span class="bwtag" data-tag="${tag}">#${tag}</span>`)
    .replace(/!\[([^\]]*)\]\((data:image\/[^)]+)\)/g, (_: string, alt: string, src: string) =>
      `<img class="bimg" src="${src}" alt="${alt.replace(/"/g, '&quot;')}"/>`)
    .replace(/!\[([^\]]*)\]\(((?!javascript:)[^)]+)\)/g, (_: string, alt: string, src: string) =>
      `<img class="bimg" src="${src}" alt="${alt.replace(/"/g, '&quot;')}"/>`)
    .replace(/`([^`]+)`/g,        '<code class="bcode">$1</code>')
    .replace(/\*\*\*(.+?)\*\*\*/g,'<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g,    '<strong class="bbold">$1</strong>')
    .replace(/\*(.+?)\*/g,        '<em class="bital">$1</em>')
    .replace(/~~(.+?)~~/g,        '<del>$1</del>')
    .replace(/==(.+?)==/g,        '<mark class="bhl">$1</mark>');
}

export function processLine(line: string, allNotes: Note[]): string {
  if (!line.trim()) return '<div class="bempty"></div>';
  const inl = processInline(line, allNotes);
  if (/^### /.test(line)) return `<h3 class="bh3">${processInline(line.replace(/^### /, ''), allNotes)}</h3>`;
  if (/^## /.test(line))  return `<h2 class="bh2">${processInline(line.replace(/^## /, ''), allNotes)}</h2>`;
  if (/^# /.test(line))   return `<h1 class="bh1">${processInline(line.replace(/^# /, ''), allNotes)}</h1>`;
  if (/^---$/.test(line)) return '<hr class="bhr"/>';
  if (/^- \[x\] /.test(line)) return `<div class="bchk done">✓ ${processInline(line.replace(/^- \[x\] /, ''), allNotes)}</div>`;
  if (/^- \[ \] /.test(line)) return `<div class="bchk">☐ ${processInline(line.replace(/^- \[ \] /, ''), allNotes)}</div>`;
  return `<p class="bpara">${inl}</p>`;
}

// ── 분석 유틸 ────────────────────────────────────────────────────────
export interface TocItem { level: number; text: string; line: number; collapsed: boolean; }

export function extractTOC(body: string): TocItem[] {
  return body.split('\n')
    .map((line, i) => {
      const m = line.match(/^(#{1,3}) (.+)$/);
      return m ? { level: m[1].length, text: m[2], line: i, collapsed: false } : null;
    })
    .filter((x): x is TocItem => x !== null);
}

export function extractTags(body: string): string[] {
  return [...new Set(
    (body.match(/(^|\s)#([\w\uAC00-\uD7A3]+)/g) || []).map(m => m.trim().replace('#', ''))
  )];
}

export function extractLinks(body: string): string[] {
  return [...(body.matchAll(/\[\[(.+?)\]\]/g))].map(m => m[1]);
}
