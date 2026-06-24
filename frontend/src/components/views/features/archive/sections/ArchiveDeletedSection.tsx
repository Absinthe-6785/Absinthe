import { useMemo, useState } from 'react';
import { RotateCcw, Search } from 'lucide-react';
import type { AppSettings, Theme } from '../../../../../types';
import { resolveAppLanguage, getTranslator } from '../../../../../lib/i18n';
import type { ArchiveDeletedProjection, ArchiveDeletedSort } from '../../knowledge/archive';
import {
  filterArchiveDeletedItems,
  sortArchiveDeletedItems,
} from '../../knowledge/archive';
import { ArchiveCollapsibleSection } from './ArchiveCollapsibleSection';
import { openNote, openNotesTrash } from '../../../../../lib/noteNavigation';
import { useNotesStore } from '../../../../../store/useNotesStore';

export interface ArchiveDeletedSectionProps {
  deleted: ArchiveDeletedProjection;
  theme: Theme;
  appSettings: AppSettings;
  collapsed: boolean;
  onToggle: () => void;
}

export function ArchiveDeletedSection({
  deleted,
  theme,
  appSettings,
  collapsed,
  onToggle,
}: ArchiveDeletedSectionProps) {
  const t = getTranslator(resolveAppLanguage(appSettings.language));
  const restoreNote = useNotesStore(s => s.restoreNote);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<ArchiveDeletedSort>('newest');

  const visible = useMemo(() => {
    const sorted = sortArchiveDeletedItems(deleted.items, sort);
    return filterArchiveDeletedItems(sorted, query).slice(0, 12);
  }, [deleted.items, query, sort]);

  return (
    <ArchiveCollapsibleSection
      sectionId="deleted"
      title={t('k109SectionDeleted')}
      collapsed={collapsed}
      onToggle={onToggle}
      theme={theme}
      dark={appSettings.darkMode}
      isEmpty={deleted.isEmpty}
      emptyHint={t('k109EmptyDeleted')}
      tone="utility"
    >
      <div className="space-y-2.5" data-k109-deleted-panel>
        <div className="flex flex-col sm:flex-row gap-2">
          <label className={`flex items-center gap-2 flex-1 min-h-[44px] px-2 rounded-lg border ${theme.border} ${theme.input}`}>
            <Search size={14} className={theme.textMuted} />
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={t('k109DeletedSearch')}
              className="flex-1 bg-transparent text-xs outline-none min-w-0"
              data-k109-deleted-search
            />
          </label>
          <select
            value={sort}
            onChange={e => setSort(e.target.value as ArchiveDeletedSort)}
            className={`text-xs min-h-[44px] px-2 rounded-lg border ${theme.border} ${theme.input}`}
            data-k109-deleted-sort
          >
            <option value="newest">{t('k109DeletedSortNewest')}</option>
            <option value="oldest">{t('k109DeletedSortOldest')}</option>
            <option value="title">{t('k109DeletedSortTitle')}</option>
          </select>
        </div>
        {deleted.totalCount > 0 && (
          <p className={`text-[10px] ${theme.textMuted}`}>
            {t('k109DeletedCount').replace('{count}', String(deleted.totalCount))}
          </p>
        )}
        <ul className="space-y-0.5" data-k109-deleted-list>
          {visible.map(item => (
            <li
              key={item.noteId}
              className={`flex items-center gap-2 text-xs min-h-[44px] lg:min-h-[36px] px-1 rounded-lg ${appSettings.darkMode ? 'hover:bg-white/5' : 'hover:bg-black/[0.03]'}`}
              data-k109-deleted-row
            >
              <button
                type="button"
                className="flex-1 text-left truncate font-medium min-h-[44px] lg:min-h-[36px]"
                onClick={() => openNote(item.noteId, { returnTab: 'analytics' })}
              >
                {item.title}
              </button>
              <span className={`text-[10px] shrink-0 ${theme.textMuted}`}>{item.relativeLabel}</span>
              <button
                type="button"
                title={t('restoreLabel')}
                aria-label={t('restoreLabel')}
                className="shrink-0 min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-lg text-green-600"
                onClick={() => restoreNote(item.noteId)}
                data-k109-deleted-restore
              >
                <RotateCcw size={14} />
              </button>
            </li>
          ))}
        </ul>
        {!deleted.isEmpty && (
          <button
            type="button"
            className="text-xs font-semibold text-primary hover:underline min-h-[44px]"
            onClick={() => openNotesTrash()}
            data-k109-open-trash
          >
            {t('k109OpenTrash')}
          </button>
        )}
      </div>
    </ArchiveCollapsibleSection>
  );
}
