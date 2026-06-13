import type { BlockType } from '../../../../../blockUtils';

/** Exact slash shortcuts — `/h1`, `/todo`, `/number`, etc. */
export const SLASH_COMMAND_MAP: Record<string, BlockType> = {
  text: 'paragraph',
  p: 'paragraph',
  paragraph: 'paragraph',
  h1: 'heading1',
  h2: 'heading2',
  h3: 'heading3',
  h4: 'heading4',
  heading1: 'heading1',
  heading2: 'heading2',
  heading3: 'heading3',
  heading4: 'heading4',
  todo: 'todo',
  task: 'todo',
  toggle: 'toggle',
  toggle1: 'toggleHeading1',
  toggle2: 'toggleHeading2',
  toggle3: 'toggleHeading3',
  toggle4: 'toggleHeading4',
  th1: 'toggleHeading1',
  th2: 'toggleHeading2',
  th3: 'toggleHeading3',
  th4: 'toggleHeading4',
  bullet: 'bullet',
  ul: 'bullet',
  number: 'numbered',
  numbered: 'numbered',
  ol: 'numbered',
  code: 'code',
  math: 'math',
  mermaid: 'mermaid',
  audio: 'audio',
  footnote: 'footnote',
  fn: 'footnote',
  citation: 'citation',
  cite: 'citation',
  question: 'question',
  q: 'question',
  answer: 'answer',
  a: 'answer',
  quote: 'quote',
  divider: 'divider',
  hr: 'divider',
  image: 'image',
  img: 'image',
  callout: 'callout',
  table: 'table',
};

/** Display label for slash menu — Korean, aligned with BLOCK_TYPE_MENU */
export const SLASH_DISPLAY_LABELS: Partial<Record<BlockType, string>> = {
  paragraph: '텍스트',
  heading1: '제목 1',
  heading2: '제목 2',
  heading3: '제목 3',
  heading4: '제목 4',
  todo: '할 일',
  toggle: '토글',
  toggleHeading1: '토글 제목 1',
  toggleHeading2: '토글 제목 2',
  toggleHeading3: '토글 제목 3',
  toggleHeading4: '토글 제목 4',
  bullet: '불릿 목록',
  numbered: '번호 목록',
  code: '코드',
  math: '수식',
  mermaid: '다이어그램',
  audio: '오디오',
  footnote: '각주',
  citation: '출처 인용',
  question: '질문',
  answer: '답',
  quote: '인용',
  divider: '구분선',
  image: '이미지',
  callout: '콜아웃',
  table: '표',
};

export function slashDisplayLabel(type: BlockType): string {
  return SLASH_DISPLAY_LABELS[type] ?? type;
}

export function slashShortcutFor(type: BlockType): string | undefined {
  const entry = Object.entries(SLASH_COMMAND_MAP).find(([, t]) => t === type);
  return entry?.[0];
}

/** Resolve an exact slash query to a block type, or null. */
export function resolveSlashCommand(query: string): BlockType | null {
  const q = query.toLowerCase().trim().replace(/^\//, '');
  if (!q) return null;
  return SLASH_COMMAND_MAP[q] ?? null;
}

/** Prefix search for slash palette — returns matching command keys. */
export function slashCommandKeysMatching(prefix: string): string[] {
  const q = prefix.toLowerCase().trim().replace(/^\//, '');
  if (!q) return Object.keys(SLASH_COMMAND_MAP);
  return Object.keys(SLASH_COMMAND_MAP).filter(k => k.startsWith(q) || k.includes(q));
}
