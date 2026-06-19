import { useEffect, useRef, type KeyboardEvent, type RefObject } from 'react';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import type { NoteChromeColors } from '../noteEditorTheme';
import { EDITOR_DOCUMENT_SEARCH_ATTR } from '../searchFocusIsolation';
import { useTranslation } from '@/lib/i18n';
import { UI_INTERACTION } from '@/lib/uiInteractionTokens';
import { useFindInNoteDismiss } from './useFindInNoteDismiss';

export interface FindInNotePanelProps {
  open: boolean;
  isMobile: boolean;
  /** K-123 — float top-right inside centered editor column (desktop). */
  anchored?: boolean;
  colors: NoteChromeColors;
  searchInputRef: RefObject<HTMLInputElement | null>;
  searchQuery: string;
  matchCount: number;
  activeMatchIndex: number;
  onQueryChange: (query: string) => void;
  onPrevMatch: () => void;
  onNextMatch: () => void;
  onClose: () => void;
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
}

/** K-122 — temporary find-in-note palette (desktop bar / mobile bottom sheet). */
export function FindInNotePanel({
  open,
  isMobile,
  anchored = false,
  colors: c,
  searchInputRef,
  searchQuery,
  matchCount,
  activeMatchIndex,
  onQueryChange,
  onPrevMatch,
  onNextMatch,
  onClose,
  onKeyDown,
}: FindInNotePanelProps) {
  const { t } = useTranslation();
  const panelRef = useRef<HTMLDivElement>(null);
  const trimmed = searchQuery.trim();
  const matchLabel = matchCount > 0
    ? `${(activeMatchIndex % matchCount) + 1} / ${matchCount}`
    : trimmed
      ? '0 / 0'
      : '';

  useFindInNoteDismiss({ open, panelRef, onDismiss: onClose });

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    });
  }, [open, searchInputRef]);

  if (!open) return null;

  if (isMobile) {
    return (
      <div
        data-k122-find-mobile-backdrop
        data-k122-find-in-note
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 120,
          background: 'rgba(0,0,0,0.35)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
        }}
        onClick={onClose}
      >
        <div
          ref={panelRef}
          role="dialog"
          aria-label={t('nvDocumentSearch')}
          data-k122-find-sheet
          onClick={e => e.stopPropagation()}
          style={{
            background: c.card,
            borderTop: `1px solid ${c.sideBdr}`,
            borderRadius: '16px 16px 0 0',
            padding: '12px 12px max(12px, env(safe-area-inset-bottom))',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            maxWidth: '100vw',
            overflow: 'hidden',
            boxShadow: '0 -8px 32px rgba(0,0,0,0.12)',
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 700, color: c.text }} data-k122-find-label>
            {t('nvDocumentSearch')}
          </span>
          <input
            id="k122-find-in-note-input"
            ref={searchInputRef}
            type="search"
            value={searchQuery}
            onChange={e => onQueryChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t('k81SearchInDocument')}
            autoComplete="off"
            data-document-search-toolbar
            data-k122-find-input
            className="bwsi"
            style={{
              width: '100%',
              fontSize: 14,
              padding: '10px 12px',
              minHeight: UI_INTERACTION.touchTargetMinPx,
              borderRadius: 8,
              border: `1px solid ${c.inputBdr}`,
              background: c.input,
              color: c.text,
              boxSizing: 'border-box',
            }}
            {...{ [EDITOR_DOCUMENT_SEARCH_ATTR]: '' }}
          />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minWidth: 0 }} data-k122-find-controls>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button type="button" onClick={onPrevMatch} disabled={!trimmed || matchCount === 0} title={t('nvSearchPrev')} aria-label={t('nvSearchPrev')} data-k122-find-prev className="btbtn" style={{ minWidth: UI_INTERACTION.touchTargetMinPx, minHeight: UI_INTERACTION.touchTargetMinPx, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: c.textMuted, opacity: !trimmed || matchCount === 0 ? 0.4 : 1 }}>
                <ChevronUp size={18} />
              </button>
              <button type="button" onClick={onNextMatch} disabled={!trimmed || matchCount === 0} title={t('nvSearchNext')} aria-label={t('nvSearchNext')} data-k122-find-next className="btbtn" style={{ minWidth: UI_INTERACTION.touchTargetMinPx, minHeight: UI_INTERACTION.touchTargetMinPx, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: c.textMuted, opacity: !trimmed || matchCount === 0 ? 0.4 : 1 }}>
                <ChevronDown size={18} />
              </button>
            </div>
            <span data-document-search-match-count data-k122-find-count style={{ fontSize: 12, fontWeight: 600, color: c.textMuted, fontVariantNumeric: 'tabular-nums' }}>
              {matchLabel}
            </span>
            <button type="button" onClick={onClose} title={t('close')} aria-label={t('close')} data-k122-find-close className="btbtn" style={{ minWidth: UI_INTERACTION.touchTargetMinPx, minHeight: UI_INTERACTION.touchTargetMinPx, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: c.textMuted }}>
              <X size={18} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label={t('nvDocumentSearch')}
      data-document-search-toolbar
      data-k122-find-in-note
      data-k123-find-anchored
      style={{
        position: 'absolute',
        top: 8,
        right: 0,
        zIndex: 12,
        width: 'min(420px, calc(100% - 8px))',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: '10px 12px',
        background: c.card,
        border: `1px solid ${c.sideBdr}`,
        borderRadius: 12,
        boxShadow: '0 8px 28px rgba(0,0,0,0.12)',
        boxSizing: 'border-box',
      }}
    >
      <span style={{ fontSize: 11, fontWeight: 700, color: c.textMuted }} data-k122-find-label>
        {t('nvDocumentSearch')}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <input
          id="k122-find-in-note-input"
          ref={searchInputRef}
          type="search"
          value={searchQuery}
          onChange={e => onQueryChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t('k81SearchInDocument')}
          autoComplete="off"
          data-k122-find-input
          className="bwsi"
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 12,
            padding: '6px 10px',
            minHeight: 32,
            borderRadius: 8,
            border: `1px solid ${c.inputBdr}`,
            background: c.input,
            color: c.text,
            boxSizing: 'border-box',
          }}
          {...{ [EDITOR_DOCUMENT_SEARCH_ATTR]: '' }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }} data-k122-find-controls>
          <button type="button" onClick={onPrevMatch} disabled={!trimmed || matchCount === 0} title={t('nvSearchPrev')} aria-label={t('nvSearchPrev')} data-k122-find-prev className="btbtn" style={{ minWidth: 28, minHeight: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: c.textMuted, opacity: !trimmed || matchCount === 0 ? 0.4 : 1 }}>
            <ChevronUp size={14} />
          </button>
          <button type="button" onClick={onNextMatch} disabled={!trimmed || matchCount === 0} title={t('nvSearchNext')} aria-label={t('nvSearchNext')} data-k122-find-next className="btbtn" style={{ minWidth: 28, minHeight: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: c.textMuted, opacity: !trimmed || matchCount === 0 ? 0.4 : 1 }}>
            <ChevronDown size={14} />
          </button>
          <span data-document-search-match-count data-k122-find-count style={{ fontSize: 11, fontWeight: 600, color: c.textMuted, fontVariantNumeric: 'tabular-nums', minWidth: 40, textAlign: 'center' }}>
            {matchLabel}
          </span>
          <button type="button" onClick={onClose} title={t('close')} aria-label={t('close')} data-k122-find-close className="btbtn" style={{ minWidth: 28, minHeight: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: c.textMuted }}>
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
