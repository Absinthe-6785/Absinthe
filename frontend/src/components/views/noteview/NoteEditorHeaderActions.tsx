import { useState, useRef, useEffect, type ReactNode } from 'react';
import {
  Star, Copy, AlignLeft, RotateCcw, MoreHorizontal, Search, Trash2,
} from 'lucide-react';
import type { NoteChromeColors } from '../noteEditorTheme';
import type { EditorMode } from '../editorMode';
import { useTranslation } from '@/lib/i18n';

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
}

const ACTION_BTN_SIZE = 24;
const ACTION_GAP = 8;

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
      {onOpenSettings ? (
        <button type="button" className="btbtn" style={menuItemStyle} onClick={() => { onOpenSettings(); setMenuOpen(false); }}>
          {t('settings')}
        </button>
      ) : null}
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
    width: isMobile ? 44 : ACTION_BTN_SIZE,
    height: isMobile ? 44 : ACTION_BTN_SIZE,
    minWidth: isMobile ? 44 : ACTION_BTN_SIZE,
    padding: 0,
    display: 'inline-flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexShrink: 0,
  };

  return (
    <div
      data-note-editor-header-actions
      data-k104-mobile-toolbar={mobileCompact ? 'compact' : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: ACTION_GAP,
        flexShrink: 0,
        flexWrap: isTrash ? 'wrap' : 'nowrap',
        minWidth: 0,
        justifyContent: 'flex-end',
      }}
    >
      {!mobileCompact ? (
        <div style={{ display: 'flex', background: c.toolbar, borderRadius: 7, padding: 2, gap: 1, flexShrink: 0 }}>
          {viewModeButtons.map(({ key, icon }) => (
            <button
              key={key}
              title={key === 'reading' ? t('nvReadingMode') : t('nvGraphMode')}
              onClick={() => onViewModeToggle(key)}
              className="btbtn"
              style={{
                ...iconBtnStyle,
                width: ACTION_BTN_SIZE,
                height: ACTION_BTN_SIZE,
                minWidth: ACTION_BTN_SIZE,
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
          className="btbtn shrink-0"
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
          className="btbtn shrink-0"
          title={starred ? t('nvUnstar') : t('nvStar')}
          style={iconBtnStyle}
        >
          <Star size={14} color={starred ? c.accent : c.textMuted} fill={starred ? c.accent : 'none'}/>
        </button>
      ) : null}

      {!mobileCompact && !isTrash ? (
        <button
          onClick={() => void onCopyDocument()}
          className="btbtn shrink-0"
          title={docCopied ? t('nvCopied') : t('nvCopyDocument')}
          style={{ ...iconBtnStyle, color: docCopied ? c.green : c.textMuted }}
        >
          <Copy size={14}/>
        </button>
      ) : null}

      <div ref={menuRef} style={{ position: 'relative', flexShrink: 0 }}>
        <button
          type="button"
          className="btbtn"
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
          className={`btbtn shrink-0${isMobile ? ' btbtn-mobile' : ''}`}
          title={t('nvTogglePanel')}
          style={{ ...iconBtnStyle, color: showRightPanel ? c.accent : c.textMuted }}
        >
          <AlignLeft size={14}/>
        </button>
      ) : null}

      {isTrash ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: ACTION_GAP, flexShrink: 0 }} data-k102-trash-actions>
          <button
            type="button"
            onClick={onRestore}
            className="btbtn k101-interactive shrink-0"
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
              className="btbtn k101-interactive shrink-0"
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
