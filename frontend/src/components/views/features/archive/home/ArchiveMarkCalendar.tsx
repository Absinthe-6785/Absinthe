import { CalendarDays } from 'lucide-react';
import type { AppSettings, Theme } from '../../../../../types';
import { resolveAppLanguage, getTranslator } from '../../../../../lib/i18n';
import { switchToNotesTab } from '../../../../../lib/noteNavigation';
import type { ArchiveMarkCalendarProjection, ArchiveMarkDay } from '../../knowledge/archive';
import {
  archiveMarkCellColorClass,
  archiveMarkCellDensityLevel,
  archiveMarkCellIsException,
  formatArchiveMarkCalendarYearSpan,
  formatArchiveMarkDayTooltip,
  isArchiveMarkCalendarFuture,
  isArchiveMarkCalendarInRange,
} from './archiveMarkCalendarPresentation';

export interface ArchiveMarkCalendarProps {
  markCalendar: ArchiveMarkCalendarProjection;
  /** Last rendered day — typically projection.youAreHere.today */
  endDate: string;
  theme: Theme;
  appSettings: AppSettings;
  onDayClick?: (dateKey: string) => void;
  onMonthClick?: (year: number, month: number) => void;
}

const WEEKDAY_LABELS = ['M', '', 'W', '', 'F', '', 'S'] as const;

function buildMarkDayLookup(days: readonly ArchiveMarkDay[]): Map<string, ArchiveMarkDay> {
  return new Map(days.map(day => [day.date, day]));
}

export function ArchiveMarkCalendar({
  markCalendar,
  endDate,
  theme,
  appSettings,
  onDayClick,
  onMonthClick,
}: ArchiveMarkCalendarProps) {
  const t = getTranslator(resolveAppLanguage(appSettings.language));
  const weeks = markCalendar.weeks ?? [];
  const dayLookup = buildMarkDayLookup(markCalendar.days);
  const yearSpan = formatArchiveMarkCalendarYearSpan(markCalendar.years);
  const darkMode = appSettings.darkMode;

  const cellColor = (day: ArchiveMarkDay | undefined) =>
    archiveMarkCellColorClass(
      archiveMarkCellDensityLevel(day),
      archiveMarkCellIsException(day),
      darkMode,
    );

  return (
    <section
      className={`rounded-[24px] lg:rounded-[32px] shadow-sm p-5 lg:p-6 flex flex-col transition-colors ${theme.card}`}
      data-archive-mark-calendar
      data-archive-mark-calendar-empty={markCalendar.hasAnyMarks ? 'false' : 'true'}
      aria-label={t('archiveMarkCalendarTitle')}
    >
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="font-heading text-base font-bold flex items-center gap-2">
          <CalendarDays size={16} className="text-primary" strokeWidth={2.25} />
          {t('archiveMarkCalendarTitle')}
        </h2>
        {yearSpan && (
          <span className={`text-xs font-semibold ${theme.textMuted}`}>{yearSpan}</span>
        )}
      </div>

      {!markCalendar.hasAnyMarks ? (
        <div className="flex flex-col items-start gap-2" data-archive-mark-calendar-empty-message>
          <p className={`text-sm ${theme.textMuted}`}>
            {t('archiveMarkCalendarNoMarks')}
          </p>
          <p className={`text-xs ${theme.textMuted}`}>
            {t('archiveMarkCalendarEmptyHint')}
          </p>
          <button
            type="button"
            className="text-sm font-semibold text-primary hover:underline"
            onClick={() => switchToNotesTab()}
          >
            {t('archiveEmptyCta')}
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <p className={`text-xs mb-3 ${theme.textMuted}`} data-archive-mark-calendar-click-hint>
            {t('archiveMarkCalendarClickHint')}
          </p>
          <div className="min-w-[280px]">
            <div className="flex mb-1 pl-5">
              {weeks.map((_, weekIndex) => {
                const monthLabel = markCalendar.monthLabels.find(label => label.weekIndex === weekIndex);
                return (
                  <div key={weekIndex} className="flex-1 text-center">
                    {monthLabel && (
                      <button
                        type="button"
                        className={`text-[9px] font-semibold ${theme.textMuted} hover:text-primary transition-colors`}
                        title={`${monthLabel.label} ${monthLabel.year}`}
                        data-archive-mark-month={`${monthLabel.year}-${String(monthLabel.month).padStart(2, '0')}`}
                        onClick={() => onMonthClick?.(monthLabel.year, monthLabel.month)}
                      >
                        {monthLabel.label}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex gap-0">
              <div className="flex flex-col gap-0.5 mr-1">
                {WEEKDAY_LABELS.map((label, index) => (
                  <div
                    key={index}
                    className={`h-3.5 flex items-center text-[9px] font-semibold ${theme.textMuted}`}
                    style={{ width: '14px' }}
                  >
                    {label}
                  </div>
                ))}
              </div>

              {weeks.map((week, weekIndex) => (
                <div key={weekIndex} className="flex flex-col gap-0.5 flex-1 min-w-[11px]">
                  {week.map(dateKey => {
                    const inRange = isArchiveMarkCalendarInRange(
                      dateKey,
                      markCalendar.startDate,
                      markCalendar.endDate,
                    );
                    const isFuture = isArchiveMarkCalendarFuture(dateKey, endDate);
                    const day = dayLookup.get(dateKey);
                    const tooltip = formatArchiveMarkDayTooltip(day, dateKey);
                    const densityLevel = archiveMarkCellDensityLevel(day);

                    let cellClass = cellColor(day);
                    if (!inRange) {
                      cellClass = darkMode ? 'bg-gray-900/20' : 'bg-gray-50/50';
                    } else if (isFuture) {
                      cellClass = darkMode ? 'bg-gray-800/40' : 'bg-gray-50';
                    }

                    return (
                      <button
                        key={dateKey}
                        type="button"
                        title={tooltip}
                        aria-label={tooltip}
                        data-archive-mark-date={dateKey}
                        data-archive-mark-density={densityLevel}
                        data-archive-mark-types={day?.types.join(',') ?? ''}
                        className={`h-3.5 w-full rounded-[3px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${cellClass}`}
                        onClick={() => onDayClick?.(dateKey)}
                      />
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-1.5 mt-3">
              <span className={`text-[10px] ${theme.textMuted}`}>{t('archiveMarkDensityLow')}</span>
              {[0, 1, 2, 3].map(level => (
                <div
                  key={level}
                  className={`w-3 h-3 rounded-[3px] ${archiveMarkCellColorClass(level, false, darkMode)}`}
                />
              ))}
              <span className={`text-[10px] ${theme.textMuted}`}>{t('archiveMarkDensityHigh')}</span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
