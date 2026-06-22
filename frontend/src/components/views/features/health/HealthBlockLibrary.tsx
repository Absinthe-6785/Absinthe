import { memo, useMemo, useRef } from 'react';
import { Plus, Dumbbell } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { ExerciseBlock, Theme } from '../../../../types';
import { ProductEmptyState } from '../../../common/ProductEmptyState';
import { WORKSPACE_CARD } from '../../../common/workspaceCardSizes';
import { useTranslation } from '../../../../lib/i18n';
import { WorkoutBlockCard } from './WorkoutBlockCard';

const VIRTUALIZE_THRESHOLD = 48;
const ROW_HEIGHT = 36;

export interface HealthBlockLibraryProps {
  blocks: ExerciseBlock[];
  activeTagFilter: string | null;
  setActiveTagFilter: (tag: string | null) => void;
  theme: Theme;
  darkMode: boolean;
  onAddToToday: (block: ExerciseBlock) => void | Promise<void>;
  onEditBlock: (block: ExerciseBlock) => void;
  onDeleteBlock: (id: string, e: React.MouseEvent) => void;
  onNewBlock: () => void;
  mobileVisible: boolean;
}

interface FlatBlockRow {
  kind: 'header' | 'block';
  tag?: string;
  block?: ExerciseBlock;
  key: string;
}

function buildFlatRows(
  blocks: ExerciseBlock[],
  activeTagFilter: string | null,
  otherLabel: string,
): FlatBlockRow[] {
  const allTags = Array.from(new Set(blocks.flatMap(b => b.tags ?? [])));
  const rows: FlatBlockRow[] = [];
  for (const tag of allTags) {
    if (activeTagFilter && tag !== activeTagFilter) continue;
    const items = blocks.filter(b => (b.tags ?? []).includes(tag));
    if (items.length === 0) continue;
    rows.push({ kind: 'header', tag, key: `h-${tag}` });
    for (const block of items) {
      rows.push({ kind: 'block', block, key: block.id });
    }
  }
  if (!activeTagFilter) {
    const untagged = blocks.filter(b => (b.tags ?? []).length === 0);
    if (untagged.length > 0 && allTags.length > 0) {
      rows.push({ kind: 'header', tag: otherLabel, key: 'h-other' });
    }
    for (const block of untagged) {
      rows.push({ kind: 'block', block, key: block.id });
    }
  }
  return rows;
}

export const HealthBlockLibrary = memo(function HealthBlockLibrary({
  blocks,
  activeTagFilter,
  setActiveTagFilter,
  theme,
  darkMode,
  onAddToToday,
  onEditBlock,
  onDeleteBlock,
  onNewBlock,
  mobileVisible,
}: HealthBlockLibraryProps) {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);

  const allTags = useMemo(
    () => Array.from(new Set(blocks.flatMap(b => b.tags ?? []))),
    [blocks],
  );

  const flatRows = useMemo(
    () => buildFlatRows(blocks, activeTagFilter, t('other')),
    [blocks, activeTagFilter, t],
  );

  const useVirtual = blocks.length >= VIRTUALIZE_THRESHOLD;
  const virtualizer = useVirtualizer({
    count: useVirtual ? flatRows.length : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: i => (flatRows[i]?.kind === 'header' ? 28 : ROW_HEIGHT),
    overscan: 8,
  });

  const renderBlock = (block: ExerciseBlock) => (
    <WorkoutBlockCard
      block={block}
      theme={theme}
      onAdd={() => void onAddToToday(block)}
      onEdit={e => { e.stopPropagation(); onEditBlock(block); }}
      onDelete={e => onDeleteBlock(block.id, e)}
    />
  );

  return (
    <div
      className={`${WORKSPACE_CARD.md} lg:max-h-[320px] min-h-0 rounded-[24px] lg:rounded-[28px] shadow-sm p-3 lg:p-4 flex flex-col transition-colors ${theme.card} ${mobileVisible ? '' : 'hidden lg:flex'}`}
      data-k107-health-block-library
      data-k126-exercise-library
    >
      <div className="flex justify-between items-center mb-2">
        <h2 className="font-heading text-lg font-bold">{t('workoutLibrary')}</h2>
        <button type="button" onClick={onNewBlock} className="bg-primary text-primary-foreground px-2.5 py-2 rounded-xl shadow-md">
          <Plus size={16} />
        </button>
      </div>

      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTagFilter(null)}
            className={`text-xs font-bold px-2.5 py-1 rounded-lg transition-colors ${activeTagFilter === null ? 'bg-blue-500 text-white' : `${theme.input} ${theme.textMuted}`}`}
          >
            {t('filterAll')}
          </button>
          {allTags.map(tag => (
            <button
              key={tag}
              type="button"
              onClick={() => setActiveTagFilter(activeTagFilter === tag ? null : tag)}
              className={`text-xs font-bold px-2.5 py-1 rounded-lg transition-colors ${activeTagFilter === tag ? 'bg-blue-500 text-white' : `${theme.input} ${theme.textMuted}`}`}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}

      {blocks.length === 0 && (
        <ProductEmptyState
          variant="tailwind"
          theme={theme}
          icon={Dumbbell}
          title={t('noBlocksEmpty')}
          description={t('k99EmptyHealthBlocksDesc')}
          dataHook="health-blocks-empty"
          primaryAction={{ label: t('k99EmptyHealthBlocksAction'), onClick: onNewBlock }}
        />
      )}

      <div ref={scrollRef} className="overflow-y-auto min-h-0 pr-1 pb-1 flex-1">
        {useVirtual ? (
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {virtualizer.getVirtualItems().map(vi => {
              const row = flatRows[vi.index];
              if (!row) return null;
              return (
                <div
                  key={row.key}
                  style={{ position: 'absolute', top: vi.start, left: 0, width: '100%' }}
                >
                  {row.kind === 'header' ? (
                    <div className={`flex items-center gap-1.5 mb-1 mt-1`}>
                      <span className={`text-[11px] font-black tracking-wide ${theme.textMuted}`}>
                        {row.tag === t('other') ? t('other') : `#${row.tag?.toUpperCase()}`}
                      </span>
                      <div className={`flex-1 h-px ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`} />
                    </div>
                  ) : row.block ? (
                    renderBlock(row.block)
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-2">
            {flatRows.map(row => {
              if (row.kind === 'header') {
                return (
                  <div key={row.key} className="flex items-center gap-1.5 mb-1">
                    <span className={`text-[11px] font-black tracking-wide ${theme.textMuted}`}>
                      {row.tag === t('other') ? t('other') : `#${row.tag?.toUpperCase()}`}
                    </span>
                    <div className={`flex-1 h-px ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`} />
                  </div>
                );
              }
              if (!row.block) return null;
              return (
                <div key={row.key} className="flex flex-wrap gap-1.5">
                  {renderBlock(row.block)}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
});
