import React from 'react';

export interface BlockSelectionModifiers {
  shiftKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
}

export interface SelectionCtxValue {
  selectedBlockIds: Set<string>;
  anchorBlockId: string | null;
  onBlockSelect: (id: string, modifiers: BlockSelectionModifiers) => void;
  clearSelection: () => void;
  /** Gutter / range drag — updates multi-block selection at document root. */
  applyGutterRange: (anchorId: string, hoverId: string) => void;
}
export const SelectionCtx = React.createContext<SelectionCtxValue | null>(null);
