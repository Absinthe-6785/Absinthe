import React, { useContext } from 'react';
import type { Block } from '../../../blockUtils';

/** SingleBlock 리렌더 최소화 — blocks 배열 참조 대신 ref로 최신 상태 접근 */
export interface BlocksCtxValue {
  getBlocks: () => Block[];
  onChange: (b: Block[]) => void;
}
export const BlocksCtx = React.createContext<BlocksCtxValue | null>(null);

export function useBlocksCtx(): BlocksCtxValue {
  const ctx = useContext(BlocksCtx);
  if (!ctx) throw new Error('useBlocksCtx must be used within BlocksCtx');
  return ctx;
}
