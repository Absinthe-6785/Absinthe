import { memo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Theme } from '../../../../types';

const ROW_HEIGHT = 40;

export interface HealthVirtualListProps<T> {
  items: readonly T[];
  rowHeight?: number;
  threshold?: number;
  theme: Theme;
  renderRow: (item: T, index: number) => React.ReactNode;
  getKey: (item: T, index: number) => string;
  dataHook?: string;
  empty?: React.ReactNode;
}

function HealthVirtualListInner<T>({
  items,
  rowHeight = ROW_HEIGHT,
  threshold = 24,
  theme,
  renderRow,
  getKey,
  dataHook,
  empty,
}: HealthVirtualListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);
  const useVirtual = items.length >= threshold;

  const virtualizer = useVirtualizer({
    count: useVirtual ? items.length : 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 6,
  });

  if (items.length === 0) {
    return empty ? <>{empty}</> : null;
  }

  if (!useVirtual) {
    return (
      <div className="space-y-1" data-k107-health-virtual-list={dataHook}>
        {items.map((item, i) => (
          <div key={getKey(item, i)}>{renderRow(item, i)}</div>
        ))}
      </div>
    );
  }

  return (
    <div ref={parentRef} className="overflow-y-auto max-h-48" data-k107-health-virtual-list={dataHook}>
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map(vi => {
          const item = items[vi.index];
          if (!item) return null;
          return (
            <div
              key={getKey(item, vi.index)}
              style={{ position: 'absolute', top: vi.start, left: 0, width: '100%', height: rowHeight }}
              className={`flex items-center px-2 rounded-lg ${theme.input}`}
            >
              {renderRow(item, vi.index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const HealthVirtualList = memo(HealthVirtualListInner) as typeof HealthVirtualListInner;
