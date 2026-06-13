import type { Language } from '../../../../lib/i18n';
import type { BlockType } from '../../blockUtils';

type BlockLabelKey = BlockType | `${BlockType}:${string}`;

const LABELS: Record<BlockLabelKey, Record<Language, { label: string; desc: string }>> = {
  paragraph: {
    en: { label: 'Text', desc: 'Plain paragraph' },
    ko: { label: '텍스트', desc: '일반 문단' },
    ja: { label: 'テキスト', desc: '通常段落' },
  },
  heading1: {
    en: { label: 'Heading 1', desc: 'Large heading' },
    ko: { label: '제목 1', desc: '큰 제목' },
    ja: { label: '見出し 1', desc: '大見出し' },
  },
  heading2: {
    en: { label: 'Heading 2', desc: 'Medium heading' },
    ko: { label: '제목 2', desc: '중간 제목' },
    ja: { label: '見出し 2', desc: '中見出し' },
  },
  heading3: {
    en: { label: 'Heading 3', desc: 'Small heading' },
    ko: { label: '제목 3', desc: '작은 제목' },
    ja: { label: '見出し 3', desc: '小見出し' },
  },
  heading4: {
    en: { label: 'Heading 4', desc: 'Detail heading' },
    ko: { label: '제목 4', desc: '세부 제목' },
    ja: { label: '見出し 4', desc: '詳細見出し' },
  },
  quote: {
    en: { label: 'Quote', desc: 'Quote block' },
    ko: { label: '인용', desc: '인용 블록' },
    ja: { label: '引用', desc: '引用ブロック' },
  },
  callout: {
    en: { label: 'Callout', desc: 'Highlighted tip' },
    ko: { label: '콜아웃', desc: '팁 강조' },
    ja: { label: 'コールアウト', desc: 'ヒント強調' },
  },
  divider: {
    en: { label: 'Divider', desc: 'Horizontal rule' },
    ko: { label: '구분선', desc: '수평 구분선' },
    ja: { label: '区切り', desc: '水平線' },
  },
  bullet: {
    en: { label: 'Bullet list', desc: 'Bulleted list' },
    ko: { label: '불릿 목록', desc: '점 목록' },
    ja: { label: '箇条書き', desc: '箇点リスト' },
  },
  numbered: {
    en: { label: 'Numbered list', desc: 'Ordered list' },
    ko: { label: '번호 목록', desc: '순서 있는 목록' },
    ja: { label: '番号リスト', desc: '順序付きリスト' },
  },
  todo: {
    en: { label: 'To-do', desc: 'Checkbox item' },
    ko: { label: '할 일', desc: '체크박스' },
    ja: { label: 'ToDo', desc: 'チェックボックス' },
  },
  toggle: {
    en: { label: 'Toggle', desc: 'Collapsible block' },
    ko: { label: '토글', desc: '접기/펼치기 블록' },
    ja: { label: 'トグル', desc: '折りたたみブロック' },
  },
  toggleHeading1: {
    en: { label: 'Toggle heading 1', desc: 'Collapsible large heading' },
    ko: { label: '토글 제목 1', desc: '접을 수 있는 큰 제목' },
    ja: { label: 'トグル見出し 1', desc: '折りたたみ大見出し' },
  },
  toggleHeading2: {
    en: { label: 'Toggle heading 2', desc: 'Collapsible medium heading' },
    ko: { label: '토글 제목 2', desc: '접을 수 있는 중간 제목' },
    ja: { label: 'トグル見出し 2', desc: '折りたたみ中見出し' },
  },
  toggleHeading3: {
    en: { label: 'Toggle heading 3', desc: 'Collapsible small heading' },
    ko: { label: '토글 제목 3', desc: '접을 수 있는 작은 제목' },
    ja: { label: 'トグル見出し 3', desc: '折りたたみ小見出し' },
  },
  toggleHeading4: {
    en: { label: 'Toggle heading 4', desc: 'Collapsible detail heading' },
    ko: { label: '토글 제목 4', desc: '접을 수 있는 세부 제목' },
    ja: { label: 'トグル見出し 4', desc: '折りたたみ詳細見出し' },
  },
  image: {
    en: { label: 'Image', desc: 'Insert image' },
    ko: { label: '이미지', desc: '이미지 삽입' },
    ja: { label: '画像', desc: '画像挿入' },
  },
  code: {
    en: { label: 'Code', desc: 'Code block' },
    ko: { label: '코드', desc: '코드 블록' },
    ja: { label: 'コード', desc: 'コードブロック' },
  },
  math: {
    en: { label: 'Math', desc: 'LaTeX equation' },
    ko: { label: '수식', desc: 'LaTeX 수식' },
    ja: { label: '数式', desc: 'LaTeX数式' },
  },
  mermaid: {
    en: { label: 'Diagram', desc: 'Mermaid chart' },
    ko: { label: '다이어그램', desc: 'Mermaid 차트' },
    ja: { label: 'ダイアグラム', desc: 'Mermaidチャート' },
  },
  audio: {
    en: { label: 'Audio', desc: 'Audio URL' },
    ko: { label: '오디오', desc: '오디오 URL' },
    ja: { label: 'オーディオ', desc: 'オーディオURL' },
  },
  citation: {
    en: { label: 'Citation', desc: 'Source citation block' },
    ko: { label: '인용', desc: '출처 인용 블록' },
    ja: { label: '引用', desc: '出典引用ブロック' },
  },
  question: {
    en: { label: 'Question', desc: 'Review question block' },
    ko: { label: '질문', desc: '복습 질문 블록' },
    ja: { label: '質問', desc: '復習質問ブロック' },
  },
  answer: {
    en: { label: 'Answer', desc: 'Reveal answer block' },
    ko: { label: '답', desc: '답 공개 블록' },
    ja: { label: '答', desc: '答え公開ブロック' },
  },
  footnote: {
    en: { label: 'Footnote', desc: 'Footnote definition' },
    ko: { label: '각주', desc: '각주 정의' },
    ja: { label: '脚注', desc: '脚注定義' },
  },
  table: {
    en: { label: 'Table', desc: 'Table grid' },
    ko: { label: '표', desc: '테이블' },
    ja: { label: '表', desc: 'テーブル' },
  },
};

export function blockTypeLabel(type: BlockType, lang: Language, menuKey?: string): string {
  const key = menuKey ? `${type}:${menuKey}` as BlockLabelKey : type;
  return LABELS[key]?.[lang]?.label ?? LABELS[type]?.[lang]?.label ?? type;
}

export function blockTypeDesc(type: BlockType, lang: Language, menuKey?: string): string {
  const key = menuKey ? `${type}:${menuKey}` as BlockLabelKey : type;
  return LABELS[key]?.[lang]?.desc ?? LABELS[type]?.[lang]?.desc ?? '';
}

export function slashDisplayLabel(type: BlockType, lang: Language): string {
  return blockTypeLabel(type, lang);
}
