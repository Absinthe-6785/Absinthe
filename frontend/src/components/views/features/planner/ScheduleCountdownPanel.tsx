import { Target, Plus, BookOpen } from 'lucide-react';
import type { PlannerCountdownRow, PlannerCalendarPresentation } from './calendar';
import { formatPlannerCountdownLabel } from './calendar/plannerCalendarPresentation';
import { useTranslation } from '../../../../lib/i18n';
import { EmptyState } from '../../../common/EmptyState';
import type { Theme } from '../../../../types';

export interface ScheduleCountdownPanelProps {
  countdowns: readonly PlannerCountdownRow[];
  presentation: PlannerCalendarPresentation;
  theme: Theme;
  onNoteClick?: (noteId: string) => void;
  onAddCountdown?: () => void;
}

export function ScheduleCountdownPanel({
  countdowns,
  presentation,
  theme,
  onNoteClick,
  onAddCountdown,
}: ScheduleCountdownPanelProps) {
  const { t } = useTranslation();

  return (
    <div
      className={`rounded-[24px] lg:rounded-[32px] p-5 lg:p-6 flex flex-col shrink-0 transition-colors ${theme.card}`}
      data-schedule-countdown-panel
    >
      <div className="flex justify-between items-center mb-2">
        <h2 className="font-heading text-base lg:text-lg font-bold flex items-center gap-2">
          <Target size={18} strokeWidth={2.25} className="text-red-500" />
          {t('scheduleCountdownTitle')}
        </h2>
        {onAddCountdown ? (
          <button
            onClick={onAddCountdown}
            className="bg-primary text-primary-foreground px-2.5 py-1.5 rounded-xl text-xs font-bold"
            title={t('scheduleCountdownAddNote')}
          >
            <Plus size={14} className="inline mr-1" />
            {t('add')}
          </button>
        ) : null}
      </div>

      <p className={`text-[10px] lg:text-xs mb-3 ${theme.textMuted}`}>
        {t('scheduleCountdownNoteHint')}
      </p>

      <div className="max-h-[200px] overflow-y-auto pr-1 space-y-2">
        {countdowns.length === 0 ? (
          <EmptyState
            theme={theme}
            icon={Target}
            text={t('scheduleCountdownEmpty')}
            onClick={onAddCountdown}
          />
        ) : (
          countdowns.map(countdown => {
            const label = formatPlannerCountdownLabel(countdown.daysUntil, presentation.locale);
            return (
              <div
                key={countdown.id}
                className={`group flex justify-between items-center border-b ${theme.border} pb-2.5
                  ${onNoteClick ? 'cursor-pointer hover:opacity-80' : ''}`}
                onClick={onNoteClick ? () => onNoteClick(countdown.sourceRefId) : undefined}
                onKeyDown={onNoteClick ? e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onNoteClick(countdown.sourceRefId);
                  }
                } : undefined}
                role={onNoteClick ? 'button' : undefined}
                tabIndex={onNoteClick ? 0 : undefined}
                data-schedule-countdown-note={countdown.sourceRefId}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                  <BookOpen size={13} className="shrink-0 text-primary" strokeWidth={2.25} />
                  <p className="text-sm font-semibold truncate">{countdown.title}</p>
                </div>
                <span className="font-heading text-xs font-bold bg-primary text-primary-foreground px-2.5 py-1 rounded-xl shrink-0">
                  {label}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
