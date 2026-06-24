import { memo } from 'react';
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
  void rowHeight;
  void threshold;

  if (items.length === 0) {
    return empty ? <>{empty}</> : null;
  }

  return (
    <div className="space-y-1" data-k107-health-virtual-list={dataHook}>
      {items.map((item, i) => (
        <div key={getKey(item, i)} className={`flex items-center px-2 rounded-lg ${theme.input}`}>
          {renderRow(item, i)}
        </div>
      ))}
    </div>
  );
}

export const HealthVirtualList = memo(HealthVirtualListInner) as typeof HealthVirtualListInner;
