import type { KeyboardEvent, RefObject } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { EditorSearchScope } from '../editorSearch';
import type { NoteChromeColors } from '../noteEditorTheme';
import { EDITOR_DOCUMENT_SEARCH_ATTR } from '../searchFocusIsolation';
import { useTranslation } from '@/lib/i18n';

const METADATA_CHIP_HEIGHT = 24;
const EDITOR_TOOLBAR_GAP = 6;

export interface DocumentSearchToolbarProps {
  colors: NoteChromeColors;
  searchInputRef: RefObject<HTMLInputElement | null>;
  searchQuery: string;
  searchScope: EditorSearchScope;
  matchCount: number;
  activeMatchIndex: number;
  compact?: boolean;
  showScopeControls?: boolean;
  onQueryChange: (query: string) => void;
  onScopeChange: (scope: EditorSearchScope) => void;
  onPrevMatch: () => void;
  onNextMatch: () => void;
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
}

export function DocumentSearchToolbar({
  colors: c,
  searchInputRef,
  searchQuery,
  searchScope,
  matchCount,
  activeMatchIndex,
  compact = false,
  showScopeControls = true,
  onQueryChange,
  onScopeChange,
  onPrevMatch,
  onNextMatch,
  onKeyDown,
}: DocumentSearchToolbarProps) {
  const { t } = useTranslation();
  const trimmed = searchQuery.trim();
  const matchLabel = matchCount > 0
    ? `${(activeMatchIndex % matchCount) + 1} / ${matchCount}`
    : trimmed
      ? '0'
      : '';
  const noResults = Boolean(trimmed) && matchCount === 0;

  return (
    <div
      data-document-search-toolbar
      data-read-mode-search-toolbar
      data-document-search-compact={compact ? 'true' : 'false'}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: compact ? 8 : EDITOR_TOOLBAR_GAP,
        flexWrap: 'wrap',
        flex: compact ? 1 : undefined,
        minWidth: 0,
        padding: compact ? '4px 8px' : undefined,
      }}
    >
      <input
        ref={searchInputRef}
        type="search"
        value={searchQuery}
        onChange={e => onQueryChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={t('k81SearchInDocument')}
        title={t('k81SearchInDocument')}
        className="bwsi"
        style={{
          fontSize: 10,
          padding: '0 8px',
          height: METADATA_CHIP_HEIGHT,
          width: compact ? '100%' : 120,
          maxWidth: compact ? '100%' : '28vw',
          minWidth: compact ? 120 : undefined,
          flex: compact ? '1 1 140px' : undefined,
          boxSizing: 'border-box',
        }}
        {...{ [EDITOR_DOCUMENT_SEARCH_ATTR]: '' }}
      />
      {trimmed ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: EDITOR_TOOLBAR_GAP, flexWrap: 'wrap' }}>
          {matchLabel ? (
            <span
              key={matchLabel}
              data-document-search-match-count
              style={{ fontSize: 10, color: c.textMuted, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}
            >
              {matchLabel}
            </span>
          ) : null}
          {noResults ? (
            <span data-k103-search-no-results>{t('nvSearchNoResults')}</span>
          ) : null}
          {showScopeControls ? (
            <>
              {(['block', 'document', 'all'] as const).map(scope => (
                <button
                  key={scope}
                  type="button"
                  className={`be-editor-toolbar-scope${searchScope === scope ? ' active' : ''}`}
                  onClick={() => onScopeChange(scope)}
                >
                  {scope === 'block' ? t('nvSearchScopeBlock') : scope === 'document' ? t('nvSearchScopeDocument') : t('nvSearchScopeAll')}
                </button>
              ))}
            </>
          ) : null}
          {searchScope !== 'all' && matchCount > 0 ? (
            <>
              <button type="button" className="be-editor-toolbar-btn" title={t('nvSearchPrev')} onClick={onPrevMatch}>
                <ChevronUp size={12} />
              </button>
              <button type="button" className="be-editor-toolbar-btn" title={t('nvSearchNext')} onClick={onNextMatch}>
                <ChevronDown size={12} />
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
