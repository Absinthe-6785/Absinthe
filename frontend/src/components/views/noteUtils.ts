/**
 * noteUtils.ts — NoteView 순수 유틸리티
 *
 * React 의존성 없는 함수들을 모아 NoteView에서 분리.
 * 테스트 작성 및 재사용이 용이하도록 독립 모듈로 관리.
 */

import { normalizeNoteRelations } from './features/knowledge/relations/relationNormalize';
import { reconcileWeakTopicNote } from './features/knowledge/study/weakTopicTracking';
import {
  isTagsPropertyKey,
  TAGS_PROPERTY_KEY,
  tagsFromPropertyValue,
  tagsToPropertyValue,
} from './features/knowledge/tags/tagConstants';
import { protectMathInMarkdown } from '../../lib/math/mathParse';
import { renderProtectedMathBlock } from '../../lib/math/katexRender';

// 순환 참조 방지: useAppStore에서 import하지 않고 독립 타입 정의
// useAppStore의 Note/NoteFolder와 구조적으로 동일 (TypeScript 구조적 타이핑으로 호환)
export interface NoteBase {
  id: string;
  title: string;
  body: string;
  /** First creation time — optional on legacy notes; set on create in useNotesStore */
  createdAt?: number;
  /** Last time the note was opened in the editor — K-30.42 review maintenance */
  lastOpenedAt?: number;
  updatedAt: number;
  folderId: string | null;
  deletedAt: number | null;
  starred?: boolean;
  /** Page-level metadata — key/value strings, case-insensitive lookup */
  properties?: Record<string, string>;
  /** Outgoing relations — property key → target note ids */
  relations?: Record<string, string[]>;
}
export interface NoteFolderBase {
  id: string;
  name: string;
  createdAt: number;
}

export type Note = NoteBase;
export type NoteFolder = NoteFolderBase;

// ── localStorage 키 (통합 v2) ────────────────────────────────────────
export const NOTES_KEY   = 'notes-v2';
export const FOLDERS_KEY = 'note-folders-v2';
export const ACTIVE_KEY  = 'note-active-v2';
const MIGRATION_FLAG     = 'notes-storage-migrated-v2';

/** @deprecated use NOTES_KEY — NoteView legacy alias */
export const NV_NOTES_KEY   = NOTES_KEY;
/** @deprecated use FOLDERS_KEY */
export const NV_FOLDERS_KEY = FOLDERS_KEY;
/** @deprecated use ACTIVE_KEY */
export const NV_ACTIVE_KEY  = ACTIVE_KEY;

const LEGACY_NV_NOTES   = 'noteview-notes-v1';
const LEGACY_NV_FOLDERS = 'noteview-folders-v1';
const LEGACY_NV_ACTIVE  = 'noteview-active-v1';
const LEGACY_PL_NOTES   = 'planner-notes-v2';
const LEGACY_PL_FOLDERS = 'planner-note-folders';
const LEGACY_PL_ACTIVE  = 'planner-active-note';
const LEGACY_PL_NOTES_V1 = 'planner-notes';

function normalizeTagsPropertyValue(raw: unknown): string | undefined {
  const tags = tagsFromPropertyValue(raw);
  if (tags.length === 0) return undefined;
  return tagsToPropertyValue(tags);
}

export function normalizeNoteProperties(
  properties: Record<string, unknown> | null | undefined,
): Record<string, string> | undefined {
  if (!properties || typeof properties !== 'object') return undefined;

  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (typeof key !== 'string' || !key.trim()) continue;
    const trimmedKey = key.trim();

    if (isTagsPropertyKey(trimmedKey)) {
      const normalizedTags = normalizeTagsPropertyValue(value);
      if (normalizedTags) result[TAGS_PROPERTY_KEY] = normalizedTags;
      continue;
    }

    if (typeof value === 'string') {
      result[trimmedKey] = value;
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

export function normalizeNote(n: Partial<NoteBase>): NoteBase {
  const base: NoteBase = {
    id: n.id ?? `note-${Date.now()}-${Math.random()}`,
    title: n.title ?? '',
    body: n.body ?? '',
    updatedAt: n.updatedAt ?? Date.now(),
    createdAt: typeof n.createdAt === 'number' ? n.createdAt : undefined,
    lastOpenedAt: typeof n.lastOpenedAt === 'number' ? n.lastOpenedAt : undefined,
    folderId: n.folderId ?? null,
    deletedAt: n.deletedAt ?? null,
    starred: n.starred ?? false,
    properties: normalizeNoteProperties(n.properties),
    relations: normalizeNoteRelations(n.relations),
  };
  return reconcileWeakTopicNote(base);
}

function loadRawNotes(key: string): NoteBase[] | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.map(n => normalizeNote(n));
  } catch {
    return null;
  }
}

function loadRawFolders(key: string): NoteFolderBase[] | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as NoteFolderBase[] : null;
  } catch {
    return null;
  }
}

/** updatedAt 기준으로 노트 배열 병합 (id 중복 시 최신 우선) */
export function mergeNoteArrays(...groups: NoteBase[][]): NoteBase[] {
  const map = new Map<string, NoteBase>();
  for (const group of groups) {
    for (const n of group) {
      const cur = map.get(n.id);
      if (!cur || n.updatedAt > cur.updatedAt) map.set(n.id, n);
    }
  }
  return [...map.values()].sort((a, b) => b.updatedAt - a.updatedAt);
}

/** id 기준 폴더 병합 */
export function mergeFolderArrays(...groups: NoteFolderBase[][]): NoteFolderBase[] {
  const map = new Map<string, NoteFolderBase>();
  for (const group of groups) {
    for (const f of group) map.set(f.id, f);
  }
  return [...map.values()].sort((a, b) => a.createdAt - b.createdAt);
}

/** 다른 탭 localStorage JSON → 현재 notes와 updatedAt 기준 병합 */
export function mergeNotesFromStorageJson(local: NoteBase[], raw: string | null): NoteBase[] {
  if (!raw) return local;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return local;
    return mergeNoteArrays(local, parsed.map(n => normalizeNote(n)));
  } catch {
    return local;
  }
}

/** 다른 탭 localStorage JSON → 현재 folders와 id 기준 병합 */
export function mergeFoldersFromStorageJson(local: NoteFolderBase[], raw: string | null): NoteFolderBase[] {
  if (!raw) return local;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return local;
    return mergeFolderArrays(local, parsed as NoteFolderBase[]);
  } catch {
    return local;
  }
}

function defaultSeedNotes(): NoteBase[] {
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

/** noteview + planner legacy → notes-v2 일회 마이그레이션 */
export function migrateLegacyStorageIfNeeded(): void {
  if (localStorage.getItem(MIGRATION_FLAG)) return;
  if (localStorage.getItem(NOTES_KEY)) {
    localStorage.setItem(MIGRATION_FLAG, '1');
    return;
  }

  const noteGroups: NoteBase[][] = [];
  const nv = loadRawNotes(LEGACY_NV_NOTES);
  const pl = loadRawNotes(LEGACY_PL_NOTES);
  const plv1 = loadRawNotes(LEGACY_PL_NOTES_V1);
  if (nv?.length) noteGroups.push(nv);
  if (pl?.length) noteGroups.push(pl);
  if (plv1?.length) noteGroups.push(plv1.map(n => ({ ...n, folderId: null, deletedAt: null })));

  const mergedNotes = noteGroups.length > 0 ? mergeNoteArrays(...noteGroups) : defaultSeedNotes();
  saveNotes(mergedNotes);

  const folderGroups: NoteFolderBase[][] = [];
  const nvF = loadRawFolders(LEGACY_NV_FOLDERS);
  const plF = loadRawFolders(LEGACY_PL_FOLDERS);
  if (nvF?.length) folderGroups.push(nvF);
  if (plF?.length) folderGroups.push(plF);
  if (folderGroups.length > 0) saveFolders(mergeFolderArrays(...folderGroups));

  const active =
    localStorage.getItem(LEGACY_NV_ACTIVE) ||
    localStorage.getItem(LEGACY_PL_ACTIVE) ||
    mergedNotes.find(n => !n.deletedAt)?.id ||
    null;
  if (active) {
    try { localStorage.setItem(ACTIVE_KEY, active); } catch { /**/ }
  }

  localStorage.setItem(MIGRATION_FLAG, '1');
}

// ── localStorage helpers ─────────────────────────────────────────────
export function loadNotes(): NoteBase[] {
  migrateLegacyStorageIfNeeded();
  return loadRawNotes(NOTES_KEY) ?? defaultSeedNotes();
}

export function loadFolders(): NoteFolderBase[] {
  migrateLegacyStorageIfNeeded();
  return loadRawFolders(FOLDERS_KEY) ?? [];
}

export function loadActiveNoteId(notes: NoteBase[]): string | null {
  migrateLegacyStorageIfNeeded();
  try {
    const s = localStorage.getItem(ACTIVE_KEY);
    if (s && notes.some(n => n.id === s)) return s;
  } catch { /**/ }
  return notes.find(n => !n.deletedAt)?.id ?? null;
}

export const LOCAL_NOTES_SAVE_ERROR =
  'Local save failed — storage may be full. Export notes or free browser storage.';
export const LOCAL_FOLDERS_SAVE_ERROR =
  'Local folder save failed — storage may be full. Free browser storage.';

export function saveNotes(notes: NoteBase[]): boolean {
  try {
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
    return true;
  } catch {
    return false;
  }
}

export function saveFolders(folders: NoteFolderBase[]): boolean {
  try {
    localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
    return true;
  } catch {
    return false;
  }
}

export function saveActiveNoteId(id: string | null): void {
  try { localStorage.setItem(ACTIVE_KEY, id ?? ''); } catch { /**/ }
}

/** Settings Reset 등 — notes localStorage 전부 제거 */
export function clearNotesStorage(): void {
  try {
    localStorage.removeItem(NOTES_KEY);
    localStorage.removeItem(FOLDERS_KEY);
    localStorage.removeItem(ACTIVE_KEY);
  } catch { /**/ }
}

/** DB·로컬 초기화 후 기본 환영 노트 1개 생성 */
export function createDefaultWelcomeNotes(): NoteBase[] {
  const notes = defaultSeedNotes();
  saveNotes(notes);
  saveActiveNoteId(notes[0]?.id ?? null);
  saveFolders([]);
  return notes;
}

/** @deprecated use loadNotes */
export const nvLoadNotes = loadNotes;
/** @deprecated use loadFolders */
export const nvLoadFolders = loadFolders;
/** @deprecated use saveNotes */
export const nvSaveNotes = saveNotes;
/** @deprecated use saveFolders */
export const nvSaveFolders = saveFolders;

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

  // 1. 수식 보호 (K-49 shared parser — currency false-positive safe)
  const { text: protectedText, mathBlocks } = protectMathInMarkdown(md);
  let text = protectedText;

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
    if (!m) return '';
    return renderProtectedMathBlock(m);
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
  if (/^#### /.test(line)) return `<h4 class="bh4">${processInline(line.replace(/^#### /, ''), allNotes)}</h4>`;
  if (/^### /.test(line)) return `<h3 class="bh3">${processInline(line.replace(/^### /, ''), allNotes)}</h3>`;
  if (/^## /.test(line))  return `<h2 class="bh2">${processInline(line.replace(/^## /, ''), allNotes)}</h2>`;
  if (/^# /.test(line))   return `<h1 class="bh1">${processInline(line.replace(/^# /, ''), allNotes)}</h1>`;
  if (/^---$/.test(line)) return '<hr class="bhr"/>';
  if (/^- \[x\] /.test(line)) return `<div class="bchk done">✓ ${processInline(line.replace(/^- \[x\] /, ''), allNotes)}</div>`;
  if (/^- \[ \] /.test(line)) return `<div class="bchk">☐ ${processInline(line.replace(/^- \[ \] /, ''), allNotes)}</div>`;
  return `<p class="bpara">${inl}</p>`;
}

// ── 분석 유틸 ────────────────────────────────────────────────────────
export interface TocItem {
  level: number;
  text: string;
  line: number;
  collapsed: boolean;
  isToggleHeading?: boolean;
}

export function extractTOC(body: string, options?: { untitledLabel?: string }): TocItem[] {
  if (!body) return [];
  const untitled = options?.untitledLabel ?? '(Untitled)';
  return body.split('\n')
    .map((line, i) => {
      const toggleM = line.match(/^(#{1,4})>!?\s?(.*)$/);
      if (toggleM) {
        const text = toggleM[2].trim() || untitled;
        return {
          level: toggleM[1].length,
          text,
          line: i,
          collapsed: line.includes('>!'),
          isToggleHeading: true,
        };
      }
      const m = line.match(/^(#{1,4}) (.+)$/);
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

/** 휴지통 보존 기간 (30일) */
export const NOTE_TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

/** 가상 폴더(trash/starred) → null, 실제 폴더 id 유지 */
export function normalizeNoteFolderId(
  folderId: string | null | 'trash' | 'starred' | undefined,
): string | null {
  if (folderId === null || folderId === undefined || folderId === 'trash' || folderId === 'starred') {
    return null;
  }
  return folderId;
}

/**
 * DB 로드 결과와 localStorage를 병합.
 * DB에 없는 로컬 전용 노트는 업로드 성공 여부와 무관하게 UI에 유지한다.
 */
export function mergeDbAndLocalNotes(
  dbNotes: NoteBase[],
  localNotes: NoteBase[],
  now = Date.now(),
): NoteBase[] {
  const dbIds = new Set(dbNotes.map(n => n.id));
  const validFromDb = dbNotes.filter(
    n => !n.deletedAt || now - n.deletedAt < NOTE_TRASH_RETENTION_MS,
  );
  const localOnly = localNotes.filter(l => !dbIds.has(l.id) && !l.deletedAt);
  return [...localOnly, ...validFromDb].sort((a, b) => b.updatedAt - a.updatedAt);
}

/** DB 응답에 없는 활성 로컬 노트 */
export function getLocalOnlyNotes(dbNoteIds: Iterable<string>, localNotes: NoteBase[]): NoteBase[] {
  const ids = new Set(dbNoteIds);
  return localNotes.filter(l => !ids.has(l.id) && !l.deletedAt);
}

/** POST /api/notes upsert 페이로드 — NoteView·Planner 공통 */
export function noteSyncPayload(note: NoteBase) {
  const payload: Record<string, unknown> = {
    id: note.id,
    title: note.title ?? '',
    body: note.body ?? '',
    updated_at: note.updatedAt,
    folder_id: note.folderId ?? null,
    deleted_at: note.deletedAt ?? null,
    starred: note.starred ?? false,
  };
  if (note.properties && Object.keys(note.properties).length > 0) {
    payload.properties = note.properties;
  }
  if (note.relations && Object.keys(note.relations).length > 0) {
    payload.relations = note.relations;
  }
  return payload;
}

/** 위키 제목 정규화 — 대소문자 무시 비교용 */
export function normalizeWikiTitle(title: string): string {
  return title.trim().toLowerCase();
}

/** 제목으로 노트 찾기 (대소문자 무시, 삭제된 노트 제외) */
export function findNoteByTitle(title: string, notes: readonly NoteBase[]): NoteBase | undefined {
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
