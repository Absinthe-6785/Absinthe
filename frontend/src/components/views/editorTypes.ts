/**
 * editorTypes.ts — Shared block editor types (split from BlockEditor)
 */

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
