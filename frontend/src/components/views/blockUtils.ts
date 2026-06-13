/**
 * blockUtils.ts — 블록 에디터 데이터 모델 & 변환 유틸
 *
 * Phase 1: 타입 정의 + 마크다운 ↔ 블록 배열 변환
 * React 의존성 없음 — 순수 TypeScript
 */
import { resolveSlashCommand, slashCommandKeysMatching } from './features/block-editor/features/menus';
import { citationFieldsToBlockPatch, parseCitationBody, serializeCitationBody } from './citationUtils';
import { parseAnswerBody, parseQuestionBody, serializeAnswerBody } from './studyBlockUtils';
import type { BlockTint } from './blockColors';
import { CALLOUT_PRESETS, DEFAULT_CALLOUT_ICON, calloutIconForObsidianAlias } from './calloutPresets';
import {
  isToggleBlockType,
  toggleHeadingBlockType,
  toggleHeadingLevel,
  toggleHeadingMarker,
} from './toggleBlockTypes';

// ── 블록 타입 정의 ─────────────────────────────────────────────────────

export type BlockType =
  | 'paragraph'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'heading4'
  | 'bullet'
  | 'numbered'
  | 'todo'
  | 'toggle'
  | 'toggleHeading1'
  | 'toggleHeading2'
  | 'toggleHeading3'
  | 'toggleHeading4'
  | 'code'
  | 'image'
  | 'divider'
  | 'table'
  | 'quote'
  | 'callout'
  | 'math'
  | 'footnote'
  | 'mermaid'
  | 'audio'
  | 'citation'
  | 'question'
  | 'answer';

/** 인라인 서식 스팬 — contentEditable 렌더링에 사용 */
export interface InlineSpan {
  text: string;
  bold?:   boolean;
  italic?: boolean;
  strike?: boolean;
  code?:   boolean;
  mark?:   boolean;        // ==highlight==
  wikiLink?: string;       // [[NoteName]] → note id
  tag?: string;            // #태그
  footnoteRef?: string;    // [^1] inline reference
}

/** 표 셀 */
export interface TableCell {
  content: string;         // 마크다운 인라인 텍스트
  header?: boolean;
}

/**
 * Block — 모든 블록의 공통 형태
 * 타입별로 의미 있는 필드만 채워짐
 */
export interface Block {
  id:       string;
  type:     BlockType;

  // 텍스트 계열 (paragraph, heading*, bullet, numbered, todo, toggle, quote, callout)
  content:  string;        // 마크다운 인라인 텍스트 (raw)

  // 중첩 블록 (toggle의 children, bullet 들여쓰기)
  children: Block[];
  indent:   number;        // 0-based 들여쓰기 깊이

  // todo
  checked?: boolean;

  // toggle
  collapsed?: boolean;

  // code
  language?: string;
  code?:     string;

  // image
  src?:  string;
  alt?:  string;
  caption?: string;
  width?: number;          // 표시 너비(px) — 마크다운 title에 |w:N 으로 직렬화

  // table
  tableHeaders?: string[];
  tableRows?:    string[][];

  // callout
  calloutIcon?: string;    // 이모지

  // math
  math?: string;           // LaTeX 표현식
  mathBlock?: boolean;     // true → $$...$$ 블록, false/undefined → $...$ 인라인

  // footnote definition block
  footnoteId?: string;

  // mermaid diagram source
  mermaid?: string;

  // audio (src shared with image; caption optional)

  // citation block
  citationTitle?: string;
  citationAuthor?: string;
  citationYear?: string;
  citationPage?: string;
  citationUrl?: string;

  // answer reveal block
  answerRevealed?: boolean;

  // numbered list — 원본 번호 보존 (2., 3. 등)
  listIndex?: number;

  // editor chrome — optional block highlight tint
  tint?: BlockTint;
}

/** contentEditable로 편집되는 텍스트 계열 블록 */
export const TEXT_BLOCK_TYPES = new Set<BlockType>([
  'paragraph', 'heading1', 'heading2', 'heading3', 'heading4',
  'bullet', 'numbered', 'todo', 'quote', 'callout',
]);

export function isTextBlockType(type: BlockType): boolean {
  return TEXT_BLOCK_TYPES.has(type);
}

/** 마크다운 image title에서 캡션·너비 파싱 ("caption|w:400") */
export function parseImageTitle(raw: string): { caption?: string; width?: number } {
  const widthMatch = raw.match(/\|w:(\d+)/);
  const width = widthMatch ? Number(widthMatch[1]) : undefined;
  const caption = raw.replace(/\|w:\d+/, '').trim() || undefined;
  return { caption, width };
}

/** 마크다운 image title 직렬화 */
export function formatImageTitle(caption?: string, width?: number): string | undefined {
  let title = caption ?? '';
  if (width != null) title = title ? `${title}|w:${width}` : `|w:${width}`;
  return title || undefined;
}

/** 이미지 URL 유효성 (data URL 또는 http/https) */
export function isValidImageUrl(url: string): boolean {
  const t = url.trim();
  if (!t) return false;
  if (/^data:image\//i.test(t)) return true;
  try {
    const u = new URL(t);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/** URL에서 alt 후보 추출 (파일명) */
export function imageAltFromUrl(url: string): string {
  try {
    const path = new URL(url).pathname;
    const base = path.split('/').pop() ?? '';
    return base.replace(/\.[^.]+$/, '') || 'image';
  } catch {
    return 'image';
  }
}

// ── ID 생성 ──────────────────────────────────────────────────────────

let _idCounter = 0;
export function genBlockId(): string {
  return `blk-${Date.now()}-${++_idCounter}-${Math.random().toString(36).slice(2, 6)}`;
}

// ── 블록 팩토리 ──────────────────────────────────────────────────────

export function makeBlock(type: BlockType, partial: Partial<Block> = {}): Block {
  return {
    id:       genBlockId(),
    type,
    content:  '',
    children: [],
    indent:   0,
    ...partial,
  };
}

/** Deep-clone a block subtree with fresh ids. */
export function cloneBlockTree(block: Block): Block {
  return {
    ...block,
    id: genBlockId(),
    children: block.children.map(cloneBlockTree),
  };
}

// ── 마크다운 → 블록 배열 파서 ────────────────────────────────────────
/**
 * 기존 noteUtils.ts의 parseMarkdown이 HTML을 반환하는 것과 달리
 * 이쪽은 편집 가능한 Block[] 구조를 반환한다.
 *
 * 호환 보장:
 *  - 기존 노트의 body(마크다운 문자열)를 그대로 입력받아 Block[]로 변환
 *  - blocksToMarkdown()으로 다시 직렬화하면 원래 문자열과 동일한 마크다운이 나옴
 */
export function markdownToBlocks(md: string): Block[] {
  if (!md) return [makeBlock('paragraph')];

  const lines = md.split('\n');
  const blocks: Block[] = [];
  let i = 0;

  // ── 코드블록 ─────────────────────────────────────────────────────
  const tryCodeBlock = (): Block | null => {
    const m = lines[i].match(/^```([\w]*)\s*$/);
    if (!m) return null;
    const lang = m[1] || '';
    const codeLines: string[] = [];
    i++;
    while (i < lines.length && lines[i] !== '```') {
      codeLines.push(lines[i]);
      i++;
    }
    i++; // 닫는 ```
    if (lang === 'mermaid') {
      return makeBlock('mermaid', { mermaid: codeLines.join('\n') });
    }
    if (lang === 'audio') {
      const src = codeLines[0]?.trim() ?? '';
      const caption = codeLines.slice(1).join('\n').trim() || undefined;
      return makeBlock('audio', { src, caption, content: '' });
    }
    if (lang === 'citation') {
      const fields = parseCitationBody(codeLines.join('\n'));
      return makeBlock('citation', { content: '', ...citationFieldsToBlockPatch(fields) });
    }
    if (lang === 'question') {
      return makeBlock('question', { content: parseQuestionBody(codeLines.join('\n')) });
    }
    if (lang === 'answer') {
      const parsed = parseAnswerBody(codeLines.join('\n'));
      return makeBlock('answer', { content: parsed.content, answerRevealed: parsed.revealed });
    }
    return makeBlock('code', { language: lang, code: codeLines.join('\n') });
  };

  // ── 수학 블록 $$...$$──────────────────────────────────────────────
  const tryMathBlock = (): Block | null => {
    if (lines[i] !== '$$') return null;
    const mathLines: string[] = [];
    i++;
    while (i < lines.length && lines[i] !== '$$') {
      mathLines.push(lines[i]);
      i++;
    }
    i++;
    return makeBlock('math', { math: mathLines.join('\n'), mathBlock: true });
  };

  // ── 테이블 ───────────────────────────────────────────────────────
  const tryTable = (): Block | null => {
    if (!/^\|.+\|/.test(lines[i])) return null;
    const headerLine = lines[i];
    // 다음 줄이 구분자 줄인지 확인
    if (i + 1 >= lines.length || !/^\|[\s\-:|]+\|/.test(lines[i + 1])) return null;

    const parseRow = (line: string) =>
      line.split('|').slice(1, -1).map(c => c.trim());

    const headers = parseRow(headerLine);
    i += 2; // header + divider 건너뜀

    const rows: string[][] = [];
    while (i < lines.length && /^\|.+\|/.test(lines[i])) {
      rows.push(parseRow(lines[i]));
      i++;
    }
    return makeBlock('table', { tableHeaders: headers, tableRows: rows });
  };

  // ── 각주 정의 [^1]: text ───────────────────────────────────────────
  const tryFootnote = (): Block | null => {
    const m = lines[i].match(/^\[\^([^\]]+)\]:\s?(.*)$/);
    if (!m) return null;
    i++;
    return makeBlock('footnote', { footnoteId: m[1], content: m[2] ?? '' });
  };

  // ── Q: inline question line ───────────────────────────────────────
  const tryQuestionLine = (): Block | null => {
    const m = lines[i].match(/^Q:\s+(.+)$/i);
    if (!m) return null;
    i++;
    return makeBlock('question', { content: m[1].trim() });
  };

  // ── Obsidian 콜아웃 (> [!tip] …) ─────────────────────────────────
  const tryObsidianCallout = (): Block | null => {
    const m = lines[i].match(/^> \[!(\w+)\]\s*(.*)$/i);
    if (!m) return null;

    const icon = calloutIconForObsidianAlias(m[1]);
    if (!icon) return null;

    const contentLines: string[] = [];
    if (m[2]?.trim()) contentLines.push(m[2].trim());
    i++;
    while (i < lines.length && /^> /.test(lines[i]) && !/^> \[!(\w+)\]/i.test(lines[i])) {
      contentLines.push(lines[i].replace(/^> /, ''));
      i++;
    }

    return makeBlock('callout', { content: contentLines.join('\n'), calloutIcon: icon });
  };

  // ── 콜아웃 (토글·인용보다 먼저 — "> 💡 text" 직렬화 호환) ─────────
  const tryCallout = (): Block | null => {
    const m = lines[i].match(/^> ([\p{Extended_Pictographic}\u2600-\u27BF])\s*(.*)$/u);
    if (!m) return null;

    const nextLine = lines[i + 1];
    const hasToggleChildren = nextLine !== undefined &&
      (nextLine.startsWith('  ') || nextLine === '');
    if (hasToggleChildren) return null;

    i++;
    return makeBlock('callout', { content: m[2], calloutIcon: m[1] });
  };

  // ── 토글 제목 (#> … / ##> …) ─────────────────────────────────────
  const tryToggleHeading = (): Block | null => {
    const mClosed = lines[i].match(/^(#{1,4})>!\s?(.*)$/);
    const mOpen = !mClosed && lines[i].match(/^(#{1,4})>(?!!)\s?(.*)$/);
    const m = mClosed ?? mOpen;
    if (!m) return null;

    const level = m[1].length as 1 | 2 | 3 | 4;
    const collapsed = !!mClosed;
    const summary = m[2] ?? '';

    const nextLine = lines[i + 1];
    const hasChildren = nextLine !== undefined &&
      (nextLine.startsWith('  ') || nextLine === '');

    if (!collapsed && !hasChildren && !summary) return null;

    const childLines: string[] = [];
    i++;
    while (i < lines.length && (lines[i].startsWith('  ') || lines[i] === '')) {
      childLines.push(lines[i].replace(/^  /, ''));
      i++;
    }
    const children = childLines.length > 0
      ? markdownToBlocks(childLines.join('\n'))
      : [];
    return makeBlock(toggleHeadingBlockType(level), { content: summary, children, collapsed });
  };

  // ── 토글 블록 ─────────────────────────────────────────────────────
  // 열린 toggle : "> 제목" / ">" (빈 제목) → collapsed: false
  // 닫힌 toggle : ">! 제목" / ">!"         → collapsed: true
  const tryToggle = (): Block | null => {
    const mClosed = lines[i].match(/^>!\s?(.*)$/);
    const mOpen   = !mClosed && lines[i].match(/^>(?!!)\s?(.*)$/);
    const m       = mClosed ?? mOpen;
    if (!m) return null;

    const collapsed = !!mClosed;
    const summary   = m[1] ?? '';

    const nextLine = lines[i + 1];
    const hasChildren = nextLine !== undefined &&
      (nextLine.startsWith('  ') || nextLine === '');

    // 닫힌 toggle(>!)은 자식 유무 무관하게 toggle로 처리
    // 열린 toggle(>)은 자식이 있을 때만 toggle — 없으면 quote로 양보
    if (!collapsed && !hasChildren) return null;

    const childLines: string[] = [];
    i++;
    while (i < lines.length && (lines[i].startsWith('  ') || lines[i] === '')) {
      childLines.push(lines[i].replace(/^  /, ''));
      i++;
    }
    const children = childLines.length > 0
      ? markdownToBlocks(childLines.join('\n'))
      : [];
    return makeBlock('toggle', { content: summary, children, collapsed });
  };

  // ── 이미지 ───────────────────────────────────────────────────────
  const tryImage = (line: string): Block | null => {
    const m = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (!m) return null;
    // src 에 마크다운 title 문법으로 캡션/너비 포함 가능: src "caption|w:400"
    let src = m[2];
    let caption: string | undefined;
    let width: number | undefined;
    const titleMatch = src.match(/^(\S.*?)\s+"([^"]*)"$/);
    if (titleMatch) {
      src = titleMatch[1];
      ({ caption, width } = parseImageTitle(titleMatch[2]));
    }
    return makeBlock('image', { alt: m[1], src, ...(caption !== undefined ? { caption } : {}), ...(width !== undefined ? { width } : {}) });
  };

  // ── 번호 목록 연속 처리 ──────────────────────────────────────────
  const tryNumberedList = (): Block[] | null => {
    if (!/^\s*\d+\. /.test(lines[i])) return null;
    const result: Block[] = [];
    while (i < lines.length && /^\s*\d+\. /.test(lines[i])) {
      const m = lines[i].match(/^(\s*)(\d+)\. (.+)$/);
      if (!m) break;
      const indent = Math.floor(m[1].length / 2);
      result.push(makeBlock('numbered', { content: m[3], indent, listIndex: Number(m[2]) }));
      i++;
    }
    return result;
  };

  // ── 불릿 목록 연속 처리 ──────────────────────────────────────────
  const tryBulletList = (): Block[] | null => {
    if (!/^\s*[-*] /.test(lines[i])) return null;
    const result: Block[] = [];
    while (i < lines.length && /^\s*[-*] /.test(lines[i])) {
      const indent = Math.floor((lines[i].match(/^(\s*)/)?.[1].length ?? 0) / 2);
      const raw = lines[i].replace(/^\s*[-*] /, '');
      // todo 체크박스
      if (/^\[x\] /i.test(raw)) {
        result.push(makeBlock('todo', { content: raw.slice(4), indent, checked: true }));
      } else if (/^\[ \] /.test(raw)) {
        result.push(makeBlock('todo', { content: raw.slice(4), indent, checked: false }));
      } else {
        result.push(makeBlock('bullet', { content: raw, indent }));
      }
      i++;
    }
    return result;
  };

  // ── 메인 루프 ────────────────────────────────────────────────────
  while (i < lines.length) {
    const line = lines[i];

    // 빈 줄 — 빈 paragraph로 보존 (연속 빈 줄도 각각 유지)
    if (!line.trim()) {
      blocks.push(makeBlock('paragraph', { content: '' }));
      i++;
      continue;
    }

    // 코드 블록
    const code = tryCodeBlock();
    if (code) { blocks.push(code); continue; }

    // 수식 블록
    const math = tryMathBlock();
    if (math) { blocks.push(math); continue; }

    // 테이블
    const table = tryTable();
    if (table) { blocks.push(table); continue; }

    // 각주 정의
    const footnote = tryFootnote();
    if (footnote) { blocks.push(footnote); continue; }

    // Q: question line
    const questionLine = tryQuestionLine();
    if (questionLine) { blocks.push(questionLine); continue; }

    // Obsidian 콜아웃
    const obsidianCallout = tryObsidianCallout();
    if (obsidianCallout) { blocks.push(obsidianCallout); continue; }

    // 콜아웃
    const callout = tryCallout();
    if (callout) { blocks.push(callout); continue; }

    // 토글 제목 (heading + toggle)
    const toggleHeading = tryToggleHeading();
    if (toggleHeading) { blocks.push(toggleHeading); continue; }

    // 토글
    const toggle = tryToggle();
    if (toggle) { blocks.push(toggle); continue; }

    // 번호 목록
    const numbered = tryNumberedList();
    if (numbered) { blocks.push(...numbered); continue; }

    // 불릿 목록 (todo 포함)
    const bullets = tryBulletList();
    if (bullets) { blocks.push(...bullets); continue; }

    // 이미지
    const img = tryImage(line);
    if (img) { blocks.push(img); i++; continue; }

    // 구분선
    if (/^---+$/.test(line)) {
      blocks.push(makeBlock('divider'));
      i++; continue;
    }

    // 제목
    if (/^#### (.+)$/.test(line)) {
      blocks.push(makeBlock('heading4', { content: line.replace(/^#### /, '') }));
      i++; continue;
    }
    if (/^### (.+)$/.test(line)) {
      blocks.push(makeBlock('heading3', { content: line.replace(/^### /, '') }));
      i++; continue;
    }
    if (/^## (.+)$/.test(line)) {
      blocks.push(makeBlock('heading2', { content: line.replace(/^## /, '') }));
      i++; continue;
    }
    if (/^# (.+)$/.test(line)) {
      blocks.push(makeBlock('heading1', { content: line.replace(/^# /, '') }));
      i++; continue;
    }

    // 인용 (단일 줄 — 토글이 아닌 경우)
    if (/^> (.+)$/.test(line)) {
      blocks.push(makeBlock('quote', { content: line.replace(/^> /, '') }));
      i++; continue;
    }

    // 인라인 수식 $...$ (단일 줄)
    if (/^\$[^$].+[^$]\$$/.test(line.trim()) || /^\$\$.+\$\$$/.test(line.trim())) {
      const expr = line.trim().replace(/^\$\$?/, '').replace(/\$\$?$/, '');
      blocks.push(makeBlock('math', { math: expr, mathBlock: false }));
      i++; continue;
    }

    // 일반 문단
    blocks.push(makeBlock('paragraph', { content: line }));
    i++;
  }

  // 항상 최소 하나의 블록
  if (blocks.length === 0) blocks.push(makeBlock('paragraph'));
  return blocks;
}

// ── 블록 배열 → 마크다운 직렬화 ─────────────────────────────────────
/**
 * Block[]을 마크다운 문자열로 직렬화
 * 기존 body와 완전히 호환되어 localStorage/DB 저장에 그대로 사용 가능
 */
export function blocksToMarkdown(blocks: Block[]): string {
  const lines: string[] = [];

  for (const block of blocks) {
    switch (block.type) {
      case 'paragraph':
        lines.push(block.content);
        break;

      case 'heading1':
        lines.push(`# ${block.content}`);
        break;
      case 'heading2':
        lines.push(`## ${block.content}`);
        break;
      case 'heading3':
        lines.push(`### ${block.content}`);
        break;
      case 'heading4':
        lines.push(`#### ${block.content}`);
        break;

      case 'bullet': {
        const pad = '  '.repeat(block.indent);
        lines.push(`${pad}- ${block.content}`);
        break;
      }
      case 'numbered': {
        const pad = '  '.repeat(block.indent);
        lines.push(`${pad}${block.listIndex ?? 1}. ${block.content}`);
        break;
      }
      case 'todo': {
        const pad = '  '.repeat(block.indent);
        lines.push(`${pad}- [${block.checked ? 'x' : ' '}] ${block.content}`);
        break;
      }

      case 'toggle': {
        // collapsed / empty leaf → ">!" ; open → ">" (빈 제목은 접두만 출력)
        const collapsed = block.collapsed || (!block.content && block.children.length === 0);
        const prefix = collapsed ? '>!' : '>';
        lines.push(block.content ? `${prefix} ${block.content}` : prefix);
        if (block.children.length > 0) {
          const childMd = blocksToMarkdown(block.children);
          childMd.split('\n').forEach(cl => lines.push(`  ${cl}`));
        }
        break;
      }

      case 'toggleHeading1':
      case 'toggleHeading2':
      case 'toggleHeading3':
      case 'toggleHeading4': {
        const level = toggleHeadingLevel(block.type)!;
        const collapsed = block.collapsed || (!block.content && block.children.length === 0);
        const prefix = toggleHeadingMarker(level, collapsed);
        lines.push(block.content ? `${prefix} ${block.content}` : prefix);
        if (block.children.length > 0) {
          const childMd = blocksToMarkdown(block.children);
          childMd.split('\n').forEach(cl => lines.push(`  ${cl}`));
        }
        break;
      }

      case 'quote':
        lines.push(`> ${block.content}`);
        break;

      case 'callout':
        lines.push(`> ${block.calloutIcon ?? DEFAULT_CALLOUT_ICON} ${block.content}`);
        break;

      case 'code':
        lines.push('```' + (block.language ?? ''));
        lines.push(block.code ?? '');
        lines.push('```');
        break;

      case 'image': {
        // 캡션·너비는 title에 직렬화: ![alt](src "caption|w:400")
        const title = formatImageTitle(block.caption, block.width);
        const cap = title ? ` "${title.replace(/"/g, '')}"` : '';
        lines.push(`![${block.alt ?? ''}](${block.src ?? ''}${cap})`);
        break;
      }

      case 'divider':
        lines.push('---');
        break;

      case 'table': {
        const headers = block.tableHeaders ?? [];
        if (headers.length > 0) {
          lines.push(`| ${headers.join(' | ')} |`);
          lines.push(`| ${headers.map(() => '---').join(' | ')} |`);
          (block.tableRows ?? []).forEach(row =>
            lines.push(`| ${row.join(' | ')} |`)
          );
        }
        break;
      }

      case 'math':
        if (block.mathBlock || (block.math ?? '').includes('\n')) {
          lines.push('$$');
          lines.push(block.math ?? '');
          lines.push('$$');
        } else {
          lines.push(`$${block.math}$`);
        }
        break;

      case 'footnote':
        lines.push(`[^${block.footnoteId ?? '1'}]: ${block.content}`);
        break;

      case 'mermaid':
        lines.push('```mermaid');
        lines.push(block.mermaid ?? '');
        lines.push('```');
        break;

      case 'audio': {
        lines.push('```audio');
        lines.push(block.src ?? '');
        if (block.caption?.trim()) lines.push(block.caption);
        lines.push('```');
        break;
      }

      case 'citation': {
        lines.push('```citation');
        lines.push(serializeCitationBody({
          title: block.citationTitle ?? '',
          author: block.citationAuthor ?? '',
          year: block.citationYear ?? '',
          page: block.citationPage,
          url: block.citationUrl,
        }));
        lines.push('```');
        break;
      }

      case 'question': {
        const q = block.content?.trim() ?? '';
        lines.push(q ? `Q: ${q}` : 'Q: ');
        break;
      }

      case 'answer': {
        lines.push('```answer');
        lines.push(serializeAnswerBody(block.content ?? '', block.answerRevealed ?? false));
        lines.push('```');
        break;
      }

      default:
        lines.push(block.content);
    }
  }

  return lines.join('\n');
}

// ── 블록 조작 헬퍼 ───────────────────────────────────────────────────

/** 블록 배열의 특정 id 블록을 업데이트 (중첩 포함) */
export function updateBlockById(
  blocks: Block[],
  id: string,
  updater: (b: Block) => Block
): Block[] {
  return blocks.map(b => {
    if (b.id === id) return updater(b);
    if (b.children.length > 0) {
      return { ...b, children: updateBlockById(b.children, id, updater) };
    }
    return b;
  });
}

/** afterId 뒤(없으면 끝)에 이미지 블록 삽입 */
export function insertImageAfter(
  blocks: Block[],
  afterId: string | null,
  src: string,
  alt: string,
): { blocks: Block[]; imageId: string } {
  const img = makeBlock('image', { src, alt });
  if (!afterId) return { blocks: [...blocks, img], imageId: img.id };
  const result = insertBlockAfter(blocks, afterId, img);
  const inserted = flattenBlockIds(result).includes(img.id);
  return inserted ? { blocks: result, imageId: img.id } : { blocks: [...blocks, img], imageId: img.id };
}

/** 특정 id 블록 뒤에 새 블록 삽입 */
export function insertBlockAfter(
  blocks: Block[],
  afterId: string,
  newBlock: Block
): Block[] {
  const result: Block[] = [];
  for (const b of blocks) {
    result.push(b);
    if (b.id === afterId) result.push(newBlock);
    else if (b.children.length > 0) {
      const newChildren = insertBlockAfter(b.children, afterId, newBlock);
      if (newChildren !== b.children) result[result.length - 1] = { ...b, children: newChildren };
    }
  }
  return result;
}

/** 특정 id 블록 삭제 */
export function deleteBlockById(blocks: Block[], id: string): Block[] {
  return blocks
    .filter(b => b.id !== id)
    .map(b => b.children.length > 0
      ? { ...b, children: deleteBlockById(b.children, id) }
      : b
    );
}

/** id로 블록 찾기 (중첩 포함) */
export function findBlockById(blocks: Block[], id: string): Block | null {
  for (const b of blocks) {
    if (b.id === id) return b;
    if (b.children.length > 0) {
      const found = findBlockById(b.children, id);
      if (found) return found;
    }
  }
  return null;
}

/** 블록의 이전/다음 id 반환 (평탄화 기준) */
export function flattenBlockIds(blocks: Block[]): string[] {
  const ids: string[] = [];
  const walk = (bs: Block[]) => bs.forEach(b => { ids.push(b.id); walk(b.children); });
  walk(blocks);
  return ids;
}

/** 두 블록을 병합 — 위 블록의 content 끝에 아래 블록 content를 이어붙임 */
export function mergeBlocks(upper: Block, lower: Block): Block {
  return { ...upper, content: upper.content + lower.content };
}

// ── 블록 타입 메타데이터 (슬래시 커맨드용) ──────────────────────────

export interface BlockTypeMeta {
  type:     BlockType;
  label:    string;
  desc:     string;
  icon:     string;          // 이모지 또는 텍스트 기호
  keywords: string[];
  group:    'text' | 'list' | 'media' | 'embed';
  /** Slash exact-match key when multiple menu rows share one block type */
  menuKey?: string;
  /** Fields applied when inserting via slash menu */
  createDefaults?: Partial<Block>;
}

export function slashMenuItemKey(meta: BlockTypeMeta): string {
  return meta.menuKey ?? meta.type;
}

/** Resolve slash query to a specific menu row (callout variants, toggle headings). */
export function resolveSlashMenuMeta(query: string): BlockTypeMeta | null {
  const q = query.toLowerCase().trim().replace(/^\//, '');
  if (!q) return null;
  const byKey = BLOCK_TYPE_MENU.find(m => m.menuKey === q);
  if (byKey) return byKey;
  const type = resolveSlashCommand(q);
  if (!type) return null;
  return BLOCK_TYPE_MENU.find(m => m.type === type && !m.menuKey)
    ?? BLOCK_TYPE_MENU.find(m => m.type === type)
    ?? null;
}

export const BLOCK_TYPE_MENU: BlockTypeMeta[] = [
  // Text
  { type: 'paragraph',  label: '텍스트',      desc: '일반 문단',               icon: '¶',  keywords: ['text', 'paragraph', '텍스트', '문단'],                    group: 'text' },
  { type: 'heading1',   label: '제목 1',      desc: '큰 제목',                 icon: 'H1', keywords: ['h1', 'heading', '제목'],                                 group: 'text' },
  { type: 'heading2',   label: '제목 2',      desc: '중간 제목',               icon: 'H2', keywords: ['h2', 'heading', '제목'],                                 group: 'text' },
  { type: 'heading3',   label: '제목 3',      desc: '작은 제목',               icon: 'H3', keywords: ['h3', 'heading', '제목'],                                 group: 'text' },
  { type: 'heading4',   label: '제목 4',      desc: '세부 제목',               icon: 'H4', keywords: ['h4', 'heading', '제목'],                                 group: 'text' },
  { type: 'quote',      label: '인용',        desc: '인용 블록',               icon: '"',  keywords: ['quote', 'blockquote', '인용'],                           group: 'text' },
  { type: 'callout',    label: '콜아웃',      desc: '팁 강조',                 icon: '💡', keywords: ['callout', '콜아웃'], menuKey: 'callout', createDefaults: { calloutIcon: '💡' }, group: 'text' },
  ...CALLOUT_PRESETS.map(p => ({
    type: 'callout' as const,
    menuKey: p.id,
    label: p.label,
    desc: p.desc,
    icon: p.icon,
    keywords: p.keywords,
    createDefaults: { calloutIcon: p.icon },
    group: 'text' as const,
  })),
  { type: 'divider',    label: '구분선',      desc: '수평 구분선',             icon: '—',  keywords: ['divider', 'hr', 'separator', '구분선'],                   group: 'text' },
  // List
  { type: 'bullet',     label: '불릿 목록',   desc: '점 목록',                 icon: '•',  keywords: ['bullet', 'list', '목록', '불릿'],                         group: 'list' },
  { type: 'numbered',   label: '번호 목록',   desc: '순서 있는 목록',          icon: '1.', keywords: ['numbered', 'ordered', '번호', '순서'],                    group: 'list' },
  { type: 'todo',       label: '할 일',       desc: '체크박스',                icon: '☐',  keywords: ['todo', 'task', 'checkbox', '할일', '체크'],               group: 'list' },
  { type: 'toggle',     label: '토글',        desc: '접기/펼치기 블록',        icon: '▶',  keywords: ['toggle', 'collapsible', '토글', '접기'], createDefaults: { collapsed: false }, group: 'list' },
  { type: 'toggleHeading1', menuKey: 'toggle1', label: '토글 제목 1', desc: '접을 수 있는 큰 제목', icon: 'H1▼', keywords: ['toggle1', 'th1', '토글제목1'], createDefaults: { collapsed: false }, group: 'list' },
  { type: 'toggleHeading2', menuKey: 'toggle2', label: '토글 제목 2', desc: '접을 수 있는 중간 제목', icon: 'H2▼', keywords: ['toggle2', 'th2', '토글제목2'], createDefaults: { collapsed: false }, group: 'list' },
  { type: 'toggleHeading3', menuKey: 'toggle3', label: '토글 제목 3', desc: '접을 수 있는 작은 제목', icon: 'H3▼', keywords: ['toggle3', 'th3', '토글제목3'], createDefaults: { collapsed: false }, group: 'list' },
  { type: 'toggleHeading4', menuKey: 'toggle4', label: '토글 제목 4', desc: '접을 수 있는 세부 제목', icon: 'H4▼', keywords: ['toggle4', 'th4', '토글제목4'], createDefaults: { collapsed: false }, group: 'list' },
  // Media
  { type: 'image',      label: '이미지',      desc: '이미지 삽입',             icon: '🖼',  keywords: ['image', 'img', 'photo', '이미지', '사진'],                 group: 'media' },
  { type: 'code',       label: '코드',        desc: '코드 블록',               icon: '</>', keywords: ['code', 'snippet', '코드'],                               group: 'media' },
  { type: 'math',       label: '수식',        desc: 'LaTeX 수식',             icon: '∑',  keywords: ['math', 'latex', 'equation', '수식'],                     group: 'media' },
  { type: 'mermaid',    label: '다이어그램',  desc: 'Mermaid 차트',           icon: '◇',  keywords: ['mermaid', 'diagram', 'flowchart', '다이어그램'], menuKey: 'mermaid', group: 'media' },
  { type: 'audio',      label: '오디오',      desc: '오디오 URL',             icon: '🔊', keywords: ['audio', 'sound', '오디오', '듣기'], menuKey: 'audio', group: 'media' },
  { type: 'citation',   label: '인용',        desc: '출처 인용 블록',         icon: '📚', keywords: ['citation', 'cite', 'reference', '인용', '출처'], menuKey: 'citation', group: 'text' },
  { type: 'question',   label: '질문',        desc: '복습 질문 블록',         icon: '?',  keywords: ['question', 'quiz', 'q', '질문', '복습'], menuKey: 'question', group: 'text' },
  { type: 'answer',     label: '답',          desc: '답 공개 블록',           icon: 'A',  keywords: ['answer', 'reveal', '답', '정답'], menuKey: 'answer', createDefaults: { answerRevealed: false }, group: 'text' },
  { type: 'footnote',   label: '각주',        desc: '각주 정의',              icon: '†',  keywords: ['footnote', 'fn', '각주', '참고'], menuKey: 'footnote', createDefaults: { footnoteId: '1' }, group: 'text' },
  { type: 'table',      label: '표',          desc: '테이블',                  icon: '⊞',  keywords: ['table', 'grid', '표', '테이블'],                          group: 'media' },
];

/** 슬래시 메뉴 상단 고정 (쿼리 없을 때 우선 표시) */
export const SLASH_PINNED_TYPES: BlockType[] = [
  'paragraph', 'heading1', 'heading2', 'heading3', 'heading4',
  'todo', 'toggle', 'bullet', 'numbered', 'code',
];

/** 블록 hover ⋮⋮ → Turn Into 빠른 변환 */
export const TURN_INTO_TYPES: BlockType[] = [
  'paragraph', 'heading1', 'heading2', 'heading3', 'heading4',
  'todo', 'toggle', 'toggleHeading1', 'toggleHeading2', 'toggleHeading3', 'toggleHeading4',
  'bullet', 'numbered', 'callout', 'code',
];

const SLASH_ALIASES: Record<string, string[]> = {
  heading: ['heading1', 'heading2', 'heading3', 'heading4'],
  h:       ['heading1', 'heading2', 'heading3', 'heading4'],
  title:   ['heading1', 'heading2', 'heading3', 'heading4'],
  list:    ['bullet', 'numbered', 'todo'],
  task:    ['todo'],
  checkbox:['todo'],
  collapse:['toggle'],
  fold:    ['toggle'],
  note:    ['callout'],
  info:    ['callout'],
  snippet: ['code'],
};

/** 슬래시 커맨드 쿼리 필터링 — 영문 alias + pinned 순서 */
export function filterBlockMenu(query: string): BlockTypeMeta[] {
  const q = query.toLowerCase().trim();
  if (!q) {
    const pinned = SLASH_PINNED_TYPES
      .map(t => BLOCK_TYPE_MENU.find(m => m.type === t))
      .filter((m): m is BlockTypeMeta => m != null);
    const rest = BLOCK_TYPE_MENU.filter(m => !SLASH_PINNED_TYPES.includes(m.type));
    return [...pinned, ...rest];
  }

  const exactMeta = resolveSlashMenuMeta(q);
  if (exactMeta) return [exactMeta];

  const aliasTypes = SLASH_ALIASES[q] ?? [];
  const slashKeys = slashCommandKeysMatching(q);
  const slashTypes = slashKeys.map(k => resolveSlashCommand(k)).filter((t): t is BlockType => t != null);

  const matched = BLOCK_TYPE_MENU.filter(m =>
    m.type.includes(q) ||
    m.label.toLowerCase().includes(q) ||
    m.desc.toLowerCase().includes(q) ||
    m.keywords.some(k => k.startsWith(q) || k.includes(q) || q.includes(k)) ||
    aliasTypes.includes(m.type) ||
    slashTypes.includes(m.type) ||
    (q === 'heading' && m.type.startsWith('heading')) ||
    (q.startsWith('h') && /^h[123]?$/.test(q) && m.type.startsWith('heading'))
  );

  // prefix queries like "to" → Todo, Toggle
  if (matched.length === 0 && q.length >= 2) {
    return BLOCK_TYPE_MENU.filter(m =>
      m.keywords.some(k => k.startsWith(q)) ||
      slashTypes.includes(m.type),
    );
  }
  return matched;
}

// ── 인라인 마크다운 파서 (렌더링용) ──────────────────────────────────
/**
 * 블록의 content 문자열을 InlineSpan[]으로 파싱
 * contentEditable 렌더러가 각 스팬을 독립 <span>으로 마운트
 */
export function parseInline(text: string): InlineSpan[] {
  if (!text) return [{ text: '' }];

  const spans: InlineSpan[] = [];
  // 간단한 순차 파서 — 중첩 서식은 단일 패스로 처리
  const patterns: [RegExp, Partial<InlineSpan>][] = [
    [/\[\^([^\]]+)\]/,         { footnoteRef: '' }],
    [/\[\[(.+?)\]\]/,          { wikiLink: '' }],
    [/(^|\s)#([\w\uAC00-\uD7A3]+)/, {}],          // tag — 별도 처리
    [/\*\*\*(.+?)\*\*\*/,      { bold: true, italic: true }],
    [/\*\*(.+?)\*\*/,          { bold: true }],
    [/\*(.+?)\*/,              { italic: true }],
    [/~~(.+?)~~/,              { strike: true }],
    [/==(.+?)==/,              { mark: true }],
    [/`([^`]+)`/,              { code: true }],
  ];

  let remaining = text;
  while (remaining.length > 0) {
    let earliest: { index: number; match: RegExpExecArray; meta: Partial<InlineSpan> } | null = null;

    for (const [re, meta] of patterns) {
      const m = new RegExp(re.source, re.flags || '').exec(remaining);
      if (m && (earliest === null || m.index < earliest.index)) {
        earliest = { index: m.index, match: m, meta };
      }
    }

    if (!earliest) {
      spans.push({ text: remaining });
      break;
    }

    // 매치 이전 평범한 텍스트
    if (earliest.index > 0) {
      spans.push({ text: remaining.slice(0, earliest.index) });
    }

    const m = earliest.match;
    const src = earliest.meta;

    // 각주 참조
    if (/\[\^/.test(m[0])) {
      spans.push({ text: m[0], footnoteRef: m[1] });
    }
    // 위키링크
    else if (/\[\[/.test(m[0])) {
      spans.push({ text: `[[${m[1]}]]`, wikiLink: m[1] });
    }
    // 해시태그
    else if (/(^|\s)#/.test(m[0])) {
      if (m.index > 0 || /\s/.test(m[0][0])) spans.push({ text: m[1] }); // leading space
      spans.push({ text: `#${m[2]}`, tag: m[2] });
    }
    else {
      const inner = m[1] ?? m[0];
      spans.push({ text: inner, ...src });
    }

    remaining = remaining.slice(earliest.index + m[0].length);
  }

  return spans.length > 0 ? spans : [{ text: '' }];
}

// ── 블록 타입 변환 헬퍼 ──────────────────────────────────────────────

/**
 * 블록의 type만 변환하고 content는 유지
 * heading → paragraph 등 안전한 타입 전환
 */
export function convertBlock(block: Block, newType: BlockType): Block {
  const base: Block = { ...block, type: newType };
  // 타입별 기본값 초기화
  if (newType === 'code' && !base.code)     base.code = base.content;
  if (newType === 'math' && !base.math)     base.math = base.content;
  if (newType === 'todo')                   base.checked = base.checked ?? false;
  if (isToggleBlockType(newType))             base.collapsed = base.collapsed ?? false;
  if (newType === 'callout' && !base.calloutIcon) base.calloutIcon = DEFAULT_CALLOUT_ICON;
  if (newType === 'footnote' && !base.footnoteId) base.footnoteId = '1';
  if (newType === 'mermaid' && !base.mermaid) base.mermaid = base.content;
  if (newType === 'audio') {
    base.src = base.src ?? '';
    base.content = '';
  }
  if (newType === 'citation') {
    base.citationTitle = base.citationTitle ?? '';
    base.citationAuthor = base.citationAuthor ?? '';
    base.citationYear = base.citationYear ?? '';
    base.content = '';
  }
  if (newType === 'question') {
    base.content = base.content ?? '';
  }
  if (newType === 'answer') {
    base.answerRevealed = base.answerRevealed ?? false;
  }
  if (newType === 'image') {
    base.src = base.src ?? '';
    base.alt = base.alt ?? '';
    base.content = '';
  }
  return base;
}
