import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { Language } from '../../../../../lib/i18n';
import type { SearchProjection, SearchResultItem } from '../searchProjectionModels';
import { SearchResultCard } from './SearchResultCard';

export const SEARCH_VIRTUALIZE_THRESHOLD = 50;

export interface SearchVirtualListProps {
  results: readonly SearchResultItem[];
  projection: SearchProjection;
  colors: NoteChromeColors;
  lang: Language;
  activeIndex: number;
  setActiveIndex: (index: number) => void;
  onSelect: (result: SearchResultItem) => void;
  rowIndexOffset?: number;
}

export function SearchVirtualList({
  results,
  projection,
  colors,
  lang,
  activeIndex,
  setActiveIndex,
  onSelect,
  rowIndexOffset = 0,
}: SearchVirtualListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const useVirtual = results.length >= SEARCH_VIRTUALIZE_THRESHOLD;

  const virtualizer = useVirtualizer({
    count: results.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 52,
    overscan: 8,
    enabled: useVirtual,
  });

  const renderRow = (result: SearchResultItem, idx: number) => (
    <SearchResultCard
      key={result.id}
      result={result}
      active={idx + rowIndexOffset === activeIndex}
      colors={colors}
      highlight={projection.highlights.get(result.id)}
      lang={lang}
      optionId={`k111-search-opt-${idx + rowIndexOffset}`}
      onSelect={() => onSelect(result)}
      onHover={() => setActiveIndex(idx + rowIndexOffset)}
    />
  );

  if (!useVirtual) {
    return (
      <div data-k111-search-list>
        {results.map((r, i) => renderRow(r, i))}
      </div>
    );
  }

  return (
    <div ref={parentRef} data-k111-search-virtual-list style={{ maxHeight: 360, overflowY: 'auto' }}>
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map(vRow => {
          const result = results[vRow.index]!;
          return (
            <div
              key={result.id}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${vRow.start}px)`,
              }}
            >
              {renderRow(result, vRow.index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
