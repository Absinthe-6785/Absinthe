import { useEffect, useState } from 'react';
import { Copy, Edit2, Trash2, X } from 'lucide-react';
import type { Theme } from '@/types';
import { useTranslation } from '@/lib/i18n';
import type { PlannerScheduleRow } from '../../calendar';
import { formatDayTimeRange } from './dayCalendarPresentation';

export interface ScheduleEventDetailPanelProps {
  block: PlannerScheduleRow;
  theme: Theme;
  dateLabel: string;
  notes?: string | null;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate?: () => void;
  onClose: () => void;
  variant?: 'sheet' | 'inline';
}

/** Schedule event detail — K-98A base, K-100 duplicate + keyboard shortcuts. */
export function ScheduleEventDetailPanel({
  block,
  theme,
  dateLabel,
  notes,
  onEdit,
  onDelete,
  onDuplicate,
  onClose,
  variant = 'sheet',
}: ScheduleEventDetailPanelProps) {
  const { t } = useTranslation();
  const [quickEdit, setQuickEdit] = useState(false);
  const [titleDraft, setTitleDraft] = useState(block.title);

  useEffect(() => {
    setTitleDraft(block.title);
    setQuickEdit(false);
  }, [block.id, block.title]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'e' || e.key === 'E') {
        if (e.target instanceof HTMLInputElement) return;
        e.preventDefault();
        onEdit();
      } else if ((e.key === 'd' || e.key === 'D') && onDuplicate) {
        e.preventDefault();
        onDuplicate();
      } else if (e.key === 'Delete') {
        e.preventDefault();
        onDelete();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, onEdit, onDelete, onDuplicate]);

  const shellClass = variant === 'inline'
    ? `rounded-2xl border p-4 flex flex-col gap-3 ${theme.border} ${theme.card}`
    : `rounded-[24px] lg:rounded-[28px] shadow-2xl p-5 lg:p-6 w-full max-w-[420px] ${theme.card}`;

  const content = (
    <div className={shellClass} data-schedule-event-detail onClick={e => e.stopPropagation()}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className={`text-[10px] font-bold uppercase tracking-wide mb-1 ${theme.textMuted}`}>
            {t('scheduleSectionSchedule')}
          </p>
          {quickEdit ? (
            <input
              autoFocus
              value={titleDraft}
              onChange={e => setTitleDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  setQuickEdit(false);
                  onEdit();
                }
                if (e.key === 'Escape') setQuickEdit(false);
              }}
              className={`w-full font-heading text-lg font-bold rounded-lg px-2 py-1 ${theme.input}`}
              data-schedule-event-quick-edit
            />
          ) : (
            <h3
              className="font-heading text-lg font-bold truncate cursor-text"
              onDoubleClick={() => setQuickEdit(true)}
              title={t('k100ScheduleQuickEditHint')}
            >
              {block.title}
            </h3>
          )}
        </div>
        {variant === 'sheet' ? (
          <button
            type="button"
            onClick={onClose}
            className={`shrink-0 min-h-[40px] min-w-[40px] flex items-center justify-center rounded-full ${theme.hoverBg}`}
            aria-label={t('close')}
          >
            <X size={18} />
          </button>
        ) : null}
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
        <dt className={`font-semibold ${theme.textMuted}`}>{t('k76ScheduleDate')}</dt>
        <dd className="font-medium">{dateLabel}</dd>
        <dt className={`font-semibold ${theme.textMuted}`}>{t('k98ScheduleTime')}</dt>
        <dd className="font-medium tabular-nums">
          {block.endNextDay
            ? `${block.startTime} → ${block.endTime} (+1)`
            : formatDayTimeRange(block.startTime, block.endTime)}
        </dd>
        <dt className={`font-semibold ${theme.textMuted}`}>{t('defaultCategory')}</dt>
        <dd className="font-medium capitalize">{block.category || '—'}</dd>
        <dt className={`font-semibold ${theme.textMuted}`}>{t('k98ScheduleNotes')}</dt>
        <dd className={`font-medium ${theme.textMuted}`}>{notes?.trim() || '—'}</dd>
      </dl>

      <p className={`text-[10px] ${theme.textMuted}`}>{t('k100ScheduleKeyboardHint')}</p>

      <div className="flex flex-wrap gap-2 pt-1 items-stretch" data-k102-schedule-detail-actions>
        <button
          type="button"
          onClick={onEdit}
          className="flex-1 min-w-[100px] max-w-full bg-primary text-primary-foreground font-bold rounded-xl py-2.5 px-3 text-sm flex items-center justify-center gap-2 k101-interactive"
          data-schedule-event-edit
        >
          <Edit2 size={16} />
          {t('edit')}
        </button>
        {onDuplicate ? (
          <button
            type="button"
            onClick={onDuplicate}
            className={`flex-1 min-w-[100px] max-w-full font-bold rounded-xl py-2.5 px-3 text-sm flex items-center justify-center gap-2 border k101-interactive ${theme.border}`}
            data-schedule-event-duplicate
          >
            <Copy size={16} />
            {t('k79AgendaDuplicate')}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onDelete}
          className="flex-1 min-w-[100px] max-w-full bg-red-500/10 text-red-500 font-bold rounded-xl py-2.5 px-3 text-sm flex items-center justify-center gap-2 border border-red-500/20 k101-interactive"
          data-schedule-event-delete
        >
          <Trash2 size={16} />
          {t('delete')}
        </button>
      </div>
    </div>
  );

  if (variant === 'inline') return content;

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-[110] p-0 sm:p-4 backdrop-blur-sm"
      onClick={onClose}
      data-schedule-event-detail-overlay
    >
      <div className="w-full sm:max-w-[420px] p-4 sm:p-0">{content}</div>
    </div>
  );
}
