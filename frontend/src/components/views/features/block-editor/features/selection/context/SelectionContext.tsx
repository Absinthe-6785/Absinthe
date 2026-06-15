import React from 'react';

export interface SelectionCtxValue {
  selectedBlockIds: Set<string>;
  anchorBlockId: string | null;
  onBlockSelect: (id: string, e: React.MouseEvent) => void;
  /** Gutter / range drag — updates multi-block selection at document root. */
  applyGutterRange: (anchorId: string, hoverId: string) => void;
}
export const SelectionCtx = React.createContext<SelectionCtxValue | null>(null);
