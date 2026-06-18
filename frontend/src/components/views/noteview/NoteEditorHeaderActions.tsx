import { useState, useRef, useEffect, type ReactNode } from 'react';
import {
  Star, Copy, AlignLeft, RotateCcw, MoreHorizontal, Search,
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
}: NoteEditorHeaderActionsProps) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: ACTION_GAP,
        flexShrink: 0,
        flexWrap: 'nowrap',
        minWidth: 0,
      }}
    >
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

      {onOpenDocumentSearch ? (
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

      {!isTrash ? (
        <button
          onClick={onToggleStar}
          className="btbtn shrink-0"
          title={starred ? t('nvUnstar') : t('nvStar')}
          style={iconBtnStyle}
        >
          <Star size={14} color={starred ? c.accent : c.textMuted} fill={starred ? c.accent : 'none'}/>
        </button>
      ) : null}

      {!isTrash ? (
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
            {overflowItems}
          </div>
        ) : null}
      </div>

      <button
        onClick={onTogglePanel}
        className={`btbtn shrink-0${isMobile ? ' btbtn-mobile' : ''}`}
        title={t('nvTogglePanel')}
        style={{ ...iconBtnStyle, color: showRightPanel ? c.accent : c.textMuted }}
      >
        <AlignLeft size={14}/>
      </button>

      {isTrash ? (
        <>
          <button
            type="button"
            onClick={onRestore}
            className="btbtn shrink-0"
            title={t('restoreLabel')}
            style={{
              height: ACTION_BTN_SIZE,
              padding: '0 10px',
              fontSize: 11,
              fontWeight: 600,
              color: c.green,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <RotateCcw size={13}/>
            {t('restoreLabel')}
          </button>
          {onPermanentDelete ? (
            <button
              type="button"
              onClick={onPermanentDelete}
              className="btbtn shrink-0"
              title={t('nvDeletePermanently')}
              style={{
                height: ACTION_BTN_SIZE,
                padding: '0 10px',
                fontSize: 11,
                fontWeight: 600,
                color: c.danger,
                display: 'inline-flex',
                alignItems: 'center',
              }}
            >
              {t('nvDeletePermanently')}
            </button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
