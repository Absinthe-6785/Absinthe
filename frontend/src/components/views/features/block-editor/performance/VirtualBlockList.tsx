import React from 'react';
import type { Block } from '../../../blockUtils';
import type { UseVirtualBlockListResult } from './useVirtualBlockList';

export interface VirtualBlockListProps {
  blocks: Block[];
  virtualList: UseVirtualBlockListResult;
  children: (block: Block, index: number) => React.ReactNode;
}

/**
 * Root-level virtual block list (UX-5E.1B POC).
 * Renders only viewport-visible SingleBlock rows.
 */
export function VirtualBlockList({ blocks, virtualList, children }: VirtualBlockListProps) {
  const { virtualizer, enabled } = virtualList;
  if (!enabled) return null;

  const items = virtualizer.getVirtualItems();

  return (
    <div
      className="be-virtual-block-list"
      data-virtual-count={blocks.length}
      data-virtual-visible={items.length}
      style={{
        height: virtualizer.getTotalSize(),
        width: '100%',
        position: 'relative',
      }}
    >
      {items.map(virtualRow => {
        const block = blocks[virtualRow.index];
        if (!block) return null;
        return (
          <div
            key={block.id}
            data-index={virtualRow.index}
            data-block-id={block.id}
            ref={virtualizer.measureElement}
            className="be-virtual-block-row"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            {children(block, virtualRow.index)}
          </div>
        );
      })}
    </div>
  );
}
