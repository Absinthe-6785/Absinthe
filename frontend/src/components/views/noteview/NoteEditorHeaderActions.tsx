import { useState, useRef, useEffect, type ReactNode } from 'react';
import {
  Star, Copy, AlignLeft, RotateCcw, MoreHorizontal, Search, Trash2, Plus,
} from 'lucide-react';
import type { NoteChromeColors } from '../noteEditorTheme';
import type { EditorMode } from '../editorMode';
import { useTranslation } from '@/lib/i18n';
import { UI_INTERACTION } from '@/lib/uiInteractionTokens';

export interface NoteEditorHeaderActionsProps {
  colors: NoteChromeColors;
  isTrash: boolean;
  isMobile: boolean;
  showRightPanel: boolean;
  viewMode: EditorMode;
  viewModeButtons: ReadonlyArray<{ key: 'reading' | 'graph'; icon: ReactNode }>;
  starred: boolean;
  docCopied: boolean;
  isEvent: boolean;
  isMilestone: boolean;
  isArea: boolean;
  canMarkArea: boolean;
  isWeakTopic?: boolean;
  onToggleWeakTopic?: () => void;
  onViewModeToggle: (key: 'reading' | 'graph') => void;
  onOpenDocumentSearch?: () => void;
  onMarkEvent: () => void;
  onMarkMilestone: () => void;
  onToggleArea: () => void;
  onToggleStar: () => void;
  onDuplicate: () => void;
  onTogglePanel: () => void;
  onCopyDocument: () => void;
  onExport: () => void;
  onRestore: () => void;
  onPermanentDelete?: () => void;
  onTrash: () => void;
  onOpenSettings?: () => void;
  onOpenAppearance?: () => void;
  onOpenHelp?: () => void;
  onNewNote?: () => void;
}

export const K108A_HEADER_ACTION_BTN_SIZE = UI_INTERACTION.toolbarBtnSizePx;
export const K108A_HEADER_ACTION_GAP = UI_INTERACTION.toolbarActionGapPx;
const ACTION_BTN_SIZE = UI_INTERACTION.toolbarBtnSizePx;
const ACTION_GAP = UI_INTERACTION.toolbarActionGapPx;

export function NoteEditorHeaderActions({
  colors: c,
  isTrash,
  isMobile,
  showRightPanel,
  viewMode,
  viewModeButtons,
  starred,
  docCopied,
  isEvent,
  isMilestone,
  isArea,
  canMarkArea,
  isWeakTopic = false,
  onToggleWeakTopic,
  onViewModeToggle,
  onOpenDocumentSearch,
  onMarkEvent,
  onMarkMilestone,
  onToggleArea,
  onToggleStar,
  onDuplicate,
  onTogglePanel,
  onCopyDocument,
  onExport,
  onRestore,
  onPermanentDelete,
  onTrash,
  onOpenSettings,
  onOpenAppearance,
  onOpenHelp,
  onNewNote,
}: NoteEditorHeaderActionsProps) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const mobileCompact = isMobile && !isTrash;

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  const menuItemStyle = {
    width: '100%' as const,
    textAlign: 'left' as const,
    fontSize: 11,
    padding: '8px 10px',
    minHeight: ACTION_BTN_SIZE,
    boxSizing: 'border-box' as const,
  };

  const overflowItems = !isTrash ? (
    <>
      <button type="button" className="btbtn" style={menuItemStyle} onClick={() => { onMarkEvent(); setMenuOpen(false); }}>
        {isEvent ? t('nvEditEvent') : t('nvMarkEvent')}
      </button>
      <button type="button" className="btbtn" style={menuItemStyle} onClick={() => { onMarkMilestone(); setMenuOpen(false); }}>
        {isMilestone ? t('nvEditMilestone') : t('nvMarkMilestone')}
      </button>
      {(isArea || canMarkArea) ? (
        <button type="button" className="btbtn" style={menuItemStyle} onClick={() => { onToggleArea(); setMenuOpen(false); }}>
          {isArea ? t('nvClearArea') : t('nvMarkArea')}
        </button>
      ) : null}
      {onToggleWeakTopic ? (
        <button
          type="button"
          className="btbtn"
          style={{ ...menuItemStyle, color: isWeakTopic ? c.danger : undefined }}
          onClick={() => { onToggleWeakTopic(); setMenuOpen(false); }}
        >
          {isWeakTopic ? t('knWeakTopicActive') : t('knWeakTopicInactive')}
        </button>
      ) : null}
      <button type="button" className="btbtn" style={menuItemStyle} onClick={() => { onDuplicate(); setMenuOpen(false); }}>
        {t('nvDuplicate')}
      </button>
      <button type="button" className="btbtn" style={menuItemStyle} onClick={() => { onTrash(); setMenuOpen(false); }}>
        {t('trash')}
      </button>
      <button type="button" className="btbtn" style={menuItemStyle} onClick={() => { onExport(); setMenuOpen(false); }}>
        {t('nvExportMd')}
      </button>
    </>
  ) : null;

  const mobileMenuExtras = mobileCompact ? (
    <>
      {viewModeButtons.map(({ key, icon }) => (
        <button
          key={key}
          type="button"
          className="btbtn"
          style={menuItemStyle}
          onClick={() => { onViewModeToggle(key); setMenuOpen(false); }}
        >
          {key === 'reading' ? t('nvReadingMode') : t('nvGraphMode')}
        </button>
      ))}
      {onOpenDocumentSearch ? (
        <button type="button" className="btbtn" style={menuItemStyle} onClick={() => { onOpenDocumentSearch(); setMenuOpen(false); }}>
          {t('nvDocumentSearch')}
        </button>
      ) : null}
      <button type="button" className="btbtn" style={menuItemStyle} onClick={() => { onToggleStar(); setMenuOpen(false); }}>
        {starred ? t('nvUnstar') : t('nvStar')}
      </button>
      <button type="button" className="btbtn" style={menuItemStyle} onClick={() => { void onCopyDocument(); setMenuOpen(false); }}>
        {docCopied ? t('nvCopied') : t('nvCopyDocument')}
      </button>
      <button type="button" className="btbtn" style={menuItemStyle} onClick={() => { onTogglePanel(); setMenuOpen(false); }}>
        {t('nvTogglePanel')}
      </button>
      {onOpenAppearance ? (
        <button type="button" className="btbtn" style={menuItemStyle} onClick={() => { onOpenAppearance(); setMenuOpen(false); }}>
          {t('nvAppearance')}
        </button>
      ) : null}
      {onOpenHelp ? (
        <button type="button" className="btbtn" style={menuItemStyle} onClick={() => { onOpenHelp(); setMenuOpen(false); }}>
          {t('nvShortcuts')}
        </button>
      ) : null}
    </>
  ) : null;

  const iconBtnStyle = {
    padding: 0,
    display: 'inline-flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexShrink: 0,
  };

  return (
    <div
      data-note-editor-header-actions
      data-k108-header-actions
      data-k108-header-layout="normalized"
      data-k125a-notes-header-actions
      data-k104-mobile-toolbar={mobileCompact ? 'compact' : undefined}
      className="k125a-notes-actions-row"
      style={{
        flexWrap: isTrash ? 'wrap' : 'nowrap',
      }}
    >
      <div className="k125a-notes-actions-cluster">
      {!mobileCompact ? (
        <div className="k125a-notes-view-mode-group">
          {viewModeButtons.map(({ key, icon }) => (
            <button
              key={key}
              title={key === 'reading' ? t('nvReadingMode') : t('nvGraphMode')}
              onClick={() => onViewModeToggle(key)}
              className="btbtn k125a-header-action-btn"
              style={{
                ...iconBtnStyle,
                borderRadius: 5,
                background: (key === 'reading' ? viewMode === 'reading' : viewMode === 'graph') ? c.card : 'none',
                color: (key === 'reading' ? viewMode === 'reading' : viewMode === 'graph') ? c.accent : c.textMuted,
              }}>
              {icon}
            </button>
          ))}
        </div>
      ) : null}

      {!mobileCompact && onOpenDocumentSearch ? (
        <button
          type="button"
          onClick={onOpenDocumentSearch}
          className="btbtn k125a-header-action-btn shrink-0"
          title={t('nvDocumentSearch')}
          style={iconBtnStyle}
          data-read-mode-search-btn
        >
          <Search size={14} />
        </button>
      ) : null}

      {!mobileCompact && !isTrash ? (
        <button
          onClick={onToggleStar}
          className="btbtn k125a-header-action-btn shrink-0"
          title={starred ? t('nvUnstar') : t('nvStar')}
          style={iconBtnStyle}
        >
          <Star size={14} color={starred ? c.accent : c.textMuted} fill={starred ? c.accent : 'none'}/>
        </button>
      ) : null}

      {!mobileCompact && !isTrash ? (
        <button
          onClick={() => void onCopyDocument()}
          className="btbtn k125a-header-action-btn shrink-0"
          title={docCopied ? t('nvCopied') : t('nvCopyDocument')}
          style={{ ...iconBtnStyle, color: docCopied ? c.green : c.textMuted }}
        >
          <Copy size={14}/>
        </button>
      ) : null}

      <div ref={menuRef} style={{ position: 'relative', flexShrink: 0 }}>
        <button
          type="button"
          className="btbtn k125a-header-action-btn"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          title={t('nvMoreActions')}
          onClick={() => setMenuOpen(v => !v)}
          style={{ ...iconBtnStyle, color: menuOpen ? c.accent : c.textMuted }}
        >
          <MoreHorizontal size={16}/>
        </button>
        {menuOpen ? (
          <div
            role="menu"
            style={{
              position: 'absolute', top: '100%', right: 0, marginTop: 4, zIndex: 200,
              background: c.card, border: `1px solid ${c.sideBdr}`, borderRadius: 10,
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 168, padding: '4px 0',
            }}
          >
            {mobileMenuExtras}
            {overflowItems}
          </div>
        ) : null}
      </div>

      {!mobileCompact ? (
        <button
          onClick={onTogglePanel}
          className="btbtn k125a-header-action-btn shrink-0"
          title={t('nvTogglePanel')}
          style={{ ...iconBtnStyle, color: showRightPanel ? c.accent : c.textMuted }}
        >
          <AlignLeft size={14}/>
        </button>
      ) : null}
      </div>

      {onNewNote && !isTrash ? (
        <button
          type="button"
          onClick={onNewNote}
          title={t('nvNewNoteBtn')}
          data-k117-new-note-btn
          data-noteview-new-note-btn
          data-k121-notes-new
          data-k125a-notes-new-inline
          className="btbtn k125a-notes-new-btn"
        >
          <Plus size={14} />
          {!isMobile ? t('nvNewNoteBtn') : null}
        </button>
      ) : null}

      {isTrash ? (
        <div className="k125a-notes-actions-cluster" data-k102-trash-actions>
          <button
            type="button"
            onClick={onRestore}
            className="btbtn k125a-header-action-btn k101-interactive shrink-0"
            title={t('restoreLabel')}
            aria-label={t('restoreLabel')}
            style={{ ...iconBtnStyle, color: c.green }}
            data-k102-trash-restore
          >
            <RotateCcw size={14}/>
          </button>
          {onPermanentDelete ? (
            <button
              type="button"
              onClick={onPermanentDelete}
              className="btbtn k125a-header-action-btn k101-interactive shrink-0"
              title={t('nvDeletePermanently')}
              aria-label={t('nvDeletePermanently')}
              style={{ ...iconBtnStyle, color: c.danger }}
              data-k102-trash-delete
            >
              <Trash2 size={14}/>
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
