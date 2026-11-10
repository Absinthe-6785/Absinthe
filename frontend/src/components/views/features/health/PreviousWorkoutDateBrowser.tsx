import type { Theme } from '../../../../types';
import type { Language, TranslationKey } from '../../../../lib/i18n';
import {
  formatPreviousWorkoutMonth,
  listPreviousWorkoutDatesInMonth,
  listPreviousWorkoutMonthOptions,
  resolvePreviousWorkoutMonth,
} from './previousWorkoutMonth';

export interface PreviousWorkoutDateBrowserProps {
  dates: readonly string[];
  selectedDate: string | null;
  language: Language;
  theme: Theme;
  t: (key: TranslationKey) => string;
  formatCompactDate: (date: string) => string;
  onSelectDate: (date: string) => void;
}

/** A derived month/date browser shared by legacy and source-qualified history. */
export function PreviousWorkoutDateBrowser({
  dates,
  selectedDate,
  language,
  theme,
  t,
  formatCompactDate,
  onSelectDate,
}: PreviousWorkoutDateBrowserProps) {
  const months = listPreviousWorkoutMonthOptions(dates);
  const selectedMonth = resolvePreviousWorkoutMonth(dates, selectedDate);
  const visibleDates = selectedMonth ? listPreviousWorkoutDatesInMonth(dates, selectedMonth) : [];

  return <>
    <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
      <p className={`text-xs font-bold ${theme.textMuted}`}>{t('previousWorkoutDates')}</p>
      {months.length > 0 && <label className={`inline-flex items-center gap-2 text-xs font-semibold ${theme.textMuted}`}>
        <span>{t('k42ViewMonth')}</span>
        <select
          value={selectedMonth ?? ''}
          disabled={months.length < 2}
          onChange={event => {
            const option = months.find(candidate => candidate.month === event.currentTarget.value);
            if (option) onSelectDate(option.latestDate);
          }}
          className={`min-h-[38px] max-w-[14rem] rounded-lg border px-2 py-1 text-sm font-semibold ${theme.border} ${theme.card} ${theme.text} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary`}
          data-health-previous-month-selector
        >
          {months.map(option => <option key={option.month} value={option.month}>
            {formatPreviousWorkoutMonth(option.month, language)}
          </option>)}
        </select>
      </label>}
    </div>
    <div className="flex max-w-full gap-2 overflow-x-auto pb-1" role="group" aria-label={t('previousWorkoutDates')}>
      {visibleDates.map(date => <button
        key={date}
        type="button"
        aria-pressed={date === selectedDate}
        onClick={() => onSelectDate(date)}
        className={`min-h-[42px] shrink-0 rounded-xl border px-3 py-2 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
          date === selectedDate ? 'border-primary bg-primary text-primary-foreground' : `${theme.border} ${theme.card} ${theme.textMuted}`
        }`}
        data-health-previous-date={date}
      >
        {formatCompactDate(date)}
      </button>)}
    </div>
  </>;
}
