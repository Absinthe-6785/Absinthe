import { useCallback, useEffect, useMemo, useState } from 'react';
import { BedDouble, Moon, TrendingDown, TrendingUp, Minus, FileText } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import type { Theme } from '@/types';
import {
  getRecoveryEntry,
  getRecoveryHistory,
  setRecoveryEntry,
  RECOVERY_LOG_CHANGED,
  type SleepQuality,
} from './recovery/recoveryNotes';
import { useRecoveryMetrics } from './hooks/useRecoveryMetrics';

export interface RecoveryLogPanelProps {
  theme: Theme;
  selectedDate: Date;
  formatDate: (d: Date) => string;
  isWorkoutLocked: boolean;
  onOpenDayNote?: () => void;
}

const QUALITY_OPTIONS: SleepQuality[] = [1, 2, 3, 4, 5];

export function RecoveryLogPanel({
  theme,
  selectedDate,
  formatDate,
  isWorkoutLocked,
  onOpenDayNote,
}: RecoveryLogPanelProps) {
  const { t } = useTranslation();
  const dateStr = formatDate(selectedDate);
  const [, bump] = useState(0);

  useEffect(() => {
    const refresh = () => bump(v => v + 1);
    window.addEventListener(RECOVERY_LOG_CHANGED, refresh);
    return () => window.removeEventListener(RECOVERY_LOG_CHANGED, refresh);
  }, []);

  const entry = useMemo(() => getRecoveryEntry(dateStr), [dateStr, bump]);
  const metrics = useRecoveryMetrics(selectedDate, formatDate);
  const history = useMemo(
    () => getRecoveryHistory(selectedDate, formatDate, 7),
    [selectedDate, formatDate, bump],
  );

  const [sleepHours, setSleepHours] = useState('');
  const [sleepQuality, setSleepQuality] = useState<SleepQuality | ''>('');
  const [note, setNote] = useState('');
  const [restDayNote, setRestDayNote] = useState('');

  useEffect(() => {
    setSleepHours(entry?.sleepHours ? String(entry.sleepHours) : '');
    setSleepQuality(entry?.sleepQuality ?? '');
    setNote(entry?.note ?? '');
    setRestDayNote(entry?.restDayNote ?? '');
  }, [dateStr, entry]);

  const save = useCallback(() => {
    const hours = parseFloat(sleepHours);
    setRecoveryEntry(dateStr, {
      sleepHours: Number.isFinite(hours) && hours > 0 ? hours : undefined,
      sleepQuality: sleepQuality || undefined,
      note: note.trim() || undefined,
      restDayNote: restDayNote.trim() || undefined,
    });
    bump(v => v + 1);
  }, [dateStr, sleepHours, sleepQuality, note, restDayNote]);

  const TrendIcon = metrics.trend === 'up' ? TrendingUp
    : metrics.trend === 'down' ? TrendingDown
      : Minus;

  const trendColor = metrics.trend === 'up' ? 'text-green-500'
    : metrics.trend === 'down' ? 'text-red-400'
      : theme.textMuted;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto pb-4 space-y-4" data-recovery-log-panel>
      <div className={`rounded-[24px] p-5 lg:p-6 ${theme.card} border ${theme.border}`}>
        <div className="flex items-center gap-2 mb-4">
          <BedDouble size={18} className="text-primary" />
          <h2 className="font-heading text-lg font-bold">{t('k54RecoveryLogTitle')}</h2>
          <span className={`text-xs ml-auto ${theme.textMuted}`}>{dateStr}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <label className={`rounded-2xl p-3 ${theme.input}`}>
            <span className={`text-[10px] font-bold block mb-1 ${theme.textMuted}`}>
              {t('k54RecoverySleepHours')}
            </span>
            <div className="flex items-end gap-1">
              <input
                type="number"
                inputMode="decimal"
                min="0"
                max="24"
                step="0.5"
                value={sleepHours}
                onChange={e => setSleepHours(e.target.value)}
                placeholder="0"
                className="w-full bg-transparent text-xl font-bold outline-none tabular-nums"
              />
              <span className={`text-xs pb-0.5 ${theme.textMuted}`}>h</span>
            </div>
          </label>

          <div className={`rounded-2xl p-3 ${theme.input}`}>
            <span className={`text-[10px] font-bold block mb-2 ${theme.textMuted}`}>
              {t('k54RecoverySleepQuality')}
            </span>
            <div className="flex gap-1.5">
              {QUALITY_OPTIONS.map(q => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setSleepQuality(sleepQuality === q ? '' : q)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors
                    ${sleepQuality === q ? 'bg-primary text-primary-foreground' : `${theme.border} border ${theme.textMuted}`}`}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>

        <label className={`block rounded-2xl p-3 mb-3 ${theme.input}`}>
          <span className={`text-[10px] font-bold block mb-1 ${theme.textMuted}`}>
            {t('k54RecoveryNote')}
          </span>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={2}
            className="w-full bg-transparent text-sm outline-none resize-none"
            placeholder={t('k54RecoveryNotePlaceholder')}
          />
        </label>

        <label className={`block rounded-2xl p-3 mb-4 ${theme.input}`}>
          <span className={`text-[10px] font-bold block mb-1 ${theme.textMuted}`}>
            {t('k54RecoveryRestDayNote')}
          </span>
          <textarea
            value={restDayNote}
            onChange={e => setRestDayNote(e.target.value)}
            rows={2}
            className="w-full bg-transparent text-sm outline-none resize-none"
            placeholder={t('k54RecoveryRestDayPlaceholder')}
          />
        </label>

        <button
          type="button"
          onClick={save}
          className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold"
        >
          {t('save')}
        </button>

        {isWorkoutLocked && !restDayNote && (
          <p className={`text-xs mt-3 text-green-500 font-medium`}>{t('k54RecoveryRestDaySaved')}</p>
        )}
      </div>

      <div className={`rounded-[24px] p-5 ${theme.card} border ${theme.border}`}>
        <h3 className="font-heading text-sm font-bold mb-3 flex items-center gap-2">
          <Moon size={14} className="text-primary" />
          {t('k54RecoveryWeekSummary')}
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div className={`rounded-xl p-3 ${theme.input}`}>
            <p className={`text-[10px] font-bold ${theme.textMuted}`}>{t('k54RecoveryLatestSleep')}</p>
            <p className="text-xl font-bold tabular-nums mt-1">
              {metrics.latestSleep != null ? `${metrics.latestSleep}h` : '—'}
            </p>
          </div>
          <div className={`rounded-xl p-3 ${theme.input}`}>
            <p className={`text-[10px] font-bold ${theme.textMuted}`}>{t('k54RecoveryWeeklyAvg')}</p>
            <p className="text-xl font-bold tabular-nums mt-1">
              {metrics.avgSleep != null ? `${metrics.avgSleep}h` : '—'}
            </p>
          </div>
          <div className={`rounded-xl p-3 ${theme.input}`}>
            <p className={`text-[10px] font-bold ${theme.textMuted}`}>{t('k54RecoveryLoggedDays')}</p>
            <p className="text-xl font-bold tabular-nums mt-1">{metrics.loggedDays}</p>
          </div>
          <div className={`rounded-xl p-3 ${theme.input}`}>
            <p className={`text-[10px] font-bold ${theme.textMuted}`}>{t('k54RecoveryTrend')}</p>
            <div className={`flex items-center justify-center gap-1 mt-1 ${trendColor}`}>
              {metrics.trend ? <TrendIcon size={16} /> : null}
              <span className="text-sm font-bold">
                {metrics.trend === 'up' ? t('k54RecoveryTrendUp')
                  : metrics.trend === 'down' ? t('k54RecoveryTrendDown')
                    : metrics.trend === 'steady' ? t('k54RecoveryTrendSteady')
                      : '—'}
              </span>
            </div>
          </div>
        </div>
        {metrics.latestNote ? (
          <p className={`text-xs mt-3 ${theme.textMuted}`}>
            {t('k54RecoveryNote')}: {metrics.latestNote}
          </p>
        ) : null}
      </div>

      <div className={`rounded-[24px] p-5 ${theme.card} border ${theme.border}`}>
        <h3 className="font-heading text-sm font-bold mb-3">{t('k54RecoveryHistory')}</h3>
        <ul className="space-y-1.5">
          {history.map(row => (
            <li
              key={row.date}
              className={`flex items-center justify-between text-xs px-3 py-2 rounded-xl ${theme.input}`}
            >
              <span className={theme.textMuted}>{row.date}</span>
              <span className="font-semibold tabular-nums">
                {row.entry?.sleepHours ? `${row.entry.sleepHours}h` : '—'}
                {row.entry?.sleepQuality ? ` · Q${row.entry.sleepQuality}` : ''}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {onOpenDayNote ? (
        <button
          type="button"
          onClick={onOpenDayNote}
          className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold ${theme.input} border ${theme.border} ${theme.textMuted} hover:opacity-90 transition-opacity`}
        >
          <FileText size={14} />
          {t('healthOpenDayNote')}
        </button>
      ) : null}
    </div>
  );
}
