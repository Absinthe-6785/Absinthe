import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { TranslationKey } from '../../../../../lib/i18n';
import { useTranslation } from '../../../../../lib/i18n';
import { useModalA11y } from '../../../../../hooks/useModalA11y';
import { ProductEmptyState } from '../../../../common/ProductEmptyState';
import { WorkspaceToolbarIconButton } from '../../../../common/WorkspaceToolbar';
import { WorkspaceErrorBoundary } from '../../../../common/WorkspaceErrorBoundary';
import { UI_INTERACTION } from '../../../../../lib/uiInteractionTokens';
import { UI_SPACING } from '../../../../../lib/uiSpacingTokens';
import type { SearchProjection, SearchResultItem, SearchDomain } from '../searchProjectionModels';
import { SEARCH_DOMAIN_LABEL_KEYS } from '../searchProjectionModels';
import { useSearchSectionPrefs } from '../hooks/useSearchSectionPrefs';
import { SearchCollapsibleSection } from './SearchCollapsibleSection';
import { SearchVirtualList } from './SearchVirtualList';
import {
  clearSearchRecentHistory,
  loadSearchRecent,
  pushSearchRecent,
} from '../searchRecentStorage';
import type { SearchSectionPrefKey } from '../searchSectionPrefs';
import { switchToTab } from '../../../../../lib/noteNavigation';
import { getSearchNoteHandlers } from '../searchNavigation';
import { getSearchDomainHandlers } from '../searchDomainNavigation';
import type { WorkspaceSearchResultKind } from '../../knowledge/workspace/buildWorkspaceSearch';

const DOMAIN_PREF_KEYS: Record<SearchDomain, SearchSectionPrefKey> = {
  notes: 'notesCollapsed',
  planner: 'plannerCollapsed',
  health: 'healthCollapsed',
  recipe: 'recipeCollapsed',
  archive: 'archiveCollapsed',
};

export interface SearchWorkspacePaletteProps {
  colors: NoteChromeColors;
  projection: SearchProjection;
  open: boolean;
  query: string;
  onQueryChange: (query: string) => void;
  onClose: () => void;
  onRecentRevision: () => void;
  isSearching?: boolean;
}

function recordRecent(result: SearchResultItem): void {
  pushSearchRecent({
    domain: result.domain,
    kind: String(result.kind),
    id: result.recipeId ?? result.noteId ?? result.plannerItemId ?? result.id,
    title: result.title,
  });
}

function navigateResult(result: SearchResultItem): void {
  const handlers = getSearchNoteHandlers();
  recordRecent(result);

  if (result.domain === 'notes') {
    switchToTab('note');
    const kind = result.kind as WorkspaceSearchResultKind;
    switch (kind) {
      case 'note':
      case 'project':
      case 'milestone':
        if (result.noteId) handlers?.onSelectNote(result.noteId);
        break;
      case 'folder':
        if (result.folderId) handlers?.onSelectFolder(result.folderId);
        break;
      case 'tag':
        if (result.tag) handlers?.onSelectTag(result.tag);
        break;
      case 'collection':
      case 'subject':
        if (result.collectionId) handlers?.onSelectCollection(result.collectionId);
        break;
      case 'learning-path':
        if (result.pathId) handlers?.onSelectLearningPath(result.pathId);
        break;
    }
    return;
  }

  if (result.domain === 'planner') {
    switchToTab('planner');
    if (result.plannerItemId) {
      getSearchDomainHandlers()?.onOpenPlannerItem?.(result.plannerItemId, String(result.kind));
    }
    return;
  }
  if (result.domain === 'health') {
    switchToTab('health');
    const day = result.subtitle?.split('·')[0]?.trim() ?? result.title;
    if (day) getSearchDomainHandlers()?.onOpenHealthDay?.(day);
    return;
  }
  if (result.domain === 'recipe') {
    switchToTab('recipe');
    if (result.recipeId) getSearchDomainHandlers()?.onSelectRecipe?.(result.recipeId);
    return;
  }
  if (result.domain === 'archive') {
    switchToTab('analytics');
    if (result.noteId) handlers?.onSelectNote(result.noteId);
  }
}

export function SearchWorkspacePalette({
  colors: c,
  projection,
  open,
  query,
  onQueryChange,
  onClose,
  onRecentRevision,
  isSearching = false,
}: SearchWorkspacePaletteProps) {
  const { t, lang } = useTranslation();
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const activeIndexRef = useRef(0);
  const { prefs, toggle } = useSearchSectionPrefs();

  useModalA11y({ open, onClose, containerRef: panelRef });

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  useEffect(() => {
    if (open) {
      setActiveIndex(0);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [open]);

  const flatResults = projection.results;

  useEffect(() => {
    setActiveIndex(0);
  }, [query, projection.generatedAt]);

  const handleSelect = useCallback((result: SearchResultItem) => {
    navigateResult(result);
    onRecentRevision();
    onClose();
  }, [onClose, onRecentRevision]);

  const handleClearRecent = useCallback(() => {
    clearSearchRecentHistory();
    onRecentRevision();
  }, [onRecentRevision]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (query.trim()) {
          onQueryChange('');
        } else {
          onClose();
        }
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex(i => Math.min(i + 1, Math.max(flatResults.length - 1, 0)));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex(i => Math.max(i - 1, 0));
      }
      if (e.key === 'Enter') {
        const selected = flatResults[activeIndexRef.current];
        if (selected) {
          e.preventDefault();
          handleSelect(selected);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, flatResults, handleSelect, query, onQueryChange, onClose]);

  const recentItems = useMemo(
    () => [...projection.recentSearches.today, ...projection.recentSearches.earlier],
    [projection.recentSearches],
  );

  const activeDescendantId = flatResults.length > 0 ? `k111-search-opt-${activeIndex}` : undefined;

  if (!open) return null;

  let rowOffset = 0;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 250,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: 'max(4vh, 16px) 12px 12px',
        background: 'rgba(0,0,0,0.45)',
      }}
      onClick={onClose}
      data-k111-search-modal
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="k111-search-title"
        data-k111-search-workspace
        data-workspace="search"
        style={{
          width: '100%',
          maxWidth: 'min(560px, calc(100vw - 24px))',
          background: c.card,
          border: `1px solid ${c.sideBdr}`,
          borderRadius: 14,
          boxShadow: '0 12px 40px rgba(0,0,0,0.22)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: 'min(85vh, 640px)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <WorkspaceErrorBoundary workspace="search">
        <h2 id="k111-search-title" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>
          {t('k111SearchTitle')}
        </h2>

        <div
          data-k120-search-toolbar
          style={{ display: 'flex', alignItems: 'center', gap: UI_INTERACTION.toolbarActionGapPx, padding: '8px 10px', borderBottom: `1px solid ${c.sideBdr}`, flexShrink: 0 }}
        >
          <Search size={UI_INTERACTION.toolbarIconSizePx} color={c.textMuted} aria-hidden />
          <input
            ref={inputRef}
            role="combobox"
            aria-expanded={flatResults.length > 0 || recentItems.length > 0}
            aria-controls="k111-search-listbox"
            aria-autocomplete="list"
            aria-activedescendant={activeDescendantId}
            value={query}
            onChange={e => onQueryChange(e.target.value)}
            placeholder={t('k111SearchPlaceholder')}
            data-k111-search-input
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: 13,
              color: c.text,
              minHeight: UI_INTERACTION.touchTargetMinPx,
            }}
          />
          <WorkspaceToolbarIconButton
            label={t('close')}
            icon={<X size={UI_INTERACTION.toolbarIconSizePx} />}
            onClick={onClose}
          />
          <kbd style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, border: `1px solid ${c.sideBdr}`, color: c.textMuted }}>
            {t('k101GlobalSearchShortcut')}
          </kbd>
        </div>

        <div
          id="k111-search-listbox"
          role="listbox"
          aria-label={t('searchResultsList')}
          className={UI_SPACING.scrollOverscroll}
          style={{ flex: 1, overflowY: 'auto', padding: '4px 0', minHeight: 0 }}
          data-k111-search-results
          data-k120-scroll-search
        >
          {isSearching ? (
            <div role="status" className="k101-skeleton-pulse" style={{ padding: '14px', fontSize: 12, color: c.textFaint, textAlign: 'center' }} data-k111-search-loading>
              {t('k101SearchLoading')}
            </div>
          ) : projection.empty.noQuery ? (
            <div data-k111-search-recent>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px' }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: c.textMuted, textTransform: 'uppercase' }}>
                  {t('k111RecentSearches')}
                </span>
                {!projection.empty.noRecent && (
                  <button
                    type="button"
                    onClick={handleClearRecent}
                    data-k111-clear-recent
                    style={{ fontSize: 10, fontWeight: 600, color: c.accent, background: 'none', border: 'none', cursor: 'pointer', minHeight: 44, padding: '0 6px' }}
                  >
                    {t('k111ClearRecent')}
                  </button>
                )}
              </div>
              {projection.empty.noRecent ? (
                <ProductEmptyState
                  icon={Search}
                  title={t('k111EmptyNoRecent')}
                  description={t('k111EmptyNoRecentHint')}
                  dataHook="k111-empty-recent"
                  variant="note-chrome"
                  colors={c}
                />
              ) : (
                <>
                  {projection.recentSearches.today.length > 0 && (
                    <div data-k111-recent-bucket="today">
                      <p style={{ fontSize: 9, fontWeight: 700, color: c.textFaint, padding: '2px 10px' }}>{t('k111RecentToday')}</p>
                      {projection.recentSearches.today.map(item => (
                        <button
                          key={`${item.domain}-${item.id}`}
                          type="button"
                          data-k111-recent-row
                          onClick={() => onQueryChange(item.title)}
                          style={{ width: '100%', textAlign: 'left', padding: '6px 10px', minHeight: 44, border: 'none', background: 'transparent', fontSize: 12, color: c.text, cursor: 'pointer' }}
                        >
                          {item.title}
                          <span style={{ fontSize: 10, color: c.textMuted, marginLeft: 6 }}>{item.relativeLabel}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {projection.recentSearches.earlier.length > 0 && (
                    <div data-k111-recent-bucket="earlier">
                      <p style={{ fontSize: 9, fontWeight: 700, color: c.textFaint, padding: '2px 10px' }}>{t('k111RecentEarlier')}</p>
                      {projection.recentSearches.earlier.map(item => (
                        <button
                          key={`${item.domain}-${item.id}-e`}
                          type="button"
                          data-k111-recent-row
                          onClick={() => onQueryChange(item.title)}
                          style={{ width: '100%', textAlign: 'left', padding: '6px 10px', minHeight: 44, border: 'none', background: 'transparent', fontSize: 12, color: c.text, cursor: 'pointer' }}
                        >
                          {item.title}
                          <span style={{ fontSize: 10, color: c.textMuted, marginLeft: 6 }}>{item.relativeLabel}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
              <p style={{ fontSize: 10, color: c.textFaint, textAlign: 'center', padding: '8px 10px', margin: 0 }} data-k111-empty-query-hint>
                {t('k111EmptyNoQueryHint')}
              </p>
            </div>
          ) : projection.empty.noResults ? (
            <ProductEmptyState
              icon={Search}
              title={t('workspaceSearchNoResults')}
              description={t('k101SearchEmptyHint')}
              dataHook="k111-empty-results"
              variant="note-chrome"
              colors={c}
            />
          ) : (
            <div data-k111-search-grouped>
              {projection.groupedResults.map(group => {
                const prefKey = DOMAIN_PREF_KEYS[group.domain];
                const collapsed = prefs[prefKey];
                const offset = rowOffset;
                rowOffset += group.results.length;
                return (
                  <SearchCollapsibleSection
                    key={group.domain}
                    sectionId={group.domain}
                    title={t(SEARCH_DOMAIN_LABEL_KEYS[group.domain] as TranslationKey)}
                    count={group.count}
                    collapsed={collapsed}
                    onToggle={() => toggle(prefKey)}
                    colors={c}
                  >
                    <SearchVirtualList
                      results={group.results}
                      projection={projection}
                      colors={c}
                      lang={lang}
                      activeIndex={activeIndex}
                      setActiveIndex={setActiveIndex}
                      onSelect={handleSelect}
                      rowIndexOffset={offset}
                    />
                  </SearchCollapsibleSection>
                );
              })}
            </div>
          )}
        </div>

        {query.trim() && !projection.empty.noResults && (
          <div style={{ padding: '4px 10px 8px', borderTop: `1px solid ${c.sideBdr}`, fontSize: 9, color: c.textFaint, flexShrink: 0 }} data-k111-search-counts>
            {projection.counts.total} {t('k111ResultsCount')}
          </div>
        )}
        </WorkspaceErrorBoundary>
      </div>
    </div>
  );
}

export { loadSearchRecent };
