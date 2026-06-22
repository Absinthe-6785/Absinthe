import { type ReactNode } from 'react';
import {
  Star, Copy, AlignLeft, Search, Trash2, RotateCcw,
} from 'lucide-react';
import type { NoteChromeColors } from '../noteEditorTheme';
import type { EditorMode } from '../editorMode';
import { useTranslation } from '@/lib/i18n';
import { UI_INTERACTION } from '@/lib/uiInteractionTokens';
import { NotesActionMenu, type NotesActionMenuItem } from './NotesActionMenu';

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
  /** K-126C — primary actions live in the unified header action row. */
  layout?: 'header-bar' | 'trash';
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
  onOpenSettings: _onOpenSettings,
  onOpenAppearance,
  onOpenHelp,
  layout = 'header-bar',
}: NoteEditorHeaderActionsProps) {
  const { t } = useTranslation();

  const iconBtnStyle = {
    width: isMobile ? UI_INTERACTION.touchTargetMinPx : ACTION_BTN_SIZE,
    height: isMobile ? UI_INTERACTION.touchTargetMinPx : ACTION_BTN_SIZE,
    minWidth: isMobile ? UI_INTERACTION.touchTargetMinPx : ACTION_BTN_SIZE,
    padding: 0,
    display: 'inline-flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexShrink: 0,
    borderRadius: 6,
  };

  const overflowItems: NotesActionMenuItem[] = !isTrash ? [
    ...viewModeButtons.map(({ key }) => ({
      key: `view-${key}`,
      label: key === 'reading' ? t('nvReadingMode') : t('nvGraphMode'),
      onClick: () => onViewModeToggle(key),
      accent: (key === 'reading' ? viewMode === 'reading' : viewMode === 'graph'),
    })),
    {
      key: 'event',
      label: isEvent ? t('nvEditEvent') : t('nvMarkEvent'),
      onClick: onMarkEvent,
    },
    {
      key: 'milestone',
      label: isMilestone ? t('nvEditMilestone') : t('nvMarkMilestone'),
      onClick: onMarkMilestone,
    },
    ...((isArea || canMarkArea) ? [{
      key: 'area',
      label: isArea ? t('nvClearArea') : t('nvMarkArea'),
      onClick: onToggleArea,
    }] : []),
    ...(onToggleWeakTopic ? [{
      key: 'weak',
      label: isWeakTopic ? t('knWeakTopicActive') : t('knWeakTopicInactive'),
      onClick: onToggleWeakTopic,
      danger: isWeakTopic,
    }] : []),
    { key: 'duplicate', label: t('nvDuplicate'), onClick: onDuplicate },
    { key: 'trash', label: t('trash'), onClick: onTrash },
    { key: 'export', label: t('nvExportMd'), onClick: onExport },
    ...(onOpenAppearance ? [{ key: 'appearance', label: t('nvAppearance'), onClick: onOpenAppearance }] : []),
    ...(onOpenHelp ? [{ key: 'help', label: t('nvShortcuts'), onClick: onOpenHelp }] : []),
  ] : [];

  if (layout === 'trash') {
    return (
      <div
        data-note-editor-header-actions
        data-k108-header-actions
        data-k108-header-layout="normalized"
        data-note-header-actions-row
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: ACTION_GAP,
          flexShrink: 0,
          flexWrap: 'wrap',
          minWidth: 0,
          justifyContent: 'flex-end',
        }}
      >
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
            <RotateCcw size={14} />
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
              <Trash2 size={14} />
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div
      data-note-editor-header-actions
      data-k108-header-actions
      data-k108-header-layout="normalized"
      data-note-header-actions-row
      data-k126c-header-primary-actions
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: ACTION_GAP,
        flexShrink: 0,
        flexWrap: 'nowrap',
        minWidth: 0,
        justifyContent: 'flex-end',
      }}
    >
      {onOpenDocumentSearch ? (
        <button
          type="button"
          onClick={onOpenDocumentSearch}
          className="btbtn shrink-0"
          title={t('nvDocumentSearch')}
          style={iconBtnStyle}
          data-read-mode-search-btn
          data-k126c-header-find
        >
          <Search size={14} />
        </button>
      ) : null}

      <button
        onClick={onToggleStar}
        className="btbtn shrink-0"
        title={starred ? t('nvUnstar') : t('nvStar')}
        style={iconBtnStyle}
        data-k126c-header-star
      >
        <Star size={14} color={starred ? c.accent : c.textMuted} fill={starred ? c.accent : 'none'} />
      </button>

      <button
        onClick={() => void onCopyDocument()}
        className="btbtn shrink-0"
        title={docCopied ? t('nvCopied') : t('nvCopyDocument')}
        style={{ ...iconBtnStyle, color: docCopied ? c.green : c.textMuted }}
        data-k126c-header-copy
      >
        <Copy size={14} />
      </button>

      <button
        onClick={onTogglePanel}
        className={`btbtn shrink-0${isMobile ? ' btbtn-mobile' : ''}`}
        title={t('nvTogglePanel')}
        style={{ ...iconBtnStyle, color: showRightPanel ? c.accent : c.textMuted }}
        data-k126c-header-panel
      >
        <AlignLeft size={14} />
      </button>

      <NotesActionMenu
        colors={c}
        isMobile={isMobile}
        title={t('nvMoreActions')}
        items={overflowItems}
        iconBtnStyle={iconBtnStyle}
      />
    </div>
  );
}
