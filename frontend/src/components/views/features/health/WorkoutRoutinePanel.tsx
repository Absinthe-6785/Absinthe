import type { ExerciseBlock, HealthRoutine, Theme } from '../../../../types';
import { useTranslation } from '../../../../lib/i18n';
import { WORKSPACE_CARD } from '../../../common/workspaceCardSizes';
import { showsPlannedSetCount, getRoutinePlannedSetCount } from './routinePlannedSets';

export interface WorkoutRoutinePanelProps {
  theme: Theme;
  mobileVisible: boolean;
  splitCount: number;
  splitCountInput: string;
  setSplitCountInput: (v: string) => void;
  onSplitCountCommit: (n: number) => void;
  healthRoutines: HealthRoutine[] | undefined;
  healthBlocks: ExerciseBlock[] | undefined;
  prevData: Record<string, { prev_sets?: import('../../../../types').WorkoutSet[]; prev_date?: string | null; pr_kg?: number | null }>;
  onOpenAssemble: (dayName: string) => void;
}

/** K-125F — routine setup panel (no persistent delete controls). */
export function WorkoutRoutinePanel({
  theme,
  mobileVisible,
  splitCount,
  splitCountInput,
  setSplitCountInput,
  onSplitCountCommit,
  healthRoutines,
  healthBlocks,
  prevData,
  onOpenAssemble,
}: WorkoutRoutinePanelProps) {
  const { t } = useTranslation();

  return (
    <div
      className={`lg:flex-1 ${WORKSPACE_CARD.md} rounded-[24px] lg:rounded-[32px] shadow-sm p-4 lg:p-5 flex flex-col transition-colors ${theme.card} ${mobileVisible ? '' : 'hidden lg:flex'}`}
      data-k125c-health-immediate="routine"
      data-k125f-routine-panel
    >
      <div className="flex justify-between items-center mb-3">
        <h2 className="font-heading text-lg font-bold">{t('routineSetup')}</h2>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl ${theme.input}`}>
          <input
            type="number"
            inputMode="numeric"
            min="1"
            max="7"
            value={splitCountInput}
            onChange={e => setSplitCountInput(e.target.value)}
            onBlur={() => onSplitCountCommit(Math.min(7, Math.max(1, Number(splitCountInput) || 1)))}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                onSplitCountCommit(Math.min(7, Math.max(1, Number(splitCountInput) || 1)));
                (e.target as HTMLInputElement).blur();
              }
            }}
            className="w-8 bg-transparent text-lg font-bold outline-none text-center tabular-nums"
          />
          <span className={`text-xs font-semibold ${theme.textMuted}`}>{t('splits')}</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-2 gap-2 lg:gap-2.5">
        {Array.from({ length: splitCount }).map((_, i) => {
          const dayName = `Day ${i + 1}`;
          const routine = healthRoutines?.find(r => r.day_name === dayName);
          const blocks = (routine?.blocks ?? [])
            .map(id => healthBlocks?.find(b => b.id === id))
            .filter((b): b is ExerciseBlock => !!b);
          return (
            <div key={dayName} className={`rounded-xl p-2.5 border ${theme.border}`}>
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-heading text-sm font-bold">{dayName}</h3>
                <button type="button" onClick={() => onOpenAssemble(dayName)} className="text-[11px] text-blue-500 font-bold">
                  {t('assembleBtn')}
                </button>
              </div>
              <div className="flex flex-col gap-1 min-h-[24px]">
                {blocks.length === 0 ? (
                  <span className={`text-[10px] ${theme.textMuted}`}>—</span>
                ) : blocks.map(b => (
                  <div key={b.id} className="flex items-center justify-between gap-2 text-[11px] font-semibold">
                    <span className="truncate">{b.name}</span>
                    {showsPlannedSetCount(b.type) ? (
                      <span className={`shrink-0 tabular-nums ${theme.textMuted}`}>
                        {t('k76SetCount').replace('{count}', String(getRoutinePlannedSetCount(dayName, b.id, b.type, prevData[b.id]?.prev_sets)))}
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
