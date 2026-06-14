import {
  Apple, Dumbbell, Activity, BedDouble, Lock, Scale, ChevronRight, Check, TrendingUp,
} from 'lucide-react';
import { useTranslation } from '../../../../lib/i18n';
import type { ExerciseBlock, HealthRoutine, Inbody, Workout, Theme } from '../../../../types';
import type { HealthWorkspaceSection } from './HealthWorkspaceNav';
import { useProteinData } from './hooks/useProteinData';
import { useWorkoutRangeMetrics } from './hooks/useWorkoutRangeMetrics';
import { useHabitMetrics } from './hooks/useHabitMetrics';
import { useRecoveryMetrics } from './hooks/useRecoveryMetrics';

export interface HealthDashboardPanelProps {
  theme: Theme;
  selectedDate: Date;
  formatDate: (d: Date) => string;
  workouts: readonly Workout[];
  inbody: Inbody | null;
  healthBlocks: readonly ExerciseBlock[];
  healthRoutines: readonly HealthRoutine[];
  isWorkoutLocked: boolean;
  onNavigate: (section: HealthWorkspaceSection) => void;
  onOpenRoutine?: () => void;
  onOpenWorkoutHistory?: () => void;
}

export function HealthDashboardPanel({
  theme,
  selectedDate,
  formatDate,
  workouts,
  inbody,
  healthBlocks,
  healthRoutines,
  isWorkoutLocked,
  onNavigate,
  onOpenRoutine,
  onOpenWorkoutHistory,
}: HealthDashboardPanelProps) {
  const { t } = useTranslation();
  const dateStr = formatDate(selectedDate);

  const {
    dailyTarget,
    totalIntake,
    proteinPct,
    intakeLogs,
    weeklyProteinAvg,
    proteinStreak,
    goalConsistency,
  } = useProteinData(dateStr, selectedDate, formatDate);

  const { weeklySessions, recentPr, recentSessions } =
    useWorkoutRangeMetrics(dateStr, selectedDate, formatDate);
  const { todayRoutine, todayDayName, metrics: habitMetrics, isCompleted, toggleToday } =
    useHabitMetrics(healthRoutines, selectedDate, formatDate);
  const recovery = useRecoveryMetrics(selectedDate, formatDate);

  const completedSets = workouts.reduce((sum, w) =>
    sum + w.sets.filter(s => s.done).length, 0);
  const totalSets = workouts.reduce((sum, w) => sum + w.sets.length, 0);

  const recentMeals = intakeLogs.slice(-3).reverse();
  const lastExercise = workouts.length > 0 ? workouts[workouts.length - 1].exercise_blocks?.name : null;
  const proteinTrend = totalIntake >= dailyTarget ? 'up' : weeklyProteinAvg > 0 && totalIntake >= weeklyProteinAvg ? 'steady' : 'down';

  const cardClass = `rounded-[20px] p-4 ${theme.card} border ${theme.border}`;

  const SectionLink = ({
    section,
    icon: Icon,
    title,
    children,
    onClickOverride,
  }: {
    section: HealthWorkspaceSection;
    icon: typeof Apple;
    title: string;
    children: React.ReactNode;
    onClickOverride?: () => void;
  }) => (
    <button
      type="button"
      onClick={onClickOverride ?? (() => onNavigate(section))}
      className={`${cardClass} text-left w-full hover:opacity-90 transition-opacity focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary`}
      data-health-dashboard-section={section}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-heading text-sm font-bold flex items-center gap-2">
          <Icon size={16} strokeWidth={2.25} className="text-primary" />
          {title}
        </h3>
        <ChevronRight size={14} className={theme.textMuted} />
      </div>
      {children}
    </button>
  );

  return (
    <div className="flex-1 min-h-0 overflow-y-auto pb-4" data-health-dashboard-panel>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:gap-4">
        <SectionLink section="nutrition" icon={Apple} title={t('healthNavNutrition')}>
          {dailyTarget > 0 ? (
            <>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-2xl font-bold tabular-nums">{totalIntake}g</span>
                <span className={`text-xs ${theme.textMuted}`}>/ {dailyTarget}g</span>
                {proteinTrend === 'up' ? (
                  <TrendingUp size={12} className="text-green-500" />
                ) : null}
              </div>
              <div className="h-2 rounded-full bg-surface-alt overflow-hidden mb-2">
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${proteinPct}%` }} />
              </div>
              {recentMeals.length > 0 ? (
                <ul className={`text-xs ${theme.textMuted} space-y-0.5`}>
                  {recentMeals.map(log => (
                    <li key={log.id} className="truncate">
                      {log.protein_sources?.name ?? log.note ?? '—'} · {log.protein_g}g
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={`text-xs ${theme.textMuted}`}>{t('healthDashboardNoMeals')}</p>
              )}
              {weeklyProteinAvg > 0 ? (
                <p className={`text-[10px] mt-1 ${theme.textMuted}`}>
                  {t('healthDashboardWeeklyProtein').replace('{avg}', String(weeklyProteinAvg))}
                </p>
              ) : null}
              {goalConsistency > 0 ? (
                <p className={`text-[10px] mt-0.5 ${theme.textMuted}`}>
                  {t('healthDashboardGoalConsistency').replace('{pct}', String(goalConsistency))}
                </p>
              ) : null}
              {proteinStreak > 0 ? (
                <p className={`text-[10px] mt-0.5 ${theme.textMuted}`}>
                  {t('healthDashboardProteinStreak').replace('{days}', String(proteinStreak))}
                </p>
              ) : null}
            </>
          ) : (
            <p className={`text-xs ${theme.textMuted}`}>{t('healthDashboardProteinSetup')}</p>
          )}
        </SectionLink>

        <SectionLink
          section="workout"
          icon={Dumbbell}
          title={t('healthNavWorkout')}
          onClickOverride={onOpenWorkoutHistory}
        >
          <div className="flex items-center gap-3 mb-1">
            <span className="text-2xl font-bold tabular-nums">{workouts.length}</span>
            <span className={`text-xs ${theme.textMuted}`}>{t('healthDashboardExercises')}</span>
            {isWorkoutLocked && (
              <span className="flex items-center gap-1 text-xs font-semibold text-green-500">
                <Lock size={12} /> {t('healthDashboardLocked')}
              </span>
            )}
          </div>
          {totalSets > 0 ? (
            <p className={`text-xs ${theme.textMuted}`}>
              {t('healthDashboardSetsProgress').replace('{done}', String(completedSets)).replace('{total}', String(totalSets))}
            </p>
          ) : (
            <p className={`text-xs ${theme.textMuted}`}>{t('healthDashboardNoWorkout')}</p>
          )}
          {weeklySessions > 0 ? (
            <p className={`text-[10px] mt-1 ${theme.textMuted}`}>
              {t('healthDashboardWeeklyVolume').replace('{count}', String(weeklySessions))}
            </p>
          ) : null}
          {lastExercise ? (
            <p className={`text-[10px] mt-0.5 ${theme.textMuted}`}>
              {t('healthDashboardLastExercise').replace('{name}', lastExercise)}
            </p>
          ) : null}
          {recentPr ? (
            <p className={`text-[10px] mt-0.5 text-primary font-semibold`}>
              {t('healthDashboardRecentPr').replace('{name}', recentPr.name).replace('{kg}', String(recentPr.kg))}
            </p>
          ) : null}
          {recentSessions.length > 0 ? (
            <ul className={`text-[10px] mt-1 ${theme.textMuted} space-y-0.5`}>
              {recentSessions.slice(0, 2).map(s => (
                <li key={s.date} className="truncate">
                  {s.date}: {s.exercises.slice(0, 2).join(', ')}
                </li>
              ))}
            </ul>
          ) : null}
        </SectionLink>

        <SectionLink
          section="habits"
          icon={Activity}
          title={t('healthNavHabits')}
          onClickOverride={onOpenRoutine}
        >
          {todayRoutine ? (
            <>
              <div className="flex items-center justify-between gap-2 mb-1">
                <p className={`text-xs font-semibold ${theme.text}`}>
                  {t('healthDashboardTodayHabit').replace('{day}', todayDayName)}
                </p>
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); toggleToday(); }}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-colors
                    ${isCompleted ? 'bg-green-500/15 text-green-600 border-green-500/30' : `${theme.border} ${theme.textMuted}`}`}
                  data-health-habit-toggle
                >
                  <Check size={11} strokeWidth={2.5} />
                  {isCompleted ? t('healthDashboardHabitDone') : t('healthDashboardHabitMark')}
                </button>
              </div>
              <p className={`text-[10px] ${theme.textMuted}`}>
                {t('healthDashboardHabitBlocks').replace('{count}', String(todayRoutine.blocks.length))}
              </p>
              {habitMetrics ? (
                <>
                  <p className={`text-[10px] mt-1 ${theme.textMuted}`}>
                    {t('healthDashboardHabitStats')
                      .replace('{streak}', String(habitMetrics.streak))
                      .replace('{rate}', String(habitMetrics.completionRate))}
                  </p>
                  {habitMetrics.streak >= 3 ? (
                    <p className={`text-[10px] mt-0.5 text-primary font-semibold`}>
                      {t('healthDashboardHabitMomentum')}
                    </p>
                  ) : null}
                </>
              ) : null}
            </>
          ) : (
            <>
              <p className={`text-xs ${theme.textMuted}`}>{t('healthDashboardNoHabitRoutine')}</p>
              <p className={`text-[10px] mt-1 ${theme.textMuted}`}>
                {t('healthDashboardHabitToday')
                  .replace('{blocks}', String(healthBlocks.length))
                  .replace('{routines}', String(healthRoutines.length))}
              </p>
            </>
          )}
        </SectionLink>

        <SectionLink section="recovery" icon={BedDouble} title={t('healthNavRecovery')}>
          {recovery.latestSleep != null ? (
            <p className={`text-xs mb-1`}>
              <span className="text-2xl font-bold tabular-nums">{recovery.latestSleep}</span>
              <span className={`text-xs ml-1 ${theme.textMuted}`}>h {t('k54RecoveryLatestSleep')}</span>
            </p>
          ) : null}
          {inbody && (inbody.weight > 0 || inbody.smm > 0 || inbody.pbf > 0) ? (
            <div className="flex items-center gap-3">
              <Scale size={16} strokeWidth={2.25} className="text-primary shrink-0" />
              <div className={`text-xs ${theme.textMuted} space-y-0.5`}>
                <p>{t('inbodyWeight')}: <span className="font-semibold text-foreground">{inbody.weight} kg</span></p>
                <p>SMM: <span className="font-semibold text-foreground">{inbody.smm} kg</span> · PBF: <span className="font-semibold text-foreground">{inbody.pbf}%</span></p>
              </div>
            </div>
          ) : !recovery.latestSleep ? (
            <p className={`text-xs ${theme.textMuted}`}>{t('healthDashboardNoInbody')}</p>
          ) : null}
          {recovery.avgSleep ? (
            <p className={`text-[10px] mt-1 ${theme.textMuted}`}>
              {t('healthDashboardAvgSleep').replace('{hours}', String(recovery.avgSleep))}
            </p>
          ) : null}
          {recovery.trend ? (
            <p className={`text-[10px] mt-0.5 ${theme.textMuted}`}>
              {recovery.trend === 'up' ? t('k54RecoveryTrendUp')
                : recovery.trend === 'down' ? t('k54RecoveryTrendDown')
                  : t('k54RecoveryTrendSteady')}
            </p>
          ) : null}
          {recovery.latestNote ? (
            <p className={`text-[10px] mt-0.5 ${theme.textMuted} truncate`}>
              {t('healthDashboardRecoveryNote')}: {recovery.latestNote}
            </p>
          ) : null}
          {isWorkoutLocked && (
            <p className={`text-xs mt-1 text-green-500 font-medium`}>{t('healthDashboardRestDay')}</p>
          )}
        </SectionLink>
      </div>
    </div>
  );
}
