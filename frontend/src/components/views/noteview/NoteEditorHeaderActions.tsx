import { useState, useRef, useEffect, type ReactNode } from 'react';
import {
  Star, Copy, AlignLeft, Save, Trash2, RotateCcw, MoreHorizontal,
} from 'lucide-react';
import type { NoteChromeColors } from '../noteEditorTheme';
import type { EditorMode } from '../editorMode';
import { useTranslation } from '@/lib/i18n';

export interface NoteEditorHeaderActionsProps {
  colors: NoteChromeColors;
  isTrash: boolean;
  isMobile: boolean;
  useOverflowMenu: boolean;
  showRightPanel: boolean;
  viewMode: EditorMode;
  viewModeButtons: ReadonlyArray<{ key: 'reading' | 'graph'; icon: ReactNode }>;
  starred: boolean;
  docCopied: boolean;
  isEvent: boolean;
  isMilestone: boolean;
  isArea: boolean;
  canMarkArea: boolean;
  onViewModeToggle: (key: 'reading' | 'graph') => void;
  onMarkEvent: () => void;
  onMarkMilestone: () => void;
  onToggleArea: () => void;
  onToggleStar: () => void;
  onDuplicate: () => void;
  onTogglePanel: () => void;
  onCopyDocument: () => void;
  onExport: () => void;
  onRestore: () => void;
  onTrash: () => void;
}

export function NoteEditorHeaderActions({
  colors: c,
  isTrash,
  isMobile,
  useOverflowMenu,
  showRightPanel,
  viewMode,
  viewModeButtons,
  starred,
  docCopied,
  isEvent,
  isMilestone,
  isArea,
  canMarkArea,
  onViewModeToggle,
  onMarkEvent,
  onMarkMilestone,
  onToggleArea,
  onToggleStar,
  onDuplicate,
  onTogglePanel,
  onCopyDocument,
  onExport,
  onRestore,
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

  const metaButtons = !isTrash ? (
    <>
      <button
        type="button"
        onClick={onMarkEvent}
        className="btbtn"
        style={{ fontSize: 10, color: isEvent ? c.accent : c.textMuted, whiteSpace: 'nowrap' }}
        title={isEvent ? t('nvEditEventTitle') : t('nvMarkEventTitle')}
      >
        {isEvent ? t('nvEditEvent') : t('nvMarkEvent')}
      </button>
      <button
        type="button"
        onClick={onMarkMilestone}
        className="btbtn"
        style={{ fontSize: 10, color: isMilestone ? c.accent : c.textMuted, whiteSpace: 'nowrap' }}
        title={isMilestone ? t('nvEditMilestoneTitle') : t('nvMarkMilestoneTitle')}
      >
        {isMilestone ? t('nvEditMilestone') : t('nvMarkMilestone')}
      </button>
      {(isArea || canMarkArea) ? (
        <button
          type="button"
          onClick={onToggleArea}
          className="btbtn"
          style={{ fontSize: 10, color: isArea ? c.accent : c.textMuted, whiteSpace: 'nowrap' }}
          title={isArea ? t('nvClearAreaTitle') : t('nvMarkAreaTitle')}
        >
          {isArea ? t('nvClearArea') : t('nvMarkArea')}
        </button>
      ) : null}
    </>
  ) : null;

  const overflowItems = !isTrash ? (
    <>
      <button type="button" className="btbtn" style={{ width: '100%', textAlign: 'left', fontSize: 11, padding: '8px 10px' }} onClick={() => { onMarkEvent(); setMenuOpen(false); }}>
        {isEvent ? t('nvEditEvent') : t('nvMarkEvent')}
      </button>
      <button type="button" className="btbtn" style={{ width: '100%', textAlign: 'left', fontSize: 11, padding: '8px 10px' }} onClick={() => { onMarkMilestone(); setMenuOpen(false); }}>
        {isMilestone ? t('nvEditMilestone') : t('nvMarkMilestone')}
      </button>
      {(isArea || canMarkArea) ? (
        <button type="button" className="btbtn" style={{ width: '100%', textAlign: 'left', fontSize: 11, padding: '8px 10px' }} onClick={() => { onToggleArea(); setMenuOpen(false); }}>
          {isArea ? t('nvClearArea') : t('nvMarkArea')}
        </button>
      ) : null}
      <button type="button" className="btbtn" style={{ width: '100%', textAlign: 'left', fontSize: 11, padding: '8px 10px' }} onClick={() => { onDuplicate(); setMenuOpen(false); }}>⎘ {t('nvDuplicate')}</button>
      <button type="button" className="btbtn" style={{ width: '100%', textAlign: 'left', fontSize: 11, padding: '8px 10px' }} onClick={() => { void onCopyDocument(); setMenuOpen(false); }}>{t('nvCopyDocument')}</button>
      <button type="button" className="btbtn" style={{ width: '100%', textAlign: 'left', fontSize: 11, padding: '8px 10px' }} onClick={() => { onExport(); setMenuOpen(false); }}>{t('nvExportMd')}</button>
    </>
  ) : null;

  return (
    <div
      data-note-editor-header-actions
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        flexShrink: 0,
        flexWrap: 'nowrap',
        marginLeft: 'auto',
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
              padding: '3px 7px', borderRadius: 5,
              background: (key === 'reading' ? viewMode === 'reading' : viewMode === 'graph') ? c.card : 'none',
              color: (key === 'reading' ? viewMode === 'reading' : viewMode === 'graph') ? c.accent : c.textMuted,
            }}>
            {icon}
          </button>
        ))}
      </div>

      {!useOverflowMenu && !isTrash ? metaButtons : null}

      {!isTrash ? (
        <button onClick={onToggleStar} className="btbtn shrink-0" title={starred ? t('nvUnstar') : t('nvStar')}>
          <Star size={14} color={starred ? c.accent : c.textMuted} fill={starred ? c.accent : 'none'}/>
        </button>
      ) : null}

      {!useOverflowMenu && !isTrash ? (
        <button onClick={onDuplicate} className="btbtn shrink-0" title={t('nvDuplicate')}>
          <span style={{ fontSize: 11 }}>⎘</span>
        </button>
      ) : null}

      <button
        onClick={onTogglePanel}
        className={`btbtn shrink-0${isMobile ? ' btbtn-mobile' : ''}`}
        title={t('nvTogglePanel')}
        style={{ color: showRightPanel ? c.accent : c.textMuted }}
      >
        <AlignLeft size={14}/>
      </button>

      {!useOverflowMenu && !isTrash ? (
        <>
          <button onClick={() => void onCopyDocument()} className="btbtn shrink-0"
            title={docCopied ? t('nvCopied') : t('nvCopyDocument')}
            style={{ color: docCopied ? c.green : c.textMuted }}>
            <Copy size={14}/>
          </button>
          <button onClick={onExport} className="btbtn shrink-0" title={t('nvExportMd')}>
            <Save size={12}/>
          </button>
        </>
      ) : null}

      {useOverflowMenu && !isTrash ? (
        <div ref={menuRef} style={{ position: 'relative', flexShrink: 0 }}>
          <button
            type="button"
            className="btbtn"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            title={t('nvMoreActions')}
            onClick={() => setMenuOpen(v => !v)}
            style={{ color: menuOpen ? c.accent : c.textMuted }}
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
      ) : null}

      {isTrash
        ? <button onClick={onRestore} className="btbtn shrink-0" style={{ color: c.green }}><RotateCcw size={14}/></button>
        : <button onClick={onTrash} className="btbtn shrink-0"><Trash2 size={14}/></button>
      }
    </div>
  );
}
