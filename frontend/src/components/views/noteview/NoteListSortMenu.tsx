import { createPortal } from 'react-dom';
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { Calendar, Clock } from 'lucide-react';
import type { NoteChromeColors } from '../noteEditorTheme';
import type { NoteSortDirection, NoteSortField } from '../noteListSort';
import { toggleSortDirection } from '../noteListSort';
import { useTranslation } from '@/lib/i18n';

export const SORT_MENU_MAX_WIDTH_PX = 220;

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
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useLayoutEffect(() => {
    if (!open || isMobile || !anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const menuW = SORT_MENU_MAX_WIDTH_PX;
    let left = rect.right - menuW;
    left = Math.max(8, Math.min(left, window.innerWidth - menuW - 8));
    let top = rect.bottom + 4;
    const maxH = 320;
    if (top + maxH > window.innerHeight - 8) {
      top = Math.max(8, rect.top - maxH - 4);
    }
    setPos({ top, left });
  }, [open, isMobile, anchorRef]);

  useEffect(() => {
    if (!open || isMobile) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open, isMobile, onClose, anchorRef]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || isMobile) return;
    const menu = menuRef.current;
    if (!menu) return;
    const focusables = () =>
      Array.from(menu.querySelectorAll<HTMLElement>('button:not([disabled])'));
    focusables()[0]?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    menu.addEventListener('keydown', onKeyDown);
    return () => menu.removeEventListener('keydown', onKeyDown);
  }, [open, isMobile]);

  if (!open) return null;

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

  if (isMobile) {
    return createPortal(
      <div
        className="fixed inset-0 z-[200] flex flex-col justify-end bg-black/40"
        data-k104-sort-sheet
        data-k116-sort-backdrop
        onClick={onClose}
        role="presentation"
      >
        <div
          ref={menuRef}
          role="dialog"
          aria-modal="true"
          aria-label={t('nvSort')}
          className="rounded-t-2xl p-4 pb-8 shadow-2xl"
          style={{ background: c.card, borderTop: `1px solid ${c.sideBdr}`, maxWidth: '100%' }}
          onClick={e => e.stopPropagation()}
          data-k104-sort-menu
          data-k116-sort-menu
        >
          <p style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, marginBottom: 8 }}>{t('nvSort')}</p>
          {items}
        </div>
      </div>,
      document.body,
    );
  }

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[299]"
        data-k116-sort-backdrop
        aria-hidden
        onClick={onClose}
      />
      <div
        ref={menuRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('nvSort')}
        className="bsort-menu"
        data-k104-sort-menu
        data-k116-sort-menu
        style={{
          position: 'fixed',
          top: pos.top,
          left: pos.left,
          width: SORT_MENU_MAX_WIDTH_PX,
          maxWidth: SORT_MENU_MAX_WIDTH_PX,
          zIndex: 300,
          background: c.card,
          border: `1px solid ${c.sideBdr}`,
          borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {items}
      </div>
    </>,
    document.body,
  );
}
