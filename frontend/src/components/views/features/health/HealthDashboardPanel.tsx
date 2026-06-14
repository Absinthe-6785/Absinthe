import { useEffect, useState, type ReactNode } from 'react';
import {
  Apple, Dumbbell, Activity, BedDouble, Lock, Scale, ChevronRight,
} from 'lucide-react';
import { authFetch } from '../../../../lib/supabase';
import { API_URL } from '../../../../lib/config';
import { useTranslation } from '../../../../lib/i18n';
import type { ExerciseBlock, HealthRoutine, Inbody, Workout, WorkoutSet, Theme } from '../../../../types';
import { isStrengthSet } from '../../../../types';
import type { HealthWorkspaceSection } from './HealthWorkspaceNav';

interface ProteinProfile {
  daily_target_g: number;
  weight: number;
  goal: string;
  activity: string;
}

interface ProteinIntakeLog {
  id: string;
  protein_g: number;
  note?: string;
  protein_sources?: { name: string } | null;
}

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
}: HealthDashboardPanelProps) {
  const { t } = useTranslation();
  const dateStr = formatDate(selectedDate);

  const [profile, setProfile] = useState<ProteinProfile | null>(null);
  const [intakeLogs, setIntakeLogs] = useState<ProteinIntakeLog[]>([]);
  const [weeklySessions, setWeeklySessions] = useState(0);
  const [weeklyProteinAvg, setWeeklyProteinAvg] = useState(0);
  const [recentPr, setRecentPr] = useState<{ name: string; kg: number } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const weekStart = new Date(selectedDate);
        weekStart.setDate(weekStart.getDate() - 6);
        const startStr = formatDate(weekStart);
        const [pRes, iRes, wRes] = await Promise.all([
          authFetch(`${API_URL}/api/protein_profile`),
          authFetch(`${API_URL}/api/protein_intake?date=${dateStr}`),
          authFetch(`${API_URL}/api/workouts/range?start_date=${startStr}&end_date=${dateStr}`),
        ]);
        if (pRes.ok) {
          const p = await pRes.json();
          if (p?.daily_target_g) setProfile(p);
        }
        if (iRes.ok) setIntakeLogs(await iRes.json());
        else setIntakeLogs([]);
        if (wRes.ok) {
          const weekWorkouts = await wRes.json() as {
            date?: string;
            exercise_blocks: { name: string };
            sets: WorkoutSet[];
          }[];
          const dates = new Set(weekWorkouts.map(w => w.date).filter(Boolean));
          setWeeklySessions(dates.size);

          const priorMax = new Map<string, number>();
          const todayMax = new Map<string, number>();
          for (const w of weekWorkouts) {
            const name = w.exercise_blocks?.name ?? '';
            if (!name) continue;
            const bucket = w.date === dateStr ? todayMax : priorMax;
            for (const set of w.sets ?? []) {
              if (!isStrengthSet(set) || !set.done) continue;
              const kg = typeof set.kg === 'number' ? set.kg : parseFloat(String(set.kg));
              if (!kg || Number.isNaN(kg)) continue;
              bucket.set(name, Math.max(bucket.get(name) ?? 0, kg));
            }
          }
          let pr: { name: string; kg: number } | null = null;
          for (const [name, kg] of todayMax) {
            if (kg > (priorMax.get(name) ?? 0) && (!pr || kg > pr.kg)) {
              pr = { name, kg };
            }
          }
          setRecentPr(pr);
        } else {
          setWeeklySessions(0);
          setRecentPr(null);
        }

        const proteinDays: number[] = [];
        for (let i = 0; i < 7; i++) {
          const d = new Date(weekStart);
          d.setDate(d.getDate() + i);
          const ds = formatDate(d);
          try {
            const r = await authFetch(`${API_URL}/api/protein_intake?date=${ds}`);
            if (r.ok) {
              const logs = await r.json() as ProteinIntakeLog[];
              proteinDays.push(logs.reduce((s, l) => s + l.protein_g, 0));
            }
          } catch { /* skip day */ }
        }
        if (proteinDays.length > 0) {
          setWeeklyProteinAvg(Math.round(proteinDays.reduce((a, b) => a + b, 0) / proteinDays.length));
        }
      } catch { setIntakeLogs([]); }
    })();
  }, [dateStr, selectedDate, formatDate]);

  const dailyTarget = profile?.daily_target_g ?? 0;
  const totalIntake = Math.round(intakeLogs.reduce((s, l) => s + l.protein_g, 0) * 100) / 100;
  const proteinPct = dailyTarget > 0 ? Math.min(100, Math.round((totalIntake / dailyTarget) * 1000) / 10) : 0;

  const completedSets = workouts.reduce((sum, w) =>
    sum + w.sets.filter(s => s.done).length, 0);
  const totalSets = workouts.reduce((sum, w) => sum + w.sets.length, 0);

  const recentMeals = intakeLogs.slice(-3).reverse();
  const lastExercise = workouts.length > 0 ? workouts[workouts.length - 1].exercise_blocks?.name : null;

  const cardClass = `rounded-[20px] p-4 ${theme.card} border ${theme.border}`;

  const SectionLink = ({
    section,
    icon: Icon,
    title,
    children,
  }: {
    section: HealthWorkspaceSection;
    icon: typeof Apple;
    title: string;
    children: ReactNode;
  }) => (
    <button
      type="button"
      onClick={() => onNavigate(section)}
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
              </div>
              <div className="h-2 rounded-full bg-surface-alt overflow-hidden mb-2">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${proteinPct}%` }}
                  data-health-dashboard-protein-bar
                />
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
            </>
          ) : (
            <p className={`text-xs ${theme.textMuted}`}>{t('healthDashboardProteinSetup')}</p>
          )}
        </SectionLink>

        <SectionLink section="workout" icon={Dumbbell} title={t('healthNavWorkout')}>
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
        </SectionLink>

        <SectionLink section="habits" icon={Activity} title={t('healthNavHabits')}>
          <div className="flex gap-4">
            <div>
              <span className="text-xl font-bold tabular-nums">{healthBlocks.length}</span>
              <p className={`text-[10px] ${theme.textMuted}`}>{t('tabBlocks')}</p>
            </div>
            <div>
              <span className="text-xl font-bold tabular-nums">{healthRoutines.length}</span>
              <p className={`text-[10px] ${theme.textMuted}`}>{t('tabRoutine')}</p>
            </div>
          </div>
          {(healthBlocks.length > 0 || healthRoutines.length > 0) ? (
            <p className={`text-[10px] mt-1 ${theme.textMuted}`}>
              {t('healthDashboardHabitToday')
                .replace('{blocks}', String(healthBlocks.length))
                .replace('{routines}', String(healthRoutines.length))}
            </p>
          ) : null}
        </SectionLink>

        <SectionLink section="recovery" icon={BedDouble} title={t('healthNavRecovery')}>
          {inbody && (inbody.weight > 0 || inbody.smm > 0 || inbody.pbf > 0) ? (
            <div className="flex items-center gap-3">
              <Scale size={16} strokeWidth={2.25} className="text-primary shrink-0" />
              <div className={`text-xs ${theme.textMuted} space-y-0.5`}>
                <p>{t('inbodyWeight')}: <span className="font-semibold text-foreground">{inbody.weight} kg</span></p>
                <p>SMM: <span className="font-semibold text-foreground">{inbody.smm} kg</span> · PBF: <span className="font-semibold text-foreground">{inbody.pbf}%</span></p>
              </div>
            </div>
          ) : (
            <p className={`text-xs ${theme.textMuted}`}>{t('healthDashboardNoInbody')}</p>
          )}
          {isWorkoutLocked && (
            <p className={`text-xs mt-1 text-green-500 font-medium`}>{t('healthDashboardRestDay')}</p>
          )}
        </SectionLink>
      </div>
    </div>
  );
}
