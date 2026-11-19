import { memo, useCallback, useMemo, useState } from 'react';
import { Plus, Dumbbell, Search } from 'lucide-react';
import type { ExerciseBlock, Theme } from '../../../../types';
import { ProductEmptyState } from '../../../common/ProductEmptyState';
import { WORKSPACE_CARD, WORKSPACE_CARD_SURFACE_COMPACT } from '../../../common/workspaceCardSizes';
import { useTranslation } from '../../../../lib/i18n';
import { UI_INTERACTION } from '../../../../lib/uiInteractionTokens';
import { WorkoutBlockCard } from './WorkoutBlockCard';
import {
  buildHealthBlockLibraryGroups,
  createHealthBlockLibrarySearchIndex,
  filterHealthBlockLibrarySearchIndex,
  type CatalogExerciseBlock,
} from './healthBlockLibraryProjection';

export { sortExerciseBlocksForCatalog } from './healthBlockLibraryProjection';
export type { CatalogExerciseBlock } from './healthBlockLibraryProjection';

export interface HealthBlockLibraryProps {
  blocks: CatalogExerciseBlock[];
  activeTagFilter: string | null;
  setActiveTagFilter: (tag: string | null) => void;
  theme: Theme;
  darkMode: boolean;
  onAddToToday: (block: ExerciseBlock) => void | Promise<void>;
  addDisabled?: boolean;
  onEditBlock: (block: ExerciseBlock) => void;
  onDeleteBlock: (id: string, e: React.MouseEvent) => void;
  onNewBlock: () => void;
  mobileVisible: boolean;
}


export const HealthBlockLibrary = memo(function HealthBlockLibrary({
  blocks,
  activeTagFilter,
  setActiveTagFilter,
  theme,
  darkMode,
  onAddToToday,
  addDisabled = false,
  onEditBlock,
  onDeleteBlock,
  onNewBlock,
  mobileVisible,
}: HealthBlockLibraryProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');

  const allTags = useMemo(
    () => Array.from(new Set(blocks.flatMap(b => b.tags ?? []))),
    [blocks],
  );

  const searchIndex = useMemo(() => createHealthBlockLibrarySearchIndex(blocks), [blocks]);

  const rankedBlocks = useMemo(
    () => filterHealthBlockLibrarySearchIndex(searchIndex, query),
    [searchIndex, query],
  );

  const blockGroups = useMemo(
    () => buildHealthBlockLibraryGroups(rankedBlocks, activeTagFilter, t('other')),
    [rankedBlocks, activeTagFilter, t],
  );

  const handleAdd = useCallback((block: ExerciseBlock) => { void onAddToToday(block); }, [onAddToToday]);
  const handleEdit = useCallback((block: ExerciseBlock, event: React.MouseEvent) => {
    event.stopPropagation();
    onEditBlock(block);
  }, [onEditBlock]);
  const handleDelete = useCallback((id: string, event: React.MouseEvent) => onDeleteBlock(id, event), [onDeleteBlock]);

  const renderBlock = (block: ExerciseBlock) => (
    <WorkoutBlockCard
      key={block.id}
      block={block}
      theme={theme}
      onAdd={handleAdd}
      addDisabled={addDisabled}
      onEdit={handleEdit}
      onDelete={handleDelete}
    />
  );

  return (
    <div
      className={`${WORKSPACE_CARD.sm} min-h-0 xl:h-full xl:min-h-0 ${WORKSPACE_CARD_SURFACE_COMPACT} abs-cosmos-health-setup-surface flex flex-col overflow-visible xl:overflow-hidden transition-colors ${mobileVisible ? '' : 'hidden lg:flex'}`}
      data-k107-health-block-library
      data-k126-exercise-library
      data-health-composition-role="setup-library"
    >
      <div className="flex justify-between items-center gap-3 mb-2 shrink-0">
        <h2 className="font-heading text-lg font-bold">{t('workoutLibrary')}</h2>
        <button
          type="button"
          onClick={onNewBlock}
          aria-label={t('newBlockLabel')}
          className={`bg-primary text-primary-foreground px-2.5 py-2 rounded-xl shadow-sm min-h-[36px] min-w-[36px] inline-flex items-center justify-center ${UI_INTERACTION.focusRingClass}`}
          data-health-new-block
        >
          <Plus size={16} aria-hidden />
        </button>
      </div>

      <label className={`mb-2 flex items-center gap-2 rounded-xl px-3 py-2 border ${theme.border} ${theme.input}`} data-k129d-health-block-search>
        <Search size={14} className={theme.textMuted} />
        <input
          type="search"
          aria-label={t('healthExerciseSearchPlaceholder')}
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={t('healthExerciseSearchPlaceholder')}
          className="min-w-0 flex-1 bg-transparent outline-none text-sm font-semibold"
        />
      </label>

      {allTags.length > 0 && (
        <div className="flex flex-wrap items-start gap-1 mb-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTagFilter(null)}
            className={`max-w-full text-xs font-bold px-2.5 py-1 rounded-lg transition-colors ${activeTagFilter === null ? 'bg-blue-500 text-white' : `${theme.input} ${theme.textMuted}`}`}
          >
            {t('filterAll')}
          </button>
          {allTags.map(tag => (
            <button
              key={tag}
              type="button"
              onClick={() => setActiveTagFilter(activeTagFilter === tag ? null : tag)}
              className={`max-w-full truncate text-xs font-bold px-2.5 py-1 rounded-lg transition-colors ${activeTagFilter === tag ? 'bg-blue-500 text-white' : `${theme.input} ${theme.textMuted}`}`}
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

      {blocks.length > 0 && rankedBlocks.length === 0 && (
        <p className={`py-4 text-center text-xs font-semibold ${theme.textMuted}`}>
          {t('healthExerciseSearchEmpty')}
        </p>
      )}

      <div className="min-h-0 pb-1 flex-1 overflow-visible xl:overflow-y-auto xl:overscroll-contain xl:pr-1" data-k136b-health-library-scroll data-health-scroll-owner="wide-library">
        <div className="space-y-2.5">
          {blockGroups.map(row => (
            <section key={row.key} className="min-w-0" data-k136a-health-block-section>
              {row.tag ? (
                <div className="flex items-center gap-1.5 mb-1">
                  <span className={`max-w-full truncate text-[11px] font-black tracking-wide ${theme.textMuted}`}>
                    {row.tag === t('other') ? t('other') : `#${row.tag?.toUpperCase()}`}
                  </span>
                  <div className={`flex-1 h-px ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`} />
                </div>
              ) : null}
              <div className="flex flex-wrap items-start gap-1.5 overflow-visible px-0.5">
                {row.blocks.map(renderBlock)}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
});
