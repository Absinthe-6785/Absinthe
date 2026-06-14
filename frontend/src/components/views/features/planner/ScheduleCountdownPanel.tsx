import { Target, Plus, Edit2, Trash2, BookOpen } from 'lucide-react';
import type { DDay, Theme } from '../../../../types';
import type { PlannerCountdownRow, PlannerCalendarPresentation } from './calendar';
import { formatPlannerCountdownLabel } from './calendar/plannerCalendarPresentation';
import { useTranslation } from '../../../../lib/i18n';
import { EmptyState } from '../../../common/EmptyState';

export interface ScheduleCountdownPanelProps {
  countdowns: readonly PlannerCountdownRow[];
  presentation: PlannerCalendarPresentation;
  legacyDdays: readonly DDay[];
  theme: Theme;
  onNoteClick?: (noteId: string) => void;
  onAddLegacy?: () => void;
  onEditLegacy?: (dday: DDay) => void;
  onDeleteLegacy?: (id: string) => void;
}

export function ScheduleCountdownPanel({
  countdowns,
  presentation,
  legacyDdays,
  theme,
  onAddLegacy,
  onEditLegacy,
  onDeleteLegacy,
  onNoteClick,
}: ScheduleCountdownPanelProps) {
  const { t } = useTranslation();
  const noteBacked = countdowns.filter(c => c.source === 'note-event');
  const legacyBacked = countdowns.filter(c => c.source === 'legacy-dday');

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
        {onAddLegacy ? (
          <button
            onClick={onAddLegacy}
            className="bg-primary text-primary-foreground px-2.5 py-1.5 rounded-xl text-xs font-bold"
            title={t('scheduleCountdownLegacyAdd')}
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
            text={t('noDdays')}
            onClick={onAddLegacy}
          />
        ) : (
          <>
            {noteBacked.map(countdown => {
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
            })}

            {legacyBacked.map(countdown => {
              const label = formatPlannerCountdownLabel(countdown.daysUntil, presentation.locale);
              const legacy = legacyDdays.find(d => d.id === countdown.sourceRefId);
              return (
                <div
                  key={countdown.id}
                  className={`group flex justify-between items-center border-b ${theme.border} pb-2.5`}
                  data-schedule-countdown-legacy={countdown.id}
                >
                  <p className="text-sm font-semibold truncate flex-1 mr-2">{countdown.title}</p>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {legacy && onEditLegacy && onDeleteLegacy ? (
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => onEditLegacy(legacy)}
                          className={`p-1.5 rounded-lg ${theme.hoverBg} ${theme.textMuted} active:scale-95`}
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => onDeleteLegacy(legacy.id)}
                          className={`p-1.5 rounded-lg ${theme.hoverBg} ${theme.textMuted} active:scale-95`}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ) : null}
                    <span className="font-heading text-xs font-bold bg-primary text-primary-foreground px-2.5 py-1 rounded-xl shrink-0">
                      {label}
                    </span>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
