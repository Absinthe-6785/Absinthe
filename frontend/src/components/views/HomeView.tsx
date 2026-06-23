import { useCallback, useMemo, type ReactNode } from 'react';
import useSWR from 'swr';
import {
  Home,
  ArrowRight,
  Calendar,
  Dumbbell,
  BookOpen,
  Plus,
  Clock,
  Activity,
  FileText,
} from 'lucide-react';
import type { ViewProps } from '../../types';
import { useTranslation } from '../../lib/i18n';
import { useNotesStore } from '../../store/useNotesStore';
import { WorkspaceErrorBoundary } from '../common/WorkspaceErrorBoundary';
import { WorkspacePageHeader } from '../common/WorkspacePageHeader';
import { ProductEmptyState } from '../common/ProductEmptyState';
import { WORKSPACE_GAP_CLASS } from '../../lib/uiSpacingTokens';
import { WORKSPACE_CARD_SURFACE, WORKSPACE_CARD_RADIUS_CLASS } from '../common/workspaceCardSizes';
import { openNote, switchToTab } from '../../lib/noteNavigation';
import { buildRecentActivityProjection } from './buildRecentActivityProjection';
import { buildRelativeDateLabels } from './k102RelativeDateLabels';
import { readPlannerActivityRecents } from './features/planner/plannerActivityStorage';
import { readRecipeViewRecents } from './features/recipe/recipeActivityStorage';
import { readArchiveRestoreRecents } from './features/knowledge/archive/archiveRestoreRecents';
import { usePlannerCalendarProjection } from './features/planner/calendar-ui/usePlannerCalendarProjection';
import { buildPlannerProjection } from './features/planner/calendar/buildPlannerProjection';
import { resolveUpcomingRelativeLabel } from './features/planner/calendar-ui/agenda/buildUpcomingTierGroups';
import { useCountdownReviewed } from './features/planner/hooks/useCountdownReviewed';
import { toDateKey } from './features/knowledge/databaseViews/parseDatabaseDate';
import { useArchiveProjection } from './features/archive/hooks/useArchiveProjection';
import { buildHomeFoundationProjection } from './features/home/buildHomeFoundationProjection';
import {
  saveWorkspaceSession,
  workspaceSessionFromActivation,
} from './features/knowledge/workspace/workspaceSessionStorage';
import type { RecentActivityItem } from './buildRecentActivityProjection';
import { API_URL } from '../../lib/config';
import { fetcher } from '../../lib/fetcher';
import type { Schedule } from '../../types';
import { formatLongDate } from './k102DateFormat';

function HomeSection({
  title,
  children,
  dataHook,
  theme,
}: {
  title: string;
  children: ReactNode;
  dataHook: string;
  theme: ViewProps['theme'];
}) {
  return (
    <section
      className={`${WORKSPACE_CARD_SURFACE} ${WORKSPACE_CARD_RADIUS_CLASS} p-4 lg:p-5 ${theme.card}`}
      data-k132a-home-section={dataHook}
    >
      <h2 className="font-heading text-base font-bold mb-3">{title}</h2>
      {children}
    </section>
  );
}

function FlowRow({
  title,
  meta,
  onClick,
  theme,
  dataHook,
}: {
  title: string;
  meta?: string;
  onClick?: () => void;
  theme: ViewProps['theme'];
  dataHook?: string;
}) {
  const body = (
    <>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold truncate">{title}</p>
        {meta ? <p className={`text-[11px] font-medium mt-0.5 ${theme.textMuted}`}>{meta}</p> : null}
      </div>
      {onClick ? <ArrowRight size={16} className={`shrink-0 ${theme.textMuted}`} /> : null}
    </>
  );

  if (!onClick) {
    return (
      <div className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${theme.input}`} data-k132a-home-row={dataHook}>
        {body}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-muted/40 min-h-[44px] ${theme.input}`}
      data-k132a-home-row={dataHook}
    >
      {body}
    </button>
  );
}

export const HomeView = ({
  now,
  selectedDate,
  formatDate,
  schedules,
  routines,
  workouts,
  weeklySchedules,
  appSettings,
  theme,
  isDailyLoading,
}: ViewProps) => {
  const { t, lang } = useTranslation();
  const vaultStructureVersion = useNotesStore(s => s.vaultStructureVersion);
  const createNote = useNotesStore(s => s.createNote);
  const todayKey = toDateKey(now.toJSDate()) ?? formatDate(selectedDate);
  const todayDate = now.toJSDate();

  const prevDate = useMemo(() => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    return d;
  }, [selectedDate]);
  const prevDateStr = formatDate(prevDate);
  const { data: prevSchedules = [] } = useSWR<Schedule[]>(
    `${API_URL}/api/schedules?date=${prevDateStr}`,
    fetcher,
    { revalidateOnFocus: false },
  );

  const { projection: calendarProjection, presentation } = usePlannerCalendarProjection({
    now,
    anchorDate: todayKey,
    schedules,
    previousDaySchedules: prevSchedules,
    previousDayDate: prevDateStr,
    weeklySchedules,
    appSettings,
  });

  const { isReviewed } = useCountdownReviewed();
  const relativeLabel = useCallback(
    (dateKey: string) => resolveUpcomingRelativeLabel(dateKey, todayKey, t),
    [todayKey, t],
  );

  const plannerProjection = useMemo(
    () => buildPlannerProjection({
      calendarProjection,
      presentation,
      todayKey,
      isReviewed,
      relativeLabel,
      laterTierLabel: t('k108Later'),
    }),
    [calendarProjection, presentation, todayKey, isReviewed, relativeLabel, t],
  );

  const recentActivity = useMemo(() => buildRecentActivityProjection({
    notes: useNotesStore.getState().notes,
    plannerRecents: readPlannerActivityRecents(),
    recipeRecents: readRecipeViewRecents(),
    archiveRestoreRecents: readArchiveRestoreRecents(),
    labels: buildRelativeDateLabels(t),
    locale: lang,
    now: todayDate,
    limitPerBucket: 6,
  }), [vaultStructureVersion, t, lang, todayDate]);

  const { projection: archiveProjection } = useArchiveProjection(todayDate, lang);

  const projection = useMemo(
    () => buildHomeFoundationProjection({
      notes: useNotesStore.getState().notes,
      routines,
      workouts,
      plannerProjection,
      recentActivity,
      archiveHistory: archiveProjection.historyItems,
      todayKey,
      locale: lang,
    }),
    [vaultStructureVersion, routines, workouts, plannerProjection, recentActivity, archiveProjection.historyItems, todayKey, lang],
  );

  const handleContinue = useCallback(() => {
    const item = projection.continueItem;
    if (!item) return;
    if (item.kind === 'note' && item.noteId) {
      openNote(item.noteId, { returnTab: 'home' });
      return;
    }
    if (item.kind === 'workspace' && item.workspaceActivation) {
      saveWorkspaceSession(workspaceSessionFromActivation(item.workspaceActivation));
      switchToTab('note');
    }
  }, [projection.continueItem]);

  const handleTraceNavigate = useCallback((item: RecentActivityItem) => {
    if ((item.domain === 'notes' || item.domain === 'archive') && item.noteId) {
      openNote(item.noteId, { returnTab: 'home' });
      return;
    }
    if (item.domain === 'planner') {
      switchToTab('planner');
      return;
    }
    if (item.domain === 'recipe') {
      switchToTab('recipe');
      return;
    }
    if (item.domain === 'archive') {
      switchToTab('analytics');
    }
  }, []);

  const handleNewNote = useCallback(() => {
    switchToTab('note');
    createNote();
  }, [createNote]);

  const agendaPreview = projection.todayAgenda.slice(0, 4);
  const timetablePreview = projection.timetableSlots.slice(0, 3);

  return (
    <WorkspaceErrorBoundary workspace="home">
      <div
        className={`flex-1 flex flex-col overflow-hidden animate-in fade-in duration-300 ${WORKSPACE_GAP_CLASS}`}
        data-workspace="home"
        data-k132a-home
      >
        <div className="shrink-0 px-0.5">
          <WorkspacePageHeader
            workspace="home"
            title={t('home')}
            subtitle={t('homeSubtitle')}
            icon={Home}
            theme={theme}
            dark={appSettings.darkMode}
          />
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto pb-6 pr-1" data-k132a-home-scroll>
          <div className="max-w-[760px] mx-auto flex flex-col gap-3 lg:gap-4">
            <HomeSection title={t('homeContinue')} dataHook="continue" theme={theme}>
              {projection.continueItem ? (
                <FlowRow
                  title={projection.continueItem.title}
                  meta={projection.continueItem.subtitle ?? (
                    projection.continueItem.kind === 'note' ? t('homeContinueNote') : t('homeContinueWorkspace')
                  )}
                  onClick={handleContinue}
                  theme={theme}
                  dataHook="continue-primary"
                />
              ) : (
                <p className={`text-sm ${theme.textMuted}`} data-k132a-home-empty="continue">
                  {t('homeContinueEmpty')}
                </p>
              )}
            </HomeSection>

            <HomeSection title={t('homeToday')} dataHook="today" theme={theme}>
              <p className={`text-[11px] font-medium mb-2 ${theme.textMuted}`}>
                {formatLongDate(todayDate, lang)}
              </p>
              {isDailyLoading ? (
                <p className={`text-sm ${theme.textMuted}`}>{t('loading')}</p>
              ) : agendaPreview.length > 0 ? (
                <div className="flex flex-col gap-1.5 mb-3">
                  {agendaPreview.map(item => (
                    <FlowRow
                      key={item.key}
                      title={item.title}
                      meta={item.time || item.countdownLabel}
                      onClick={() => switchToTab('planner')}
                      theme={theme}
                      dataHook={`today-${item.kind}`}
                    />
                  ))}
                </div>
              ) : (
                <p className={`text-sm mb-3 ${theme.textMuted}`}>{t('homeTodayEmpty')}</p>
              )}
              {projection.activeRoutines > 0 ? (
                <p className={`text-xs font-semibold mb-2 ${theme.textMuted}`}>
                  {t('homeRoutineProgress')
                    .replace('{done}', String(projection.completedRoutines))
                    .replace('{total}', String(projection.activeRoutines))}
                </p>
              ) : null}
              {timetablePreview.length > 0 ? (
                <div className="flex flex-col gap-1.5">
                  {timetablePreview.map(slot => (
                    <FlowRow
                      key={slot.id}
                      title={slot.title}
                      meta={`${slot.startTime} – ${slot.endTime}`}
                      onClick={() => switchToTab('planner')}
                      theme={theme}
                      dataHook="routine-slot"
                    />
                  ))}
                </div>
              ) : null}
            </HomeSection>

            <HomeSection title={t('homeWorkout')} dataHook="workout" theme={theme}>
              {projection.workout.hasSession ? (
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap gap-1.5">
                    <span className={`rounded-lg px-2 py-1 text-[11px] font-bold ${theme.textMuted} ${appSettings.darkMode ? 'bg-surface-alt' : 'bg-gray-100'}`}>
                      {projection.workout.isDraft ? t('healthSessionActive') : t('healthSessionSaved')}
                    </span>
                    <span className={`rounded-lg px-2 py-1 text-[11px] font-bold ${theme.textMuted} ${appSettings.darkMode ? 'bg-surface-alt' : 'bg-gray-100'}`}>
                      {t('healthSessionExerciseCount').replace('{count}', String(projection.workout.exerciseCount))}
                    </span>
                    <span className={`rounded-lg px-2 py-1 text-[11px] font-bold ${theme.textMuted} ${appSettings.darkMode ? 'bg-surface-alt' : 'bg-gray-100'}`}>
                      {t('healthSessionDoneCount').replace('{count}', String(projection.workout.doneCount))}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => switchToTab('health')}
                    className="self-start inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline min-h-[44px]"
                    data-k132a-home-open-health
                  >
                    {t('homeOpenWorkout')} <ArrowRight size={14} />
                  </button>
                </div>
              ) : (
                <ProductEmptyState
                  variant="tailwind"
                  theme={theme}
                  icon={Dumbbell}
                  title={t('homeWorkoutEmpty')}
                  description={t('homeWorkoutEmptyDesc')}
                  dataHook="home-workout-empty"
                  primaryAction={{ label: t('homeOpenHealth'), onClick: () => switchToTab('health') }}
                />
              )}
            </HomeSection>

            <HomeSection title={t('homeRecentTraces')} dataHook="traces" theme={theme}>
              {projection.traces.length > 0 ? (
                <div className="flex flex-col gap-1.5">
                  {projection.traces.map(item => (
                    <FlowRow
                      key={item.id}
                      title={item.title}
                      meta={`${item.relativeLabel} · ${item.domain}`}
                      onClick={() => handleTraceNavigate(item)}
                      theme={theme}
                      dataHook={`trace-${item.domain}`}
                    />
                  ))}
                </div>
              ) : (
                <p className={`text-sm ${theme.textMuted}`} data-k132a-home-empty="traces">
                  {t('homeTracesEmpty')}
                </p>
              )}
              {projection.archiveTracesToday > 0 ? (
                <button
                  type="button"
                  onClick={() => switchToTab('analytics')}
                  className={`mt-3 inline-flex items-center gap-1.5 text-xs font-bold min-h-[44px] ${theme.textMuted} hover:text-foreground`}
                  data-k132a-home-open-archive
                >
                  <Activity size={14} />
                  {t('homeArchiveActivityToday').replace('{count}', String(projection.archiveTracesToday))}
                </button>
              ) : null}
            </HomeSection>

            <HomeSection title={t('homeQuickActions')} dataHook="actions" theme={theme}>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleNewNote}
                  className="inline-flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-bold bg-primary text-primary-foreground min-h-[44px]"
                  data-k132a-home-new-note
                >
                  <Plus size={16} /> {t('homeNewNote')}
                </button>
                <button
                  type="button"
                  onClick={() => switchToTab('planner')}
                  className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-bold border min-h-[44px] ${theme.border}`}
                  data-k132a-home-open-schedule
                >
                  <Calendar size={16} /> {t('homeOpenSchedule')}
                </button>
                <button
                  type="button"
                  onClick={() => switchToTab('health')}
                  className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-bold border min-h-[44px] ${theme.border}`}
                  data-k132a-home-open-health-action
                >
                  <Dumbbell size={16} /> {t('homeOpenHealth')}
                </button>
                <button
                  type="button"
                  onClick={handleContinue}
                  disabled={!projection.continueItem}
                  className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-bold border min-h-[44px] disabled:opacity-50 ${theme.border}`}
                  data-k132a-home-continue-action
                >
                  <BookOpen size={16} /> {t('homeContinueAction')}
                </button>
              </div>
              <button
                type="button"
                onClick={() => switchToTab('note')}
                className={`mt-2 w-full inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold min-h-[44px] ${theme.textMuted} hover:text-foreground`}
                data-k132a-home-open-notes
              >
                <FileText size={14} /> {t('homeOpenNotes')}
                <Clock size={12} className="opacity-60" />
              </button>
            </HomeSection>
          </div>
        </div>
      </div>
    </WorkspaceErrorBoundary>
  );
};
