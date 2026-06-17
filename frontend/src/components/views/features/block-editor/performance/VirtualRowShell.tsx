import React from 'react';
import type { Block } from '../../../blockUtils';

/** Per-row state that affects SingleBlock output (mirrors singleBlockPropsEqual row keys). */
export interface VirtualRowMemoState {
  isSelected: boolean;
  isMenuOpen: boolean;
  controlsVisible: boolean;
  activeBlockId: string | null | undefined;
  headingIndex: number | undefined;
  blockSearchQuery: string;
  showPersistentPlaceholder: boolean;
  readOnly: boolean;
  searchQuery: string;
}

export interface VirtualRowShellProps {
  block: Block;
  memoState: VirtualRowMemoState;
  renderBlock: (block: Block) => React.ReactNode;
}

function virtualRowMemoStateEqual(
  prev: VirtualRowMemoState,
  next: VirtualRowMemoState,
): boolean {
  return prev.isSelected === next.isSelected
    && prev.isMenuOpen === next.isMenuOpen
    && prev.controlsVisible === next.controlsVisible
    && prev.activeBlockId === next.activeBlockId
    && prev.headingIndex === next.headingIndex
    && prev.blockSearchQuery === next.blockSearchQuery
    && prev.showPersistentPlaceholder === next.showPersistentPlaceholder
    && prev.readOnly === next.readOnly
    && prev.searchQuery === next.searchQuery;
}

function virtualRowShellPropsEqual(
  prev: VirtualRowShellProps,
  next: VirtualRowShellProps,
): boolean {
  return prev.block === next.block
    && prev.renderBlock === next.renderBlock
    && virtualRowMemoStateEqual(prev.memoState, next.memoState);
}

/**
 * Memo boundary between VirtualBlockList scroll commits and renderBlock JSX construction.
 * Skips renderBlock when row-visible state is unchanged (e.g. scroll reposition only).
 */
let renderBlockInvocationHook: ((blockId: string) => void) | undefined;

/** Test/dev hook — counts renderBlock invocations that pass the row memo boundary. */
export function setVirtualRowShellRenderHook(
  hook: ((blockId: string) => void) | undefined,
): void {
  renderBlockInvocationHook = hook;
}

export const VirtualRowShell = React.memo(function VirtualRowShell({
  block,
  memoState,
  renderBlock,
}: VirtualRowShellProps) {
  renderBlockInvocationHook?.(block.id);
  return renderBlock(block);
}, virtualRowShellPropsEqual);
