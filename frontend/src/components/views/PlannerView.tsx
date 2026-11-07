import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import useSWR, { type KeyedMutator } from 'swr';
import { API_URL } from '../../lib/config';
import { accountBoundRemoteFetcher, accountBoundRemoteKey, type AccountBoundRemoteKey } from '../../lib/accountBoundRemote';
import { runtimeAccountSyncAccountId } from '../../lib/remoteBoundary';
import { X, Calendar, RefreshCw } from 'lucide-react';
import { useConfirm } from '../../hooks/useConfirm';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { useApiMutation } from '../../hooks/useApiMutation';
import { ConfirmModal } from '../common/ConfirmModal';
import { WorkspacePageHeader } from '../common/WorkspacePageHeader';
import { WORKSPACE_GAP_CLASS } from '../../lib/uiSpacingTokens';
import { WORKSPACE_MODAL_SURFACE } from '../common/workspaceCardSizes';
import { WORKSPACE_PANE_ROOT_CLASS, WORKSPACE_SCROLL_MODE } from '../common/workspaceLayout';
import { PlannerProps, Schedule } from '../../types';
import { useTranslation } from '../../lib/i18n';
import { CalendarShell } from './features/planner/calendar-ui';
import { usePlannerScheduleEventActions } from './features/planner/hooks/usePlannerScheduleEventActions';
import { EventNoteDialog } from './features/knowledge/trace/EventNoteDialog';
import { buildNoteChrome } from './noteEditorTheme';
import { openNote } from '../../lib/noteNavigation';
import { registerSearchDomainHandlers } from './features/search/searchDomainNavigation';
import { recordPlannerActivity, validPlannerEventDate } from './features/planner/plannerActivityStorage';
import { ScheduleEventDetailPanel } from './features/planner/calendar-ui/day/ScheduleEventDetailPanel';
import { formatLongDateKey } from './k102DateFormat';
import type { PlannerScheduleRow } from './features/planner/calendar';
import type { SelectedDayScheduleRevalidator } from '../../hooks/useDaily';
import {
  buildScheduleRangePageUrl,
  collectCompleteScheduleRange,
  getScheduleMonthRange,
  type DatedSchedule,
  type ScheduleDateRange,
} from '../../lib/scheduleRangePagination';

type ScheduleDday = Schedule & { date: string };
type MonthScheduleContext = Readonly<{
  accountId: string | undefined;
  range: ScheduleDateRange | null;
  generation: number;
}>;
type MonthScheduleReadStatus = 'loading' | 'loaded' | 'unavailable';
type MonthMutationRefreshStatus = 'refreshing' | 'success' | 'incomplete';
type MonthScheduleReadFlight = Readonly<{
  context: MonthScheduleContext;
  accountGeneration: number;
  mutationRevision: number;
  requestGeneration: number;
  reason: 'mount' | 'manual' | 'mutation';
  promise: Promise<DatedSchedule[]>;
}>;
type VerifiedMonthScheduleRead = Readonly<{
  context: MonthScheduleContext;
  accountGeneration: number;
  mutationRevision: number;
  schedules: DatedSchedule[];
}>;
type MonthMutationRefreshFlight = Readonly<{
  context: MonthScheduleContext;
  accountGeneration: number;
  promise: Promise<void>;
}>;

export interface ScheduleNavigationRequest {
  accountId: string;
  accountGeneration: number;
  requestId: number;
  itemId: string;
  eventDate: string;
}

type ScheduleDetailTarget = Readonly<{ id: string; eventDate?: string }>;
type ScheduleRefreshStatus = 'refreshing' | 'success' | 'incomplete' | 'offline' | 'unavailable';
type ScheduleRefreshContext = Readonly<{ accountId: string | undefined; dateKey: string; generation: number }>;
type ScheduleRefreshFlight = Readonly<{ context: ScheduleRefreshContext }>;

async function refreshScheduleCache<T>(
  key: AccountBoundRemoteKey | null,
  mutate: KeyedMutator<T>,
  isCurrent: () => boolean,
): Promise<void> {
  if (!key || !isCurrent()) throw new Error('Schedule refresh source is unavailable.');
  const freshData = await accountBoundRemoteFetcher<T>(key);
  if (!Array.isArray(freshData)) throw new Error('Invalid Schedule refresh response.');
  if (!isCurrent()) throw new Error('Schedule refresh source became stale.');
  await mutate(freshData, { revalidate: false });
}

async function readCompleteScheduleMonth(
  context: MonthScheduleContext,
  isCurrent: () => boolean,
): Promise<DatedSchedule[]> {
  if (!context.accountId || !context.range) throw new Error('Schedule month source is unavailable.');
  return collectCompleteScheduleRange({
    apiUrl: API_URL,
    range: context.range,
    accountId: context.accountId,
    isCurrent,
    fetchPage: async url => {
      const key = accountBoundRemoteKey(url, context.accountId, 'planner_events');
      if (!key) throw new Error('Schedule month account scope is unavailable.');
      return accountBoundRemoteFetcher<unknown>(key);
    },
  });
}

export type PlannerViewProps = PlannerProps & Readonly<{
  isScheduleLoading?: boolean;
  revalidateSelectedDaySchedules?: SelectedDayScheduleRevalidator;
  scheduleNavigationRequest?: ScheduleNavigationRequest;
  scheduleNavigationGeneration?: number;
  onScheduleNavigationConsumed?: (requestId: number) => void;
}>;

function scheduleMatchesDate(
  schedule: Schedule | ScheduleDday,
  targetDate: string,
  collectionDate: string,
): boolean {
  return 'date' in schedule
    ? validPlannerEventDate(schedule.date) === targetDate
    : collectionDate === targetDate;
}

function toScheduleDetailRow(schedule: Schedule | ScheduleDday, dateKey: string): PlannerScheduleRow {
  return {
    id: schedule.id,
    dateKey,
    title: schedule.text,
    startTime: schedule.start_time,
    endTime: schedule.end_time,
    endNextDay: schedule.end_next_day ?? false,
    category: schedule.category,
    color: schedule.color,
    source: 'schedule',
    ...(schedule.is_dday ? { isDday: true } : {}),
  };
}

export const PlannerView = ({
  now, currentDate, setCurrentDate, selectedDate, setSelectedDate,
  formatDate, isToday, showToast,   mutateDaily, mutateStatic,
  appSettings, schedules, todos, weeklySchedules, theme, THEME_COLORS,
  user,
  isScheduleLoading = false,
  revalidateSelectedDaySchedules,
  scheduleNavigationRequest,
  scheduleNavigationGeneration = 0,
  onScheduleNavigationConsumed,
}: PlannerViewProps) => {
  const { t, lang } = useTranslation();
  const accountId = user?.id;
  const selectedDateKey = formatDate(selectedDate);
  const monthRange = getScheduleMonthRange(selectedDateKey);
  const monthScheduleContextRef = useRef<MonthScheduleContext>({ accountId, range: monthRange, generation: 0 });
  const previousMonthContext = monthScheduleContextRef.current;
  if (previousMonthContext.accountId !== accountId
      || previousMonthContext.range?.startDate !== monthRange?.startDate
      || previousMonthContext.range?.endDate !== monthRange?.endDate) {
    monthScheduleContextRef.current = {
      accountId,
      range: monthRange,
      generation: previousMonthContext.generation + 1,
    };
  }
  const monthScheduleContext = monthScheduleContextRef.current;
  const monthRequestGenerationRef = useRef(0);
  const monthMutationRevisionRef = useRef(0);
  const monthScheduleReadFlightRef = useRef<MonthScheduleReadFlight | null>(null);
  const verifiedMonthScheduleReadRef = useRef<VerifiedMonthScheduleRead | null>(null);
  const monthMutationRefreshFlightRef = useRef<MonthMutationRefreshFlight | null>(null);
  const [monthReadState, setMonthReadState] = useState<Readonly<{
    context: MonthScheduleContext;
    status: MonthScheduleReadStatus;
  }> | null>(null);
  const [monthMutationRefreshState, setMonthMutationRefreshState] = useState<Readonly<{
    context: MonthScheduleContext;
    accountGeneration: number;
    status: MonthMutationRefreshStatus;
  }> | null>(null);
  const monthScheduleMountedRef = useRef(false);
  const scheduleRefreshContextRef = useRef<ScheduleRefreshContext>({
    accountId,
    dateKey: selectedDateKey,
    generation: 0,
  });
  const previousRefreshContext = scheduleRefreshContextRef.current;
  if (previousRefreshContext.accountId !== accountId || previousRefreshContext.dateKey !== selectedDateKey) {
    scheduleRefreshContextRef.current = {
      accountId,
      dateKey: selectedDateKey,
      generation: previousRefreshContext.generation + 1,
    };
  }
  const scheduleRefreshFlightRef = useRef<ScheduleRefreshFlight | null>(null);
  const scheduleRefreshMountedRef = useRef(false);
  const [scheduleRefreshFlight, setScheduleRefreshFlight] = useState<ScheduleRefreshFlight | null>(null);
  const [scheduleRefreshState, setScheduleRefreshState] = useState<Readonly<{
    context: ScheduleRefreshContext;
    status: ScheduleRefreshStatus;
  }> | null>(null);
  const { mutate: api } = useApiMutation(mutateDaily, mutateStatic, showToast);
  const { confirm, showConfirm, clearConfirm, handleConfirm } = useConfirm();

  const {
    eventDialog,
    setEventDialog,
    agendaEventActions,
    handleEventDialogSave,
    handleRemoveEventStatus,
  } = usePlannerScheduleEventActions({ showToast, showConfirm, t });

  const noteChrome = useMemo(
    () => buildNoteChrome(appSettings.darkMode, appSettings),
    [appSettings],
  );

  const [showForm, setShowForm] = useState(false);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const formSessionRef = useRef(0);
  const pendingSaveSessionRef = useRef<number | null>(null);
  const accountIdRef = useRef(accountId);
  const accountGenerationRef = useRef(0);
  if (accountIdRef.current !== accountId) {
    accountIdRef.current = accountId;
    accountGenerationRef.current += 1;
  }
  const resetScheduleSession = useCallback(() => {
    formSessionRef.current += 1;
    pendingSaveSessionRef.current = null;
    setIsSavingSchedule(false);
  }, []);
  const closeScheduleForm = useCallback(() => {
    resetScheduleSession();
    setShowForm(false);
  }, [resetScheduleSession]);
  useEffect(() => {
    closeScheduleForm();
    return () => { formSessionRef.current += 1; };
  }, [accountId, closeScheduleForm]);
  const [scheduleDetailTarget, setScheduleDetailTarget] = useState<ScheduleDetailTarget | null>(null);
  const handledScheduleNavigationRef = useRef<number | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newSch, setNewSch] = useState<Partial<Schedule>>({
    text: '', start_time: '10:00', end_time: '11:00',
    is_dday: false, color: 'purple', category: 'Personal',
  });
  const [scheduleDateStr, setScheduleDateStr] = useState(formatDate(selectedDate));
  // end_next_day: 익일 종료 여부 (23:00 ~ 01:00 같은 자정 넘는 일정 지원)
  const [endNextDay, setEndNextDay] = useState(false);

  // ── Schedule CRUD ──────────────────────────────────────────────────
  const prevDate = useMemo(() => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    return d;
  }, [selectedDate]);
  const prevDateStr = useMemo(() => formatDate(prevDate), [prevDate, formatDate]);
  const prevSchedulesKey = accountBoundRemoteKey(`${API_URL}/api/schedules?date=${prevDateStr}`, accountId, 'planner_events');
  const { data: prevSchedules = [], mutate: mutatePreviousSchedules } = useSWR<Schedule[]>(
    prevSchedulesKey,
    accountBoundRemoteFetcher,
    { revalidateOnFocus: false }
  );
  const monthSchedulesKey = monthScheduleContext.range && accountId
    ? accountBoundRemoteKey(buildScheduleRangePageUrl(API_URL, monthScheduleContext.range), accountId, 'planner_events')
    : null;
  const { data: monthSchedules, mutate: mutateMonthSchedules } = useSWR<DatedSchedule[]>(
    monthSchedulesKey,
    null,
    { revalidateOnFocus: false, revalidateOnReconnect: false, revalidateIfStale: false, revalidateOnMount: false },
  );
  const ddaySchedulesKey = accountBoundRemoteKey(`${API_URL}/api/schedules/ddays`, accountId, 'planner_ddays');
  const { data: ddayData, mutate: mutateDdaySchedules, isLoading: isDdayLoading } = useSWR<ScheduleDday[]>(
    ddaySchedulesKey,
    accountBoundRemoteFetcher,
    { revalidateOnFocus: false },
  );
  const ddaySchedules = ddayData ?? [];

  const readAndPublishMonth = useCallback((
    context: MonthScheduleContext,
    accountGeneration: number,
    mutationRevision: number,
    reuseVerifiedResult = false,
    reason: MonthScheduleReadFlight['reason'] = 'mount',
  ): Promise<DatedSchedule[]> => {
    const verified = verifiedMonthScheduleReadRef.current;
    if (reuseVerifiedResult && verified?.context === context
      && verified.accountGeneration === accountGeneration
      && verified.mutationRevision === mutationRevision
      && monthScheduleContextRef.current === context
      && accountGenerationRef.current === accountGeneration
      && monthMutationRevisionRef.current === mutationRevision
      && runtimeAccountSyncAccountId() === context.accountId) {
      return Promise.resolve(verified.schedules);
    }
    const existing = monthScheduleReadFlightRef.current;
    if (existing?.context === context
      && existing.accountGeneration === accountGeneration
      && existing.mutationRevision === mutationRevision
      && existing.requestGeneration === monthRequestGenerationRef.current
      && !(reason === 'manual' && existing.reason !== 'mutation')) {
      return existing.promise;
    }

    const requestGeneration = ++monthRequestGenerationRef.current;
    const isCurrent = () => monthScheduleMountedRef.current
      && accountIdRef.current === context.accountId
      && accountGenerationRef.current === accountGeneration
      && runtimeAccountSyncAccountId() === context.accountId
      && monthScheduleContextRef.current === context
      && monthMutationRevisionRef.current === mutationRevision
      && monthRequestGenerationRef.current === requestGeneration;
    setMonthReadState({ context, status: 'loading' });

    let flight!: MonthScheduleReadFlight;
    const promise = Promise.resolve().then(async () => {
      if (!context.accountId || !context.range || typeof navigator !== 'undefined' && navigator.onLine === false) {
        throw new Error('Schedule month source is unavailable.');
      }
      const freshSchedules = await readCompleteScheduleMonth(context, isCurrent);
      if (!isCurrent()) throw new Error('Schedule month refresh became stale.');
      await mutateMonthSchedules(freshSchedules, { revalidate: false });
      if (!isCurrent()) throw new Error('Schedule month refresh became stale.');
      verifiedMonthScheduleReadRef.current = { context, accountGeneration, mutationRevision, schedules: freshSchedules };
      setMonthReadState({ context, status: 'loaded' });
      return freshSchedules;
    }).catch(error => {
      if (isCurrent()) setMonthReadState({ context, status: 'unavailable' });
      throw error;
    }).finally(() => {
      if (monthScheduleReadFlightRef.current === flight) monthScheduleReadFlightRef.current = null;
    });
    flight = { context, accountGeneration, mutationRevision, requestGeneration, reason, promise };
    monthScheduleReadFlightRef.current = flight;
    return promise;
  }, [mutateMonthSchedules]);

  const refreshMonthAfterScheduleMutation = useCallback((
    expectedAccountId: string | undefined,
    expectedAccountGeneration: number,
  ): Promise<void> => {
    const context = monthScheduleContextRef.current;
    const isAccountCurrent = () => monthScheduleMountedRef.current
      && Boolean(expectedAccountId)
      && accountIdRef.current === expectedAccountId
      && accountGenerationRef.current === expectedAccountGeneration
      && runtimeAccountSyncAccountId() === expectedAccountId;
    if (!isAccountCurrent() || context.accountId !== expectedAccountId || !context.range) return Promise.resolve();

    monthMutationRevisionRef.current += 1;
    setMonthMutationRefreshState({ context, accountGeneration: expectedAccountGeneration, status: 'refreshing' });
    const existing = monthMutationRefreshFlightRef.current;
    if (existing?.context === context && existing.accountGeneration === expectedAccountGeneration) {
      return existing.promise;
    }

    let flight!: MonthMutationRefreshFlight;
    const promise = (async () => {
      while (isAccountCurrent() && monthScheduleContextRef.current === context) {
        const revision = monthMutationRevisionRef.current;
        try {
          await readAndPublishMonth(context, expectedAccountGeneration, revision, false, 'mutation');
          if (!isAccountCurrent() || monthScheduleContextRef.current !== context) return;
          if (monthMutationRevisionRef.current !== revision) continue;
          setMonthMutationRefreshState({ context, accountGeneration: expectedAccountGeneration, status: 'success' });
          return;
        } catch {
          if (!isAccountCurrent() || monthScheduleContextRef.current !== context) return;
          if (monthMutationRevisionRef.current !== revision) continue;
          setMonthMutationRefreshState({ context, accountGeneration: expectedAccountGeneration, status: 'incomplete' });
          return;
        }
      }
    })().finally(() => {
      if (monthMutationRefreshFlightRef.current === flight) monthMutationRefreshFlightRef.current = null;
    });
    flight = { context, accountGeneration: expectedAccountGeneration, promise };
    monthMutationRefreshFlightRef.current = flight;
    return promise;
  }, [readAndPublishMonth]);

  useEffect(() => {
    scheduleRefreshMountedRef.current = true;
    monthScheduleMountedRef.current = true;
    return () => {
      scheduleRefreshMountedRef.current = false;
      monthScheduleMountedRef.current = false;
      monthRequestGenerationRef.current += 1;
      monthMutationRevisionRef.current += 1;
      monthScheduleReadFlightRef.current = null;
      verifiedMonthScheduleReadRef.current = null;
      monthMutationRefreshFlightRef.current = null;
      scheduleRefreshFlightRef.current = null;
    };
  }, []);

  useEffect(() => {
    const context = monthScheduleContext;
    if (!context.accountId || !context.range || !monthSchedulesKey) {
      if (context.accountId) setMonthReadState({ context, status: 'unavailable' });
      return;
    }
    void readAndPublishMonth(context, accountGenerationRef.current, monthMutationRevisionRef.current, false, 'mount').catch(() => undefined);
  }, [monthScheduleContext, monthSchedulesKey, readAndPublishMonth]);

  const refreshSchedules = useCallback(() => {
    const context = scheduleRefreshContextRef.current;
    if (scheduleRefreshFlightRef.current?.context === context) return;
    const monthContext = monthScheduleContextRef.current;

    const setStatus = (status: ScheduleRefreshStatus) => setScheduleRefreshState({ context, status });
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setStatus('offline');
      return;
    }
    if (!context.accountId || runtimeAccountSyncAccountId() !== context.accountId
      || !revalidateSelectedDaySchedules || !prevSchedulesKey || !ddaySchedulesKey
      || !monthSchedulesKey || !monthContext.range || monthContext.accountId !== context.accountId) {
      setStatus('unavailable');
      return;
    }

    const accountGeneration = accountGenerationRef.current;
    const flight: ScheduleRefreshFlight = { context };
    scheduleRefreshFlightRef.current = flight;
    setScheduleRefreshFlight(flight);
    const isCurrent = () => scheduleRefreshMountedRef.current
      && runtimeAccountSyncAccountId() === context.accountId
      && scheduleRefreshContextRef.current === context
      && scheduleRefreshFlightRef.current === flight
      && monthScheduleContextRef.current === monthContext
      && accountGenerationRef.current === accountGeneration;
    setStatus('refreshing');
    setMonthReadState({ context: monthContext, status: 'loading' });

    const refreshMonthSchedules = async () => {
      let revision = monthMutationRevisionRef.current;
      let reuseVerifiedResult = false;
      while (isCurrent()) {
        try {
          await readAndPublishMonth(monthContext, accountGeneration, revision, reuseVerifiedResult, 'manual');
          if (!isCurrent()) throw new Error('Schedule refresh became stale.');
          return;
        } catch (error) {
          if (!isCurrent()) throw error;
          const latestRevision = monthMutationRevisionRef.current;
          if (latestRevision !== revision) {
            revision = latestRevision;
            reuseVerifiedResult = true;
            continue;
          }
          throw error;
        }
      }
      throw new Error('Schedule refresh became stale.');
    };

    void (async () => {
      try {
        const outcomes = await Promise.allSettled([
          Promise.resolve().then(() => revalidateSelectedDaySchedules(context.accountId!, context.dateKey, isCurrent)),
          refreshScheduleCache(prevSchedulesKey, mutatePreviousSchedules, isCurrent),
          refreshScheduleCache(ddaySchedulesKey, mutateDdaySchedules, isCurrent),
          refreshMonthSchedules(),
        ]);
        if (!isCurrent()) return;
        setStatus(outcomes.every(outcome => outcome.status === 'fulfilled') ? 'success' : 'incomplete');
      } finally {
        if (scheduleRefreshMountedRef.current && scheduleRefreshFlightRef.current === flight) {
          scheduleRefreshFlightRef.current = null;
          setScheduleRefreshFlight(null);
        }
      }
    })();
  }, [ddaySchedulesKey, monthSchedulesKey, mutateDdaySchedules, mutatePreviousSchedules, prevSchedulesKey, readAndPublishMonth, revalidateSelectedDaySchedules]);

  const visibleRefreshStatus = scheduleRefreshState?.context === scheduleRefreshContextRef.current
    && runtimeAccountSyncAccountId() === scheduleRefreshState.context.accountId
    ? scheduleRefreshState.status
    : null;
  const isScheduleRefreshInFlight = scheduleRefreshFlight?.context === scheduleRefreshContextRef.current;
  const refreshStatusMessageKey = visibleRefreshStatus ? ({
    refreshing: 'refreshingSchedules',
    success: 'schedulesRefreshed',
    incomplete: 'schedulesRefreshIncomplete',
    offline: 'schedulesRefreshOffline',
    unavailable: 'schedulesRefreshUnavailable',
  } as const)[visibleRefreshStatus] : null;
  const visibleMonthReadStatus = monthReadState?.context === monthScheduleContext
    && monthSchedules === undefined
    && visibleRefreshStatus !== 'refreshing'
    ? monthReadState.status
    : null;
  const monthReadStatusMessageKey = visibleMonthReadStatus === 'loading'
    ? 'scheduleMonthLoading'
    : visibleMonthReadStatus === 'unavailable'
      ? 'scheduleMonthUnavailable'
      : null;
  const visibleMonthMutationRefreshStatus = monthMutationRefreshState?.context === monthScheduleContext
    && monthMutationRefreshState.accountGeneration === accountGenerationRef.current
    && runtimeAccountSyncAccountId() === monthMutationRefreshState.context.accountId
    ? monthMutationRefreshState.status
    : null;
  const monthMutationRefreshMessageKey = visibleMonthMutationRefreshStatus ? ({
    refreshing: 'scheduleMonthMutationRefreshing',
    success: 'scheduleMonthMutationRefreshed',
    incomplete: 'scheduleMonthMutationRefreshIncomplete',
  } as const)[visibleMonthMutationRefreshStatus] : null;
  // 전날 일정 — calendar projection carry-over

  useEscapeKey(() => {
    closeScheduleForm();
    setScheduleDetailTarget(null);
    setEventDialog(null);
    clearConfirm();
  });


  const openPlannerNote = useCallback((id: string, breadcrumb?: readonly import('../../lib/noteBreadcrumb').NoteBreadcrumbSegment[]) => {
    openNote(id, {
      returnTab: 'planner',
      breadcrumb: breadcrumb ?? [
        { type: 'key', key: 'planner' },
        { type: 'key', key: 'scheduleCountdownTitle' },
      ],
    });
  }, []);

  // ── Schedule ───────────────────────────────────────────────────────
  const openModal = (sch?: Schedule | ScheduleDday, sourceDate?: string) => {
    const date = sch ? ('date' in sch ? sch.date : sourceDate) : formatDate(selectedDate);
    if (!date) return;
    resetScheduleSession();
    setNewSch(sch ?? { text: '', start_time: '10:00', end_time: '11:00', is_dday: false, color: 'purple', category: 'Personal' });
    setEditingId(sch?.id ?? null);
    setEndNextDay(sch?.end_next_day ?? false);
    setScheduleDateStr(date);
    setShowForm(true);
  };
  const handleSaveSchedule = async () => {
    if (pendingSaveSessionRef.current !== null) return;
    if (!newSch.text?.trim()) return showToast(t('enterText'), 'error');
    const isDday = Boolean(newSch.is_dday);
    if (!isDday && !endNextDay && newSch.start_time && newSch.end_time && newSch.start_time >= newSch.end_time)
      return showToast(t('endTimeError'), 'error');

    const isOverlap = scheduleDateStr === formatDate(selectedDate) && !isDday && !endNextDay && schedules.some(s =>
      !s.is_dday && s.id !== editingId && newSch.start_time! < s.end_time && newSch.end_time! > s.start_time
    );
    const payload = {
      ...newSch,
      color: 'purple',
      category: newSch.category ?? 'Personal',
      is_dday: isDday,
      start_time: isDday ? '00:00' : newSch.start_time,
      end_time: isDday ? '23:59' : newSch.end_time,
    };
    const session = formSessionRef.current;
    const accountGeneration = accountGenerationRef.current;
    const isCurrentSession = () => session === formSessionRef.current
      && accountId === accountIdRef.current
      && accountGeneration === accountGenerationRef.current;
    const doSave = async () => {
      if (!isCurrentSession() || pendingSaveSessionRef.current !== null) return;
      pendingSaveSessionRef.current = session;
      setIsSavingSchedule(true);
      try {
        const ok = await api(
          editingId ? 'PUT' : 'POST',
          editingId ? `/api/schedules/${editingId}` : '/api/schedules',
          { ...payload, date: scheduleDateStr, end_next_day: isDday ? false : endNextDay },
          { revalidate: 'both', successMsg: t('scheduleSaved') },
        );
        if (ok && isCurrentSession()) {
          void mutateDdaySchedules();
          void refreshMonthAfterScheduleMutation(accountId, accountGeneration);
          closeScheduleForm();
        }
      } finally {
        if (isCurrentSession() && pendingSaveSessionRef.current === session) {
          pendingSaveSessionRef.current = null;
          setIsSavingSchedule(false);
        }
      }
    };
    if (isOverlap) { showConfirm(t('overlapMsg'), doSave, { confirmLabel: t('saveLabel'), variant: 'primary' }); return; }
    doSave();
  };
  const handleDeleteSchedule = (id: string) =>
    showConfirm(t('deleteSchedule'), async () => {
      const expectedAccountId = accountIdRef.current;
      const expectedAccountGeneration = accountGenerationRef.current;
      const ok = await api('DELETE', `/api/schedules/${id}`, undefined, { revalidate: 'both', successMsg: t('deleted') });
      if (ok && monthScheduleMountedRef.current
        && accountIdRef.current === expectedAccountId
        && accountGenerationRef.current === expectedAccountGeneration
        && runtimeAccountSyncAccountId() === expectedAccountId) {
        void mutateDdaySchedules();
        void refreshMonthAfterScheduleMutation(expectedAccountId, expectedAccountGeneration);
      }
    },
      { confirmLabel: t('deleteLabel') },
    );

  const handleDuplicateSchedule = useCallback((id: string) => {
    const sch = schedules.find(s => s.id === id)
      ?? monthSchedules?.find(s => s.id === id)
      ?? prevSchedules.find(s => s.id === id);
    if (!sch) return;
    resetScheduleSession();
    setNewSch({
      text: sch.text,
      start_time: sch.start_time,
      end_time: sch.end_time,
      is_dday: sch.is_dday,
      color: 'purple',
      category: sch.category ?? 'Personal',
    });
    setEditingId(null);
    setEndNextDay(sch.end_next_day ?? false);
    setScheduleDateStr(formatDate(selectedDate));
    setShowForm(true);
  }, [formatDate, schedules, monthSchedules, prevSchedules, selectedDate, resetScheduleSession]);

  const scheduleDetailBlock = useMemo((): PlannerScheduleRow | null => {
    const target = scheduleDetailTarget;
    if (!target) return null;
    const selectedDateKey = validPlannerEventDate(formatDate(selectedDate));
    const targetDate = validPlannerEventDate(target.eventDate);
    let schedule: Schedule | ScheduleDday | undefined;
    let dateKey: string | undefined;

    if (targetDate) {
      if (targetDate === selectedDateKey) {
        schedule = schedules.find(item => item.id === target.id
          && scheduleMatchesDate(item, targetDate, selectedDateKey));
      }
      if (!schedule && targetDate === prevDateStr) {
        schedule = prevSchedules.find(item => item.id === target.id
          && scheduleMatchesDate(item, targetDate, prevDateStr));
      }
      if (!schedule) {
        schedule = ddaySchedules.find(item => item.id === target.id && item.is_dday === true
          && validPlannerEventDate(item.date) === targetDate);
      }
      if (!schedule) {
        schedule = monthSchedules?.find(item => item.id === target.id && item.date === targetDate);
      }
      dateKey = targetDate;
    } else {
      const selectedDaySchedule = schedules.find(item => item.id === target.id);
      schedule = selectedDaySchedule ?? prevSchedules.find(item => item.id === target.id)
        ?? monthSchedules?.find(item => item.id === target.id);
      if (schedule) {
        dateKey = validPlannerEventDate('date' in schedule ? schedule.date : undefined)
          ?? validPlannerEventDate(selectedDaySchedule ? formatDate(selectedDate) : prevDateStr);
      }
    }

    if (!schedule || !dateKey) return null;
    return toScheduleDetailRow(schedule, dateKey);
  }, [scheduleDetailTarget, schedules, prevSchedules, monthSchedules, ddaySchedules, selectedDate, formatDate, prevDateStr]);

  useEffect(() => {
    const request = scheduleNavigationRequest;
    if (!request) {
      handledScheduleNavigationRef.current = null;
      return;
    }
    if (handledScheduleNavigationRef.current === request.requestId) return;
    const consume = () => {
      handledScheduleNavigationRef.current = request.requestId;
      onScheduleNavigationConsumed?.(request.requestId);
    };
    const eventDate = validPlannerEventDate(request.eventDate);
    const selectedDateKey = validPlannerEventDate(formatDate(selectedDate));
    if (!accountId || request.accountId !== accountId
      || request.accountGeneration !== scheduleNavigationGeneration
      || !request.itemId || request.itemId.trim() !== request.itemId
      || !eventDate || eventDate !== request.eventDate) {
      consume();
      return;
    }
    if (selectedDateKey !== eventDate) {
      consume();
      return;
    }
    if (isScheduleLoading) return;

    const selectedSchedule = schedules.find(item => item.id === request.itemId
      && scheduleMatchesDate(item, eventDate, selectedDateKey));
    if (selectedSchedule) {
      setScheduleDetailTarget({ id: request.itemId, eventDate });
      consume();
      return;
    }
    if (isDdayLoading) return;

    const dday = ddaySchedules.find(item => item.id === request.itemId && item.is_dday === true
      && validPlannerEventDate(item.date) === eventDate);
    if (dday) setScheduleDetailTarget({ id: request.itemId, eventDate });
    consume();
  }, [scheduleNavigationRequest, accountId, scheduleNavigationGeneration, formatDate, selectedDate,
    isScheduleLoading, schedules, isDdayLoading, ddaySchedules, onScheduleNavigationConsumed]);

  const openScheduleDetail = useCallback((id: string) => {
    const selectedDaySchedule = schedules.find(s => s.id === id);
    const sch = selectedDaySchedule ?? prevSchedules.find(s => s.id === id)
      ?? monthSchedules?.find(s => s.id === id);
    const eventDate = sch
      ? validPlannerEventDate('date' in sch ? sch.date : undefined)
        ?? validPlannerEventDate(selectedDaySchedule ? formatDate(selectedDate) : prevDateStr)
      : undefined;
    if (sch) recordPlannerActivity(accountId, 'schedule', id, sch.text, Date.now(), eventDate);
    setScheduleDetailTarget({ id, ...(eventDate ? { eventDate } : {}) });
  }, [accountId, schedules, prevSchedules, monthSchedules, selectedDate, formatDate, prevDateStr]);

  useEffect(() => {
    return registerSearchDomainHandlers({
      onOpenPlannerItem: (itemId) => {
        openScheduleDetail(itemId);
      },
    });
  }, [openScheduleDetail]);

  const handleCalendarAnchorChange = useCallback((dateKey: string) => {
    const [y, m, d] = dateKey.split('-').map(Number);
    if (!y || !m || !d) return;
    setSelectedDate(new Date(y, m - 1, d));
    setCurrentDate(new Date(y, m - 1, 1));
  }, [setSelectedDate, setCurrentDate]);

  const cardScheduleActions = useMemo(() => ({
    onView: openScheduleDetail,
    onEdit: (id: string) => {
      setScheduleDetailTarget(null);
      const sch = schedules.find(s => s.id === id) ?? monthSchedules?.find(s => s.id === id);
      if (sch) openModal(
        sch,
        validPlannerEventDate('date' in sch ? sch.date : undefined) ?? formatDate(selectedDate),
      );
    },
    onDelete: (id: string) => {
      setScheduleDetailTarget(null);
      handleDeleteSchedule(id);
    },
    onDuplicate: handleDuplicateSchedule,
  }), [schedules, monthSchedules, selectedDate, formatDate, openScheduleDetail, handleDeleteSchedule, handleDuplicateSchedule]);

  return (
    <div className={`${WORKSPACE_PANE_ROOT_CLASS} abs-cosmos-planner flex flex-col animate-in fade-in duration-300 ${WORKSPACE_GAP_CLASS}`} data-workspace="planner" data-workspace-scroll-mode={WORKSPACE_SCROLL_MODE.pane} data-k134b-workspace-scroll>
      <div className="abs-cosmos-planner-header shrink-0 px-0.5">
        <WorkspacePageHeader
          workspace="schedule"
          title={t('planner')}
          subtitle={t('k125ScheduleSubtitle')}
          icon={Calendar}
          theme={theme}
          dark={appSettings.darkMode}
          trailing={(
            <button
              type="button"
              onClick={refreshSchedules}
              disabled={!accountId || !revalidateSelectedDaySchedules || isScheduleRefreshInFlight}
              aria-label={t('refreshSchedules')}
              aria-busy={visibleRefreshStatus === 'refreshing'}
              data-schedule-manual-refresh
              className={`inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition-colors ${theme.border} ${theme.text} ${theme.hoverBg} disabled:cursor-not-allowed disabled:opacity-60`}
            >
              <RefreshCw size={16} aria-hidden="true" className={visibleRefreshStatus === 'refreshing' ? 'animate-spin' : ''} />
              <span>{t('refreshSchedules')}</span>
            </button>
          )}
        />
        {refreshStatusMessageKey && (
          <p role="status" aria-live="polite" aria-atomic="true" className={`mt-1 text-xs ${theme.textMuted}`} data-schedule-refresh-status={visibleRefreshStatus}>
            {t(refreshStatusMessageKey)}
          </p>
        )}
        {monthReadStatusMessageKey && (
          <p role="status" aria-live="polite" aria-atomic="true" className={`mt-1 text-xs ${theme.textMuted}`} data-schedule-month-read-status={visibleMonthReadStatus}>
            {t(monthReadStatusMessageKey)}
          </p>
        )}
        {monthMutationRefreshMessageKey && (
          <p role="status" aria-live="polite" aria-atomic="true" className={`mt-1 text-xs ${theme.textMuted}`} data-schedule-month-mutation-status={visibleMonthMutationRefreshStatus}>
            {t(monthMutationRefreshMessageKey)}
          </p>
        )}
      </div>
      <CalendarShell
        now={now}
        anchorDate={formatDate(selectedDate)}
        schedules={schedules}
        monthSchedules={monthSchedules ?? []}
        previousDaySchedules={prevSchedules}
        previousDayDate={prevDateStr}
        todos={todos}
        ddaySchedules={ddaySchedules}
        weeklySchedules={weeklySchedules}
        appSettings={appSettings}
        theme={theme}
        onEventNoteClick={openPlannerNote}
        onAnchorDateChange={handleCalendarAnchorChange}
        dayScheduleActions={cardScheduleActions}
        eventActions={agendaEventActions}
        THEME_COLORS={THEME_COLORS}
        mutateStatic={mutateStatic}
        showToast={showToast}
        onAddSchedule={() => openModal()}
        onEditDday={(schedule) => openModal(schedule)}
        onDeleteDday={(id) => handleDeleteSchedule(id)}
      />

      {/* ── 스케줄 추가/편집 모달 ── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 backdrop-blur-sm" onClick={closeScheduleForm}>
          <div className={`${WORKSPACE_MODAL_SURFACE} w-full max-w-[380px]`} onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-heading text-lg font-bold">{editingId ? t('editSchedule') : t('newSchedule')}</h3>
              <button onClick={closeScheduleForm} className={`min-h-[40px] min-w-[40px] flex items-center justify-center rounded-full ${theme.hoverBg}`}><X size={18}/></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className={`block text-xs font-bold uppercase tracking-wide mb-1.5 ${theme.textMuted}`}>{t('labelText')}</label>
                <input autoFocus type="text" value={newSch.text} onChange={e => setNewSch({ ...newSch, text: e.target.value })}
                  onKeyDown={e => e.key === 'Enter' && !e.nativeEvent.isComposing && e.nativeEvent.keyCode !== 229 && handleSaveSchedule()}
                  className={`w-full rounded-xl p-3 outline-none focus:ring-2 focus:ring-primary text-sm font-semibold ${theme.input}`} placeholder={t('scheduleTextPh')}/>
              </div>
              <div>
                <label className={`block text-xs font-bold uppercase tracking-wide mb-1.5 ${theme.textMuted}`}>{t('k76ScheduleDate')}</label>
                <input
                  type="date"
                  value={scheduleDateStr}
                  onChange={e => setScheduleDateStr(e.target.value)}
                  className={`w-full rounded-xl p-3 outline-none focus:ring-2 focus:ring-primary text-sm font-semibold ${theme.input}`}
                  data-k139-event-date-picker
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(newSch.is_dday)}
                  onChange={e => setNewSch({ ...newSch, is_dday: e.target.checked })}
                />
                <span className={`text-xs font-semibold ${theme.textMuted}`}>{t('k80ShowAsDday')}</span>
              </label>
              {!newSch.is_dday ? (
              <>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className={`block text-xs font-bold uppercase tracking-wide mb-1.5 ${theme.textMuted}`}>{t('labelStart')}</label>
                  <input type="time" value={newSch.start_time} step="1800" lang={lang}
                    onChange={e => setNewSch({ ...newSch, start_time: e.target.value })}
                    className={`w-full rounded-xl p-3 outline-none font-medium text-sm tabular-nums ${theme.input}`}/>
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-1.5">
                    <label className={`text-xs font-bold uppercase tracking-wide ${theme.textMuted}`}>{t('labelEnd')}</label>
                    <button type="button"
                      onClick={() => setEndNextDay(v => !v)}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md transition-colors
                        ${endNextDay ? 'bg-primary text-primary-foreground' : `${theme.input} ${theme.textMuted}`}`}>
                      +1 day
                    </button>
                  </div>
                  <input type="time" value={newSch.end_time} step="1800" lang={lang}
                    onChange={e => setNewSch({ ...newSch, end_time: e.target.value })}
                    className={`w-full rounded-xl p-3 outline-none font-medium text-sm tabular-nums ${theme.input}
                      ${endNextDay ? 'ring-2 ring-primary' : ''}`}/>
                  {endNextDay && <p className="text-[10px] text-primary font-bold mt-1">{t('nextDay')}</p>}
                </div>
              </div>
              </>
              ) : (
                <>
                  <p className={`text-[11px] ${theme.textMuted}`}>{t('k80DdayTimeHint')}</p>
                </>
              )}
              <button onClick={handleSaveSchedule} disabled={isSavingSchedule} aria-busy={isSavingSchedule} className="w-full bg-primary text-primary-foreground font-bold text-base rounded-xl py-3 hover:opacity-90 transition-opacity shadow-md disabled:opacity-50">
                {t('saveSchedule')}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirm && <ConfirmModal key={confirm.requestId} message={confirm.message} onConfirm={() => handleConfirm(confirm.requestId)} onCancel={() => { clearConfirm(confirm.requestId); }} darkMode={appSettings.darkMode} confirmLabel={confirm.confirmLabel} variant={confirm.variant}/>}

      {scheduleDetailBlock ? (
        <ScheduleEventDetailPanel
          block={scheduleDetailBlock}
          theme={theme}
          dateLabel={formatLongDateKey(scheduleDetailBlock.dateKey, lang)}
          onEdit={(titleDraft) => {
            const detailDate = scheduleDetailBlock.dateKey;
            const sch = scheduleDetailBlock.isDday
              ? ddaySchedules.find(item => item.id === scheduleDetailBlock.id
                && item.is_dday === true && validPlannerEventDate(item.date) === detailDate)
              : detailDate === formatDate(selectedDate)
                ? schedules.find(item => item.id === scheduleDetailBlock.id
                  && scheduleMatchesDate(item, detailDate, detailDate))
                : detailDate === prevDateStr
                  ? prevSchedules.find(item => item.id === scheduleDetailBlock.id
                    && scheduleMatchesDate(item, detailDate, prevDateStr))
                  : monthSchedules?.find(item => item.id === scheduleDetailBlock.id
                    && item.date === detailDate);
            setScheduleDetailTarget(null);
            if (sch) openModal(
              titleDraft === undefined ? sch : { ...sch, text: titleDraft },
              scheduleDetailBlock.dateKey,
            );
          }}
          onDelete={() => {
            handleDeleteSchedule(scheduleDetailBlock.id);
            setScheduleDetailTarget(null);
          }}
          onDuplicate={!scheduleDetailBlock.isDday ? () => {
            handleDuplicateSchedule(scheduleDetailBlock.id);
            setScheduleDetailTarget(null);
          } : undefined}
          onClose={() => setScheduleDetailTarget(null)}
        />
      ) : null}

      {eventDialog ? (
        <EventNoteDialog
          colors={noteChrome}
          mode={eventDialog.mode}
          initialValues={eventDialog.initialValues}
          onSave={handleEventDialogSave}
          onRemoveEvent={eventDialog.mode === 'edit' ? handleRemoveEventStatus : undefined}
          onClose={() => setEventDialog(null)}
        />
      ) : null}
    </div>
  );
};
