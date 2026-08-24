import type { StrengthSet, Theme, WorkoutSet } from '../../../../types';
import { isCardioSet, isStrengthSet } from '../../../../types';
import type { TranslationKey } from '../../../../lib/i18n';
import type { PreviousWorkoutSession } from './previousWorkoutSession';
import { formatSavedWeight } from './healthWeight';

export interface PreviousWorkoutViewProps {
  session: PreviousWorkoutSession | null;
  isLoading: boolean;
  hasError: boolean;
  theme: Theme;
  darkMode: boolean;
  t: (key: TranslationKey) => string;
  formatDate: (date: string) => string;
  formatWeight: (value: number | string, blockId: string) => string;
  weightUnit: (blockId: string) => 'kg' | 'lbs';
  onRetry: () => void;
}

function valueOrDash(value: string | number | undefined): string {
  return value === undefined || value === '' ? '—' : String(value);
}

export function formatPreviousStrengthWeight(
  set: StrengthSet,
  blockId: string,
  blockType: string,
  formatWeight: (value: number | string, blockId: string) => string,
  weightUnit: 'kg' | 'lbs',
  bodyweightLabel: string,
): string {
  if (set.type === 'bodyweight' || blockType === 'bodyweight') return bodyweightLabel;
  const value = formatSavedWeight(set, weightUnit) || formatWeight(set.kg, blockId);
  return valueOrDash(value) === '—' ? '—' : `${value} ${weightUnit}`;
}

function StrengthSetRow({ set, blockId, blockType, formatWeight, weightUnit, t, theme }: {
  set: WorkoutSet;
  blockId: string;
  blockType: string;
  formatWeight: (value: number | string, blockId: string) => string;
  weightUnit: (blockId: string) => 'kg' | 'lbs';
  t: (key: TranslationKey) => string;
  theme: Theme;
}) {
  if (!isStrengthSet(set)) return null;
  const weight = formatPreviousStrengthWeight(
    set,
    blockId,
    blockType,
    formatWeight,
    weightUnit(blockId),
    t('previousBodyweight'),
  );
  return (
    <div className={`grid grid-cols-[auto_1fr_1fr] items-center gap-2 rounded-xl border px-3 py-2.5 text-sm ${theme.border} ${theme.input}`}>
      <span className={`text-xs font-bold ${theme.textMuted}`}>{t('previousSetLabel').replace('{set}', String(set.set))}</span>
      <span className="text-center font-bold tabular-nums">{weight}</span>
      <span className="text-right font-semibold tabular-nums">{valueOrDash(set.reps)} {t('previousReps')}</span>
    </div>
  );
}

function CardioSetRow({ set, t, theme }: { set: WorkoutSet; t: (key: TranslationKey) => string; theme: Theme }) {
  if (!isCardioSet(set)) return null;
  const values = [
    set.time ? `${t('previousTime')} ${set.time}` : '',
    set.distance ? `${t('previousDistance')} ${set.distance}` : '',
    set.pace ? `${t('previousPace')} ${set.pace}` : '',
  ].filter(Boolean);
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border px-3 py-2.5 text-sm ${theme.border} ${theme.input}`}>
      <span className={`text-xs font-bold ${theme.textMuted}`}>{t('previousSetLabel').replace('{set}', String(set.set))}</span>
      {values.length > 0 ? values.map(value => <span key={value} className="font-semibold tabular-nums">{value}</span>) : <span className={theme.textMuted}>{t('previousNoValue')}</span>}
    </div>
  );
}

export function PreviousWorkoutView({
  session,
  isLoading,
  hasError,
  theme,
  darkMode,
  t,
  formatDate,
  formatWeight,
  weightUnit,
  onRetry,
}: PreviousWorkoutViewProps) {
  if (isLoading) {
    return <div className={`flex flex-1 items-center justify-center rounded-2xl border px-4 py-12 text-sm ${theme.border} ${theme.textMuted}`} data-health-previous-loading>{t('previousWorkoutLoading')}</div>;
  }

  if (hasError) {
    return (
      <div className={`flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl border px-4 py-12 text-center ${theme.border}`} data-health-previous-error>
        <p className="text-sm font-semibold">{t('previousWorkoutError')}</p>
        <button type="button" onClick={onRetry} className={`min-h-[44px] rounded-xl border px-4 py-2 text-sm font-bold ${theme.border} ${darkMode ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}>
          {t('previousWorkoutRetry')}
        </button>
      </div>
    );
  }

  if (!session) {
    return <div className={`flex flex-1 items-center justify-center rounded-2xl border border-dashed px-4 py-12 text-center text-sm ${theme.border} ${theme.textMuted}`} data-health-previous-empty>{t('previousWorkoutEmpty')}</div>;
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto space-y-3 pr-1" data-health-previous-workout>
      <div className={`rounded-2xl border px-4 py-3 ${theme.border} ${darkMode ? 'bg-surface/40' : 'bg-gray-50/70'}`}>
        <p className="font-heading text-lg font-bold">{t('previousWorkout')}</p>
        <p className={`mt-1 text-xs font-medium ${theme.textMuted}`}>{formatDate(session.date)}</p>
      </div>
      {session.rows.map(row => (
        <article key={`${row.date}-${row.blockId}-${row.rowId ?? row.sortOrder}`} className={`rounded-2xl border p-3 ${theme.border} ${theme.card}`}>
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 className="min-w-0 truncate font-heading text-base font-bold">{row.exerciseBlock.name}</h3>
            <span className={`shrink-0 text-[11px] font-semibold ${theme.textMuted}`}>{t('previousReadOnly')}</span>
          </div>
          <div className="space-y-2">
            {row.sets.map((set, index) => (
                isCardioSet(set)
                  ? <CardioSetRow key={`${set.set}-${index}`} set={set} t={t} theme={theme} />
                : <StrengthSetRow key={`${set.set}-${index}`} set={set} blockId={row.blockId} blockType={row.exerciseBlock.type} formatWeight={formatWeight} weightUnit={weightUnit} t={t} theme={theme} />
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}
