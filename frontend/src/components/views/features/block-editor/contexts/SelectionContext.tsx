import React from 'react';

export interface SelectionCtxValue {
  selectedBlockIds: Set<string>;
  onBlockSelect: (id: string, e: React.MouseEvent) => void;
}
export const SelectionCtx = React.createContext<SelectionCtxValue | null>(null);
