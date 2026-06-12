/**
 * editorTypes.ts — Shared block editor types (split from BlockEditor)
 */

import type { ReactNode, MutableRefObject } from 'react';
import type { Block, BlockType } from './blockUtils';
import type { FocusCmd } from './features/block-editor/features/selection';

export interface BlockEditorColors {
  bg:         string;
  text:       string;
  textMuted:  string;
  textFaint:  string;
  accent:     string;
  accentBg:   string;
  border:     string;
  card:       string;
  cardHov:    string;
  input:      string;
  inputBdr:   string;
  toolbar:    string;
  danger:     string;
  green:      string;
  codeBg:     string;
  calloutBg:  string;
  toggleBg:   string;
  quoteBdr:   string;
  selection:  string;
  blockFocusBg?: string;
  blockFocusBorder?: string;
  blockSelectedBg?: string;
  blockHoverBg?: string;
  toolbarActiveFg?: string;
  radiusBtn?: number;
  radiusCard?: number;
  radiusModal?: number;
  searchHlBg?: string;
  searchHlColor?: string;
  linkColor?: string;
  fontFamily?: string;
  fontSize?: number;
  documentMaxWidth?: number;
  menuShadow?: string;
  isDark?: boolean;
}

/** Grip / context menu anchor state */
export interface TurnIntoMenuState {
  blockId: string;
  anchorY: number;
  anchorX: number;
}

export interface SlashMenuState {
  blockId: string;
  query: string;
  anchorY: number;
  anchorX: number;
}

export interface WikiMenuState {
  blockId: string;
  query: string;
  anchorY: number;
  anchorX: number;
}

/** Shared render context passed to block-type renderers */
export interface BlockRenderContext {
  toggleOpen: boolean;
  inline: (s: string) => ReactNode;
  onToggleCollapse: () => void;
  onToggleTodo: () => void;
  getBlocks: () => Block[];
  onChange: (b: Block[]) => void;
  searchQuery: string;
  depth: number;
  readOnly: boolean;
  wikiTargets: string[];
  onSelect: (id: string) => void;
  onAddBelow: (id: string) => void;
  onSplitBlock: (id: string, before: string, after: string) => void;
  onMergeWithPrev: (id: string, selfContent: string) => void;
  onContentChange: (id: string, content: string) => void;
  editableRef: MutableRefObject<HTMLElement | null>;
  onSlashOpen: (state: SlashMenuState) => void;
  onSlashClose: () => void;
  onWikiOpen: (state: WikiMenuState) => void;
  onWikiClose: () => void;
  isMenuOpen: boolean;
  onWikiNavigate?: (title: string) => void;
  onToggleAddChild: (toggleBlockId: string) => void;
  onToggleEnter: (toggleBlockId: string, before: string, after: string) => void;
  onTableChange: (blockId: string, headers: string[], rows: string[][]) => void;
  onNavigateBlock: (fromId: string, dir: 'up' | 'down') => void;
  onActiveBlockChange?: (id: string | null) => void;
  onConvertBlock: (id: string, type: BlockType) => void;
  onIndentBlock?: (id: string) => void;
  onOutdentBlock?: (id: string) => void;
  onPasteAt?: (id: string, start: number, end: number, text: string) => void;
  onPasteBlocksAt?: (id: string, start: number, end: number, blocks: Block[]) => void;
  getRootBlocks: () => Block[];
  onRootChange: (b: Block[]) => void;
  searchQueryFor: (blockId: string) => string;
  showPersistentPlaceholder?: (blockId: string) => boolean;
  /** When false, block renders as static selectable text (enables cross-block selection). */
  isActiveBlock?: boolean;
  onActivateBlock?: (blockId: string, offset?: 'start' | 'end' | number) => void;
}
