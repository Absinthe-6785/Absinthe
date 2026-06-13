import type { BlockType } from './blockUtils';

/** Per-block-type placeholder copy — single source of truth */
export const BLOCK_PLACEHOLDERS: Partial<Record<BlockType, string>> = {
  paragraph: "입력하거나 '/' 로 명령 · 붙여넣기 · ⋮⋮ 드래그로 이동…",
  heading1:  '제목 1',
  heading2:  '제목 2',
  heading3:  '제목 3',
  heading4:  '제목 4',
  bullet:    '목록 항목',
  numbered:  '번호 항목',
  todo:      '할 일',
  toggle:    '토글 제목',
  toggleHeading1: '토글 제목 1',
  toggleHeading2: '토글 제목 2',
  toggleHeading3: '토글 제목 3',
  toggleHeading4: '토글 제목 4',
  quote:     '인용',
  callout:   '콜아웃',
  math:      'LaTeX 수식',
  footnote:  '각주 내용',
  mermaid:   'flowchart TD\\n  A --> B',
  audio:     '오디오 URL',
  citation:  'Title | Author | Year',
  question:  'Q: What caused the Meiji Restoration?',
  answer:    'Answer text',
};

export function blockPlaceholder(type: BlockType): string {
  return BLOCK_PLACEHOLDERS[type] ?? "입력하거나 '/' 로 명령…";
}
