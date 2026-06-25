import { memo, useMemo, useState } from 'react';
import { Plus, Dumbbell, Search } from 'lucide-react';
import type { ExerciseBlock, Theme } from '../../../../types';
import { ProductEmptyState } from '../../../common/ProductEmptyState';
import { WORKSPACE_CARD, WORKSPACE_CARD_SURFACE_COMPACT } from '../../../common/workspaceCardSizes';
import { useTranslation } from '../../../../lib/i18n';
import { WorkoutBlockCard } from './WorkoutBlockCard';

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
  quickCaptureMeta?: ReadonlyMap<string, HealthBlockQuickCaptureMeta>;
}

export interface HealthBlockQuickCaptureMeta {
  lastDate: string;
  summary: string;
  recentRank: number;
}

interface FlatBlockRow {
  tag?: string;
  blocks: ExerciseBlock[];
  key: string;
}

function buildBlockGroups(
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
    rows.push({ tag, blocks: items, key: `h-${tag}` });
  }
  if (!activeTagFilter) {
    const untagged = blocks.filter(b => (b.tags ?? []).length === 0);
    if (untagged.length > 0) {
      rows.push({ tag: allTags.length > 0 ? otherLabel : undefined, blocks: untagged, key: 'h-other' });
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
  quickCaptureMeta,
}: HealthBlockLibraryProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');

  const allTags = useMemo(
    () => Array.from(new Set(blocks.flatMap(b => b.tags ?? []))),
    [blocks],
  );

  const rankedBlocks = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...blocks]
      .filter(block => {
        if (!q) return true;
        const haystack = [block.name, ...(block.tags ?? [])].join(' ').toLowerCase();
        return haystack.includes(q);
      })
      .sort((a, b) => {
        const ar = quickCaptureMeta?.get(a.id)?.recentRank ?? Number.MAX_SAFE_INTEGER;
        const br = quickCaptureMeta?.get(b.id)?.recentRank ?? Number.MAX_SAFE_INTEGER;
        if (ar !== br) return ar - br;
        return a.name.localeCompare(b.name);
      });
  }, [blocks, query, quickCaptureMeta]);

  const blockGroups = useMemo(
    () => buildBlockGroups(rankedBlocks, activeTagFilter, t('other')),
    [rankedBlocks, activeTagFilter, t],
  );

  const renderBlock = (block: ExerciseBlock) => (
    <WorkoutBlockCard
      key={block.id}
      block={block}
      theme={theme}
      onAdd={() => void onAddToToday(block)}
      onEdit={e => { e.stopPropagation(); onEditBlock(block); }}
      onDelete={e => onDeleteBlock(block.id, e)}
    />
  );

  return (
    <div
      className={`${WORKSPACE_CARD.sm} min-h-0 lg:h-[48%] lg:min-h-[360px] ${WORKSPACE_CARD_SURFACE_COMPACT} flex flex-col overflow-hidden transition-colors ${theme.card} ${mobileVisible ? '' : 'hidden lg:flex'}`}
      data-k107-health-block-library
      data-k126-exercise-library
    >
      <div className="flex justify-between items-center gap-3 mb-2">
        <h2 className="font-heading text-lg font-bold">{t('workoutLibrary')}</h2>
        <button type="button" onClick={onNewBlock} className="bg-primary text-primary-foreground px-2.5 py-2 rounded-xl shadow-sm min-h-[36px] min-w-[36px] inline-flex items-center justify-center">
          <Plus size={16} />
        </button>
      </div>

      <label className={`mb-2 flex items-center gap-2 rounded-xl px-3 py-2 border ${theme.border} ${theme.input}`} data-k129d-health-block-search>
        <Search size={14} className={theme.textMuted} />
        <input
          type="search"
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

      <div className="min-h-0 pb-1 flex-1 overflow-y-auto overscroll-contain pr-1" data-k136b-health-library-scroll>
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
