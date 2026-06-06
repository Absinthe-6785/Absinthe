/**
 * noteUtils.ts — NoteView 순수 유틸리티
 *
 * React 의존성 없는 함수들을 모아 NoteView에서 분리.
 * 테스트 작성 및 재사용이 용이하도록 독립 모듈로 관리.
 */

// KaTeX 전역 선언 (동적 로드 후 window.katex로 접근)
declare global {
  interface Window {
    katex?: { renderToString: (expr: string, opts?: object) => string };
  }
}

// 순환 참조 방지: useAppStore에서 import하지 않고 독립 타입 정의
// useAppStore의 Note/NoteFolder와 구조적으로 동일 (TypeScript 구조적 타이핑으로 호환)
export interface NoteBase {
  id: string;
  title: string;
  body: string;
  updatedAt: number;
  folderId: string | null;
  deletedAt: number | null;
  starred?: boolean;
}
export interface NoteFolderBase {
  id: string;
  name: string;
  createdAt: number;
}

// ── localStorage 키 ──────────────────────────────────────────────────
export const NV_NOTES_KEY   = 'noteview-notes-v1';
export const NV_FOLDERS_KEY = 'noteview-folders-v1';
export const NV_ACTIVE_KEY  = 'noteview-active-v1';

// ── localStorage helpers ─────────────────────────────────────────────
export function nvLoadNotes(): NoteBase[] {
  try {
    const raw = localStorage.getItem(NV_NOTES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // 배열 여부 확인 (손상된 데이터 방어)
      const arr: NoteBase[] = Array.isArray(parsed) ? parsed : [];
      // null/undefined 필드 정규화 (구버전 데이터 호환)
      return arr.map(n => ({
        ...n,
        title: n.title ?? '',
        body:  n.body  ?? '',
        id:    n.id    ?? `note-${Date.now()}-${Math.random()}`,
        updatedAt: n.updatedAt ?? Date.now(),
        folderId:  n.folderId  ?? null,
        deletedAt: n.deletedAt ?? null,
        starred:   n.starred   ?? false,
      }));
    }
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

export function nvLoadFolders(): NoteFolderBase[] {
  try {
    const raw = localStorage.getItem(NV_FOLDERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed as NoteFolderBase[] : [];
    }
  } catch { /**/ }
  return [];
}

export function nvSaveNotes(notes: NoteBase[]): void {
  try { localStorage.setItem(NV_NOTES_KEY, JSON.stringify(notes)); } catch { /**/ }
}

export function nvSaveFolders(folders: NoteFolderBase[]): void {
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
export function parseMarkdown(md: string, allNotes: NoteBase[]): string {
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

  const flushToggle = (summary: string, body: string): string => {
    const uid = Math.random().toString(36).slice(2);
    return `<details class="btoggle" id="btg-${uid}"><summary class="btsummary">${summary}</summary><div class="btbody">${body}</div></details>`;
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

export function processInline(text: string, allNotes: NoteBase[]): string {
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

export function processLine(line: string, allNotes: NoteBase[]): string {
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
  if (!body) return [];
  return body.split('\n')
    .map((line, i) => {
      const m = line.match(/^(#{1,3}) (.+)$/);
      return m ? { level: m[1].length, text: m[2], line: i, collapsed: false } : null;
    })
    .filter((x): x is TocItem => x !== null);
}

export function extractTags(body: string): string[] {
  if (!body) return [];
  return [...new Set(
    (body.match(/(^|\s)#([\w\uAC00-\uD7A3]+)/g) || []).map(m => m.trim().replace('#', ''))
  )];
}

export function extractLinks(body: string): string[] {
  if (!body) return [];
  return [...new Set([...(body.matchAll(/\[\[(.+?)\]\]/g))].map(m => m[1].trim()).filter(Boolean))];
}

/** 위키 제목 정규화 — 대소문자 무시 비교용 */
export function normalizeWikiTitle(title: string): string {
  return title.trim().toLowerCase();
}

/** 제목으로 노트 찾기 (대소문자 무시, 삭제된 노트 제외) */
export function findNoteByTitle(title: string, notes: NoteBase[]): NoteBase | undefined {
  const key = normalizeWikiTitle(title);
  if (!key) return undefined;
  return notes.find(n => !n.deletedAt && normalizeWikiTitle(n.title ?? '') === key);
}

/** body에 [[targetTitle]] 링크가 있는지 (대소문자 무시) */
export function noteReferencesTitle(body: string, targetTitle: string): boolean {
  const key = normalizeWikiTitle(targetTitle);
  if (!key || !body) return false;
  return extractLinks(body).some(l => normalizeWikiTitle(l) === key);
}

/** body에서 targetTitle을 가리키는 실제 [[...]] 토큰 (하이라이트용) */
export function findWikiLinkToken(body: string, targetTitle: string): string | null {
  const key = normalizeWikiTitle(targetTitle);
  if (!key) return null;
  for (const link of extractLinks(body)) {
    if (normalizeWikiTitle(link) === key) return `[[${link}]]`;
  }
  return null;
}

/** 텍스트 조각에서 targetTitle을 가리키는 [[...]] 토큰 (발췌 하이라이트용) */
export function findWikiLinkInText(text: string, targetTitle: string): string | null {
  const key = normalizeWikiTitle(targetTitle);
  if (!key) return null;
  const re = /\[\[(.+?)\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (normalizeWikiTitle(m[1]) === key) return m[0];
  }
  return null;
}

/** 검색어 파싱 — #tag → 태그 검색, 그 외 텍스트 검색 */
export function parseNoteSearchQuery(query: string): { mode: 'tag' | 'text'; value: string } {
  const q = query.trim();
  if (q.startsWith('#') && q.length > 1) {
    return { mode: 'tag', value: q.slice(1).trim() };
  }
  return { mode: 'text', value: q };
}

/** 노트가 태그 검색어와 매칭되는지 (부분 일치, 대소문자 무시) */
export function noteMatchesTagSearch(body: string, tagQuery: string): boolean {
  const q = tagQuery.trim().toLowerCase();
  if (!q) return true;
  return extractTags(body).some(t => t.toLowerCase().includes(q));
}

// ── 백링크 컨텍스트 ──────────────────────────────────────────────────
export interface LinkContext {
  /** 백링크를 포함하는 노트 */
  noteId: string;
  noteTitle: string;
  /** [[제목]] 을 포함한 문단(들) — 최대 2개, 각 최대 140자로 truncate */
  excerpts: string[];
}

/**
 * extractLinkContexts(targetTitle, allNotes)
 *
 * targetTitle 을 [[targetTitle]] 형태로 참조하는 모든 노트를 찾아
 * 해당 [[링크]]가 포함된 문단을 발췌해 반환한다.
 *
 * 발췌 규칙:
 *   - 빈 줄 기준으로 문단을 나누고, [[targetTitle]] 이 들어있는 문단을 수집
 *   - 문단이 없으면 [[링크]] 가 포함된 단일 줄을 fallback으로 사용
 *   - 각 발췌문은 최대 EXCERPT_MAX 글자로 잘라 '…' 처리
 *   - 노트당 최대 MAX_EXCERPTS 개 발췌
 */
export function extractLinkContexts(
  targetTitle: string,
  allNotes: NoteBase[],
  opts: { maxExcerpts?: number; excerptMax?: number } = {},
): LinkContext[] {
  if (!targetTitle.trim()) return [];

  const MAX_EXCERPTS = opts.maxExcerpts ?? 2;
  const EXCERPT_MAX  = opts.excerptMax  ?? 140;
  const targetKey    = normalizeWikiTitle(targetTitle);

  const results: LinkContext[] = [];

  for (const note of allNotes) {
    if (note.deletedAt) continue;
    const body = note.body ?? '';
    if (!noteReferencesTitle(body, targetTitle)) continue;

    const paragraphHasLink = (p: string) =>
      extractLinks(p).some(l => normalizeWikiTitle(l) === targetKey);

    // 빈 줄(\n\n)로 문단 분리
    const paragraphs = body.split(/\n{2,}/);
    let excerpts = paragraphs
      .filter(paragraphHasLink)
      .slice(0, MAX_EXCERPTS)
      .map(p => {
        // 마크다운 문법 기호 정리 (헤딩 # 제거, 줄 합치기)
        const clean = p
          .split('\n')
          .map(l => l.replace(/^#{1,6}\s+/, '').trim())
          .filter(Boolean)
          .join(' ');
        return clean.length > EXCERPT_MAX ? clean.slice(0, EXCERPT_MAX) + '…' : clean;
      });

    // 문단 분리로 못 찾은 경우 — 줄 단위 fallback
    if (excerpts.length === 0) {
      excerpts = body
        .split('\n')
        .filter(paragraphHasLink)
        .slice(0, MAX_EXCERPTS)
        .map(l => {
          const clean = l.replace(/^#{1,6}\s+/, '').trim();
          return clean.length > EXCERPT_MAX ? clean.slice(0, EXCERPT_MAX) + '…' : clean;
        });
    }

    if (excerpts.length > 0) {
      results.push({ noteId: note.id, noteTitle: note.title ?? '', excerpts });
    }
  }

  return results;
}
