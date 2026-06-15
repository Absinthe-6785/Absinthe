import { useEffect, useRef } from 'react';
import { Copy, Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';

export interface AgendaItemActionMenuProps {
  open: boolean;
  anchor: { x: number; y: number } | null;
  title: string;
  onEdit?: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onClose: () => void;
}

/** Compact popover for edit / delete / duplicate — no route change. */
export function AgendaItemActionMenu({
  open,
  anchor,
  title,
  onEdit,
  onDelete,
  onDuplicate,
  onClose,
}: AgendaItemActionMenuProps) {
  const { t } = useTranslation();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (panelRef.current?.contains(e.target as Node)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open || !anchor) return null;

  const left = Math.min(anchor.x, window.innerWidth - 168);
  const top = Math.min(anchor.y + 6, window.innerHeight - 140);

  const itemClass = 'w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-semibold hover:bg-surface-alt transition-colors';

  return (
    <div
      ref={panelRef}
      role="menu"
      aria-label={title}
      className="fixed z-[120] min-w-[152px] rounded-lg border border-border bg-surface shadow-lg py-1"
      style={{ left, top }}
      data-planner-agenda-action-menu
    >
      {onEdit ? (
        <button type="button" role="menuitem" className={itemClass} onClick={() => { onEdit(); onClose(); }}>
          <Pencil size={13} />
          {t('k79AgendaEdit')}
        </button>
      ) : null}
      {onDuplicate ? (
        <button type="button" role="menuitem" className={itemClass} onClick={() => { onDuplicate(); onClose(); }}>
          <Copy size={13} />
          {t('k79AgendaDuplicate')}
        </button>
      ) : null}
      {onDelete ? (
        <button
          type="button"
          role="menuitem"
          className={`${itemClass} text-red-500 hover:text-red-600`}
          onClick={() => { onDelete(); onClose(); }}
        >
          <Trash2 size={13} />
          {t('k79AgendaDelete')}
        </button>
      ) : null}
    </div>
  );
}
