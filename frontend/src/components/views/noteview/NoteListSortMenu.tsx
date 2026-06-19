import { Calendar, Clock } from 'lucide-react';
import type { RefObject } from 'react';
import type { NoteChromeColors } from '../noteEditorTheme';
import type { NoteSortDirection, NoteSortField } from '../noteListSort';
import { toggleSortDirection } from '../noteListSort';
import { useTranslation } from '@/lib/i18n';
import { POPOVER_MAX_WIDTH_PX, PopoverDismiss, PopoverPanel, PopoverPortal, PopoverRoot } from '@/components/common/popover/Popover';

export { POPOVER_MAX_WIDTH_PX as SORT_MENU_MAX_WIDTH_PX };

export interface NoteListSortMenuProps {
  colors: NoteChromeColors;
  anchorRef: RefObject<HTMLElement | null>;
  isMobile: boolean;
  open: boolean;
  sortOrder: NoteSortField;
  sortDirection: NoteSortDirection;
  starredFirst: boolean;
  onSortOrder: (field: NoteSortField) => void;
  onSortDirection: (dir: NoteSortDirection) => void;
  onStarredFirst: (value: boolean) => void;
  onClose: () => void;
}

export function NoteListSortMenu({
  colors: c,
  anchorRef,
  isMobile,
  open,
  sortOrder,
  sortDirection,
  starredFirst,
  onSortOrder,
  onSortDirection,
  onStarredFirst,
  onClose,
}: NoteListSortMenuProps) {
  const { t } = useTranslation();

  const items = (
    <>
      {(['updated', 'title', 'created', 'folder'] as const).map(s => (
        <button
          key={s}
          type="button"
          className={`bsort-item ${sortOrder === s ? 'active' : ''}`}
          style={{ width: '100%', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', padding: '8px 12px', fontSize: 12, color: c.text }}
          onClick={() => { onSortOrder(s); onClose(); }}
        >
          {s === 'updated' ? <><Clock size={10} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />{t('nvSortUpdated')}</> : s === 'title' ? t('nvSortTitle') : s === 'folder' ? t('k100SortFolder') : <><Calendar size={10} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />{t('nvSortCreated')}</>}
        </button>
      ))}
      <button
        type="button"
        className="bsort-item"
        style={{ width: '100%', textAlign: 'left', border: 'none', borderTop: `1px solid ${c.sideBdr}`, background: 'none', cursor: 'pointer', padding: '8px 12px', fontSize: 12, color: c.text }}
        onClick={() => { onStarredFirst(!starredFirst); onClose(); }}
      >
        {starredFirst ? '★ ' : '☆ '}{t('k100SortStarredFirst')}
      </button>
      <button
        type="button"
        className="bsort-item"
        style={{ width: '100%', textAlign: 'left', border: 'none', borderTop: `1px solid ${c.sideBdr}`, background: 'none', cursor: 'pointer', padding: '8px 12px', fontSize: 12, color: c.text }}
        onClick={() => { onSortDirection(toggleSortDirection(sortDirection)); onClose(); }}
      >
        {sortDirection === 'desc' ? t('nvSortDesc') : t('nvSortAsc')}
      </button>
    </>
  );

  const panelStyle = isMobile
    ? { background: c.card, borderTop: `1px solid ${c.sideBdr}`, maxWidth: '100%' as const }
    : {
        background: c.card,
        border: `1px solid ${c.sideBdr}`,
        borderRadius: 8,
        boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
      };

  return (
    <PopoverRoot open={open} onOpenChange={v => { if (!v) onClose(); }} isMobile={isMobile} anchorRef={anchorRef}>
      <PopoverPortal>
        {isMobile ? (
          <PopoverDismiss variant="sheet">
            <PopoverPanel aria-label={t('nvSort')} style={panelStyle}>
              <p style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, marginBottom: 8 }}>{t('nvSort')}</p>
              {items}
            </PopoverPanel>
          </PopoverDismiss>
        ) : (
          <>
            <PopoverDismiss />
            <PopoverPanel aria-label={t('nvSort')} style={panelStyle}>
              {items}
            </PopoverPanel>
          </>
        )}
      </PopoverPortal>
    </PopoverRoot>
  );
}
