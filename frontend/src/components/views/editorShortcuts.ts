export interface ShortcutEntry {
  keys: string;
  label: string;
}

export interface ShortcutSection {
  id: string;
  title: string;
  items: ShortcutEntry[];
}

export const EDITOR_SHORTCUT_SECTIONS: ShortcutSection[] = [
  {
    id: 'format',
    title: '서식',
    items: [
      { keys: 'Ctrl+B', label: '굵게' },
      { keys: 'Ctrl+I', label: '기울임' },
      { keys: 'Ctrl+Shift+S', label: '취소선' },
      { keys: 'Ctrl+Shift+M', label: '강조' },
      { keys: 'Ctrl+`', label: '인라인 코드' },
      { keys: 'Ctrl+Shift+K', label: '위키 링크' },
      { keys: 'Ctrl+Shift+H', label: '태그' },
    ],
  },
  {
    id: 'headings',
    title: '제목 · 블록',
    items: [
      { keys: 'Ctrl+Shift+0', label: '본문' },
      { keys: 'Ctrl+Shift+1–4', label: '제목 1–4 / 토글 제목' },
      { keys: 'Ctrl+Shift+7', label: '할 일' },
      { keys: 'Ctrl+Shift+8', label: '토글' },
      { keys: 'Ctrl+Shift+9', label: '콜아웃' },
      { keys: 'Ctrl+Shift+C', label: '코드 블록' },
      { keys: '/', label: '슬래시 명령' },
    ],
  },
  {
    id: 'navigation',
    title: '탐색 · 편집',
    items: [
      { keys: 'Ctrl+F', label: '노트 검색' },
      { keys: 'Ctrl+Shift+F', label: '집중 모드' },
      { keys: 'Ctrl+S', label: '저장' },
      { keys: 'Ctrl+Z / Ctrl+Y', label: '실행 취소 / 다시 실행' },
      { keys: 'Ctrl+E', label: '읽기 모드' },
      { keys: 'Tab / Shift+Tab', label: '들여쓰기 / 내어쓰기' },
      { keys: 'Esc', label: '블록 선택 해제' },
    ],
  },
  {
    id: 'help',
    title: '도움말',
    items: [
      { keys: '?', label: '단축키 목록' },
      { keys: 'Ctrl+/', label: '단축키 목록' },
    ],
  },
];
