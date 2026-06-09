import type React from 'react';
import type { Block } from '../../../blockUtils';
import type { BlockEditorColors } from '../../../editorTypes';
import type { EditorSearchScope } from '../../../editorSearch';

export interface BlockEditorProps {
  blocks:       Block[];
  onChange:     (blocks: Block[]) => void;
  colors:       BlockEditorColors;
  readOnly?:    boolean;
  searchQuery?: string;
  searchScope?: EditorSearchScope;
  searchMatchIndex?: number;
  /** 위키링크 [[ 자동완성 후보 (노트 제목 목록) */
  wikiTargets?: string[];
  /** edit 모드 Ctrl/Cmd+클릭으로 [[제목]] 따라가기 */
  onWikiNavigate?: (title: string) => void;
  /** 포커스된 블록 id — 이미지 삽입 위치 등 */
  onActiveBlockChange?: (id: string | null) => void;
  /** 외부에서 특정 블록으로 포커스 이동 요청 */
  externalFocusId?: string | null;
  onExternalFocusConsumed?: () => void;
}

export interface BlockEditorInnerProps {
  blocks: Block[]; onChange: (b: Block[]) => void;
  colors: BlockEditorColors; readOnly: boolean;
  searchQuery: string; depth: number;
  wikiTargets: string[];
  onWikiNavigate?: (title: string) => void;
  onActiveBlockChange?: (id: string | null) => void;
  externalFocusId?: string | null;
  onExternalFocusConsumed?: () => void;
  // Toggle Step 3: 자식 → 부모 탈출 콜백
  onEscapeToParentBelow?:  () => void;  // 마지막 빈 자식 Enter → toggle 아래 새 블록
  onEscapeToParentHeader?: () => void;  // 빈 첫 자식 Backspace → toggle 헤더로 포커스
  onMergeFirstChildIntoHeader?: (childId: string, childContent: string) => void;
  getRootBlocks?: () => Block[];
  onRootChange?: (b: Block[]) => void;
  searchScope?: EditorSearchScope;
  searchMatchIndex?: number;
  documentFocusApiRef?: DocumentFocusApiRef;
}

export type DocumentFocusApiRef = React.MutableRefObject<{
  handlePointerDown: (e: React.PointerEvent) => void;
} | null>;
