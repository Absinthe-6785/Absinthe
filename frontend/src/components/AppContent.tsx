import { useState, useCallback, useMemo, useEffect, useRef, lazy, Suspense } from 'react';
import { User } from '@supabase/supabase-js';
import { CheckCircle, AlertCircle, AlertTriangle, Info, Loader2 } from 'lucide-react';

import { supabase } from '../lib/supabase';
import { registerNotesTabSwitcher, registerAppTabSwitcher, openWorkspaceSearch } from '../lib/noteNavigation';
import { useAppStore } from '../store/useAppStore';
import { useNotesStore } from '../store/useNotesStore';
import { useNow } from '../hooks/useNow';
import { useToast } from '../hooks/useToast';
import { useDailyData } from '../hooks/useDaily';
import { useStaticData } from '../hooks/useStatic';
import { useSWRConfig } from 'swr';
import { ThemeColor, ViewProps } from '../types';
import { buildThemeClasses } from '../theme';
import { Sidebar, TabId, type SettingsSectionId } from './common/Sidebar';
import { ViewLoadingFallback } from './common/ViewLoadingFallback';

import { NotesRouteBoundary } from './NotesRouteBoundary';

const HomeView = lazy(() => import('./views/HomeView').then(m => ({ default: m.HomeView })));
const PlannerView = lazy(() => import('./views/PlannerView').then(m => ({ default: m.PlannerView })));
const HealthView = lazy(() => import('./views/HealthView').then(m => ({ default: m.HealthView })));
const AnalyticsView = lazy(() => import('./views/AnalyticsView').then(m => ({ default: m.AnalyticsView })));
const SettingsView = lazy(() => import('./views/SettingsView').then(m => ({ default: m.SettingsView })));
const RecipeView = lazy(() => import('./views/RecipeView').then(m => ({ default: m.RecipeView })));
import { migrateLegacyDdays } from '../lib/migrateLegacyDdays';
import { runPeriodicSnapshotSlots } from '../lib/vaultSnapshotAuto';
import { GlobalSearchHost } from './views/features/search/GlobalSearchHost';
import { useTranslation } from '../lib/i18n';
import { bootstrapHealthFromSupabase, HEALTH_LOCAL_BOOTSTRAP_COMPLETE_EVENT } from '../lib/healthSupabaseBootstrap';
import { runHealthBootstrapSingleFlight } from '../lib/healthBootstrapSingleFlight';
import { domainUsesLocalWorkingCopy } from '../lib/syncAuthority';
import { revalidatePlannerAccountCache } from '../lib/plannerCacheRevalidation';
import { notesStartupRequiresRecovery } from '../lib/notesStartupAuthority';
import { createProductionWorkoutRuntimeAuthorityController } from '../lib/workoutRuntimeAuthority';
import { WORKSPACE_SCROLL_MODE, WORKSPACE_VIEWPORT_CLASS } from './common/workspaceLayout';
import { HEALTH_SELECTED_DAY_COMPOSITE_READER_ENABLED } from './views/features/health/healthSelectedDayCompositeConfig';
import { useHealthSelectedDayComposite } from './views/features/health/useHealthSelectedDayComposite';
import { isHomeWorkoutCompositeEnabled } from './views/features/home/homeWorkoutCompositeConfig';
import { isHealthWorkoutRangeCompositeEnabled } from './views/features/health/healthWorkoutRangeCompositeConfig';
import { useHealthWorkoutRangeSnapshot } from './views/features/health/useHealthWorkoutRangeSnapshot';
import { previousWorkoutRange } from './views/features/health/previousWorkoutSession';
import { isSearchWorkoutCompositeEnabled, type SearchActivation, type SearchHostLifetime } from './views/features/search/searchWorkoutCompositeConfig';
import type { SearchWorkoutPreviewEvidence } from './views/features/search/searchWorkoutCompositeProjection';
import {
  startIndependentStartup,
  type IndependentStartupRun,
  type StartupDomainState,
} from '../lib/startupBootstrapCoordinator';

// ── 상수 — 모듈 레벨로 분리해 매 렌더마다 재생성 방지 ──────────────
const THEME_COLORS: ThemeColor[] = [
  { id: 'gold',   bg: 'bg-amber-600',  text: 'text-white', border: 'border-amber-600' },
  { id: 'blue',   bg: 'bg-sky-600',    text: 'text-white', border: 'border-sky-600'   },
  { id: 'green',  bg: 'bg-emerald-600', text: 'text-white', border: 'border-emerald-600' },
  { id: 'purple', bg: 'bg-violet-600', text: 'text-white', border: 'border-violet-600' },
  { id: 'pink',   bg: 'bg-rose-500',   text: 'text-white', border: 'border-rose-500'   },
  { id: 'gray',   bg: 'bg-slate-500',  text: 'text-white', border: 'border-slate-500'  },
];

type StartupState = {
  notes: StartupDomainState;
  health: StartupDomainState;
};

const SAFE_STARTUP_DIAGNOSTIC_CODES = new Set([
  'notes_startup_recovery_required',
  'health_bootstrap_authenticated_account_mismatch',
  'health_bootstrap_stale_account',
  'health_local_data_not_verified',
  'health_local_verified_data_malformed',
  'health_local_verified_state_mismatch',
  'health_pending_snapshot_missing',
  'health_pending_snapshot_binding_mismatch',
  'health_indexeddb_unavailable',
]);

function safeStartupDiagnosticCode(error: string | null): string {
  return error && SAFE_STARTUP_DIAGNOSTIC_CODES.has(error)
    ? error
    : 'startup_domain_failed';
}

function pendingStartupState(healthBootstrapRequired: boolean): StartupState {
  return {
    notes: { status: 'pending', error: null },
    health: healthBootstrapRequired
      ? { status: 'pending', error: null }
      : { status: 'ready', error: null },
  };
}

function StartupFailureBoundary({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-1 items-center justify-center p-6" role="alert">
      <div className="w-full max-w-md rounded-2xl border border-danger/30 bg-surface p-6 text-center shadow-absinthe-lg">
        <p className="font-semibold text-primary">{message}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
        >
          {t('startupRetry')}
        </button>
      </div>
    </div>
  );
}

function StartupFailureNotice({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-danger/30 bg-surface px-4 py-3 text-sm text-primary" role="status">
      <span>{message}</span>
      <button type="button" onClick={onRetry} className="shrink-0 rounded-lg bg-primary px-3 py-1.5 font-bold text-primary-foreground">
        {t('startupRetry')}
      </button>
    </div>
  );
}

export function AppContent({ authUser }: { authUser: User }) {
  const { appSettings, updateSetting } = useAppStore();
  const { t } = useTranslation();
  const translationRef = useRef(t);
  translationRef.current = t;
  const bootstrapFromSupabase = useNotesStore(s => s.bootstrapFromSupabase);
  const initNotesStorage = useNotesStore(s => s.initNotesStorage);
  const detachNotesStorage = useNotesStore(s => s.detachNotesStorage);
  const startupRunRef = useRef<IndependentStartupRun | null>(null);
  const workoutAuthorityRef = useRef<ReturnType<typeof createProductionWorkoutRuntimeAuthorityController> | null>(null);
  const healthBootstrapRequired = domainUsesLocalWorkingCopy('health_workouts') && authUser.id !== 'local-user';
  const shouldBootstrapHealth = authUser.id !== 'local-user';
  const [startupState, setStartupState] = useState<StartupState>(() => pendingStartupState(healthBootstrapRequired));
  const [healthStartupAccountId, setHealthStartupAccountId] = useState(authUser.id);

  // ── 1. now / formatDate / isToday ────────────────────────────────
  const { now, formatDate, isToday } = useNow();

  // ── 2. Toast — must be declared before effects that call showToast ─
  const { toast, showToast } = useToast();

  // ── 3. 날짜 상태 ──────────────────────────────────────────────────
  const [currentDate, setCurrentDate] = useState(now.toJSDate());
  const [selectedDate, setSelectedDate] = useState(now.toJSDate());

  const [activeTab, setActiveTab] = useState<TabId>('home');
  // Search owns the live query; this small upward signal only controls the
  // deferred Search datasets in the shell-owned hooks.
  const [searchHasQuery, setSearchHasQuery] = useState(false);
  const searchHostRef = useRef<SearchHostLifetime>({ accountId: authUser.id, mounted: false, current: null });
  if (searchHostRef.current.accountId !== authUser.id) {
    searchHostRef.current.mounted = false;
    searchHostRef.current.current = null;
    searchHostRef.current = { accountId: authUser.id, mounted: false, current: null };
  }
  const searchHost = searchHostRef.current;
  const [searchActivation, setSearchActivation] = useState<SearchActivation | null>(null);
  const onSearchActivationChange = useCallback((signal: SearchActivation) => {
    if (signal.host !== searchHostRef.current || !signal.host.mounted || signal.host.current !== signal) return;
    setSearchActivation(signal);
  }, []);
  const [settingsScrollTarget, setSettingsScrollTarget] = useState<SettingsSectionId | null>(null);

  // Notes and Health have separate internal sequencing, but both begin after
  // the same authenticated account boundary. A slow domain no longer holds
  // the other domain's startup or the unrelated shell.
  useEffect(() => {
    let cancelled = false;
    setStartupState(pendingStartupState(healthBootstrapRequired));
    setHealthStartupAccountId(authUser.id);
    const run = startIndependentStartup({
      startNotes: async () => {
        await initNotesStorage(authUser.id);
        if (cancelled) return;
        await bootstrapFromSupabase();
        if (cancelled) return;
        const notesState = useNotesStore.getState();
        if (notesStartupRequiresRecovery({
          syncError: notesState.syncError,
          noteCount: notesState.notes.length,
          folderCount: notesState.folders.length,
          notesAuthorityState: notesState.notesAuthorityState,
          foldersAuthorityState: notesState.foldersAuthorityState,
        })) {
          throw new Error('notes_startup_recovery_required');
        }
        const { notes, folders } = useNotesStore.getState();
        runPeriodicSnapshotSlots(notes, folders);
        void migrateLegacyDdays(count => {
          if (count > 0 && !cancelled) {
            showToast(translationRef.current('scheduleCountdownMigrated').replace('{count}', String(count)), 'info');
          }
        });
      },
      startHealth: shouldBootstrapHealth
        ? async () => {
          await runHealthBootstrapSingleFlight(authUser.id, () => bootstrapHealthFromSupabase({
            accountId: authUser.id,
            email: authUser.email,
          }));
        }
        : null,
      onStateChange: (domain, state) => {
        setStartupState(previous => ({ ...previous, [domain]: state }));
        if (import.meta.env.DEV && state.status === 'failed') {
          console.error(`[${domain}-startup] ${safeStartupDiagnosticCode(state.error)}`);
        }
      },
    });
    startupRunRef.current = run;
    return () => {
      cancelled = true;
      run.cancel();
      startupRunRef.current = null;
      detachNotesStorage();
    };
  }, [authUser.email, authUser.id, bootstrapFromSupabase, detachNotesStorage, healthBootstrapRequired, initNotesStorage, showToast, shouldBootstrapHealth]);

  // Independent, non-blocking G5A control-plane bootstrap. Health's existing
  // readiness and Workout product reader/writer do not depend on this result.
  useEffect(() => {
    const controller = workoutAuthorityRef.current
      ?? (workoutAuthorityRef.current = createProductionWorkoutRuntimeAuthorityController());
    let active = true;
    // A StrictMode setup/cleanup replay in one turn must not start two requests.
    queueMicrotask(() => { if (active) void controller.start(authUser.id); });
    return () => { active = false; controller.cancel(); };
  }, [authUser.id]);

  useEffect(() => {
    const unregisterNotes = registerNotesTabSwitcher(() => setActiveTab('note'));
    const unregisterApp = registerAppTabSwitcher(setActiveTab);
    return () => {
      unregisterNotes();
      unregisterApp();
    };
  }, []);

  useEffect(() => {
    const TAB_BY_ALT: Record<string, TabId> = {
      '1': 'note',
      '2': 'health',
      '3': 'planner',
      '4': 'analytics',
      '5': 'recipe',
    };
    const handler = (e: KeyboardEvent) => {
      const target = e.target;
      if (
        target instanceof HTMLElement
        && target.closest('[contenteditable="true"], .be-editable, input, textarea, select')
      ) {
        return;
      }
      if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && TAB_BY_ALT[e.key]) {
        e.preventDefault();
        setActiveTab(TAB_BY_ALT[e.key]!);
        return;
      }
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        openWorkspaceSearch();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ── 4. SWR ────────────────────────────────────────────────────────
  const dateStr = formatDate(selectedDate);
  // The previous account's ready state must not render Health while this
  // account's bootstrap is still waiting for its first effect.
  const healthStartupCurrent = healthStartupAccountId === authUser.id;
  const healthRuntimeReady = healthStartupCurrent
    && (!healthBootstrapRequired || startupState.health.status === 'ready');
  const selectedDayReaderEnabled = HEALTH_SELECTED_DAY_COMPOSITE_READER_ENABLED && activeTab === 'health';
  const homeCompositeEnabled = isHomeWorkoutCompositeEnabled({
    homeActive: activeTab === 'home', accountPresent: Boolean(authUser.id),
  });
  const sharedSelectedDayReaderEnabled = selectedDayReaderEnabled || homeCompositeEnabled;
  const workoutRangeReaderEnabled = isHealthWorkoutRangeCompositeEnabled({
    healthActive: activeTab === 'health',
    accountPresent: Boolean(authUser.id),
  });
  const searchCompositeEnabled = isSearchWorkoutCompositeEnabled(searchHost, searchActivation, authUser.id);
  const rangeSourceEnabled = workoutRangeReaderEnabled || searchCompositeEnabled;
  const searchCurrentRef = useRef({ accountId: authUser.id, dateStr, searchCompositeEnabled });
  searchCurrentRef.current = { accountId: authUser.id, dateStr, searchCompositeEnabled };
  const searchPreviewScope = useMemo(() => searchCompositeEnabled && searchActivation ? {
    localDate: dateStr,
    lifetime: searchActivation,
    isCurrent: () => searchCurrentRef.current.dateStr === dateStr
      && searchCurrentRef.current.searchCompositeEnabled
      && isSearchWorkoutCompositeEnabled(searchHostRef.current, searchActivation, searchCurrentRef.current.accountId),
  } : undefined, [dateStr, searchActivation, searchCompositeEnabled]);
  const selectedDayReadSource = useHealthSelectedDayComposite(
    sharedSelectedDayReaderEnabled,
    authUser.id,
    homeCompositeEnabled ? formatDate(now.toJSDate()) : dateStr,
    { managedLifecycle: rangeSourceEnabled },
  );
  const todosSearchActive = searchHasQuery || activeTab === 'planner';
  // Search keeps its legacy-only daily source; the gated Health editor uses
  // the independently verified, paired selected-day snapshot instead.
  const legacyDailyActive = (healthRuntimeReady && !selectedDayReaderEnabled)
    || (selectedDayReaderEnabled && searchHasQuery);
  const inbodyActive = activeTab === 'health' && healthRuntimeReady;
  const {
    schedules, todos, todosState, routines, workouts, inbody,
    mutate: mutateDaily,
    mutateTodos, mutateRoutines,
    isLoading: isDailyLoading,
  // AppContent owns the shell hook; only consumer-driven candidates are gated.
  // useDailyData(dateStr, showToast, authUser.id, healthRuntimeReady, todosSearchActive, inbodyActive)
  } = useDailyData(dateStr, showToast, authUser.id,
    legacyDailyActive, todosSearchActive, inbodyActive);

  // useNow가 1분마다 now를 갱신 → AppContent 리렌더 → monthStart/monthEnd 매번 재계산.
  // currentDate가 바뀔 때만 실제로 값이 달라지므로 useMemo로 명시적 메모이제이션.
  const { monthStart, monthEnd } = useMemo(() => ({
    monthStart: formatDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)),
    monthEnd:   formatDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)),
  }), [currentDate, formatDate]);
  const previousBounds = useMemo(() => previousWorkoutRange(dateStr), [dateStr]);
  const workoutRangeReadSource = useHealthWorkoutRangeSnapshot(
    rangeSourceEnabled,
    authUser.id,
    previousBounds,
    { startDate: monthStart, endDate: monthEnd },
    undefined,
    searchPreviewScope,
  );
  const selectedDayRetryRef = useRef(selectedDayReadSource.retry);
  const rangeInvalidateRef = useRef(workoutRangeReadSource.invalidateAndReload);
  const rangeReaderEnabledRef = useRef(rangeSourceEnabled);
  const rangeAccountRef = useRef(authUser.id);
  const healthRangeEnabledRef = useRef(workoutRangeReaderEnabled);
  const currentSharedReaderAccountRef = useRef<string | null>(null);
  const sharedOwnerMountedRef = useRef(false);
  selectedDayRetryRef.current = selectedDayReadSource.retry;
  rangeInvalidateRef.current = workoutRangeReadSource.invalidateAndReload;
  rangeReaderEnabledRef.current = rangeSourceEnabled;
  rangeAccountRef.current = authUser.id;
  healthRangeEnabledRef.current = workoutRangeReaderEnabled;
  currentSharedReaderAccountRef.current = sharedSelectedDayReaderEnabled
    ? authUser.id
    : null;
  const refreshCompositeWorkoutReaders = useCallback(() => {
    if (rangeReaderEnabledRef.current) rangeInvalidateRef.current();
    selectedDayRetryRef.current();
  }, []);
  const onLocalWorkoutCommitted = useCallback((committedAccountId: string) => {
    if (!sharedOwnerMountedRef.current) return;
    const qualifiedSearch = isSearchWorkoutCompositeEnabled(searchHostRef.current,
      searchHostRef.current.current, rangeAccountRef.current);
    const rangeEligible = rangeReaderEnabledRef.current && rangeAccountRef.current === committedAccountId
      && (healthRangeEnabledRef.current || qualifiedSearch);
    // Fence the broad snapshot first, then the selected-day projection.
    if (rangeEligible) rangeInvalidateRef.current();
    if (currentSharedReaderAccountRef.current === committedAccountId) selectedDayRetryRef.current();
  }, []);
  const selectedDayRead = useMemo(() => workoutRangeReaderEnabled
    ? { ...selectedDayReadSource, retry: refreshCompositeWorkoutReaders }
    : selectedDayReadSource,
  [refreshCompositeWorkoutReaders, selectedDayReadSource, workoutRangeReaderEnabled]);
  const workoutRangeRead = useMemo(() => ({
    ...workoutRangeReadSource,
    retry: refreshCompositeWorkoutReaders,
  }), [refreshCompositeWorkoutReaders, workoutRangeReadSource]);
  const healthBlocksSearchActive = searchHasQuery || activeTab === 'health';
  const markedDatesActive = false;
  const healthRoutinesActive = activeTab === 'health'
    && (healthRuntimeReady || (selectedDayReaderEnabled && domainUsesLocalWorkingCopy('health_routine_presets')));
  const {
    markedDates, healthBlocks, healthBlocksState, healthRoutines, healthRoutinesState, weeklySchedules,
    mutate: mutateStatic,
  // AppContent owns static lifecycle; activation flags follow real consumers.
  // useStaticData(monthStart, monthEnd, showToast, authUser.id, healthRuntimeReady, healthBlocksSearchActive, markedDatesActive, healthRoutinesActive)
  } = useStaticData(monthStart, monthEnd, showToast, authUser.id,
    healthRuntimeReady || selectedDayReaderEnabled, healthBlocksSearchActive, markedDatesActive, healthRoutinesActive);

  const { mutate: globalMutate } = useSWRConfig();

  // A successful cloud restore changes Planner-owned remote rows. Revalidate
  // only this account's affected Planner keys (including inactive dates); no
  // global cache clear.
  const revalidatePlannerAfterRestore = useCallback(() => {
    mutateDaily();
    mutateStatic();
    revalidatePlannerAccountCache(globalMutate, authUser.id);
  }, [authUser.id, globalMutate, mutateDaily, mutateStatic]);

  useEffect(() => {
    const refreshLocalHealth = () => {
      if (rangeReaderEnabledRef.current) refreshCompositeWorkoutReaders();
      mutateDaily();
      mutateStatic();
    };
    window.addEventListener(HEALTH_LOCAL_BOOTSTRAP_COMPLETE_EVENT, refreshLocalHealth);
    return () => window.removeEventListener(HEALTH_LOCAL_BOOTSTRAP_COMPLETE_EVENT, refreshLocalHealth);
  }, [mutateDaily, mutateStatic, refreshCompositeWorkoutReaders]);

  useEffect(() => {
    if (!rangeSourceEnabled) return;
    let lastRefresh = 0;
    const refreshOnFocus = () => {
      if (document.visibilityState === 'hidden') return;
      const now = Date.now();
      if (now - lastRefresh < 250) return;
      lastRefresh = now;
      refreshCompositeWorkoutReaders();
    };
    window.addEventListener('focus', refreshOnFocus);
    document.addEventListener('visibilitychange', refreshOnFocus);
    return () => {
      window.removeEventListener('focus', refreshOnFocus);
      document.removeEventListener('visibilitychange', refreshOnFocus);
    };
  }, [refreshCompositeWorkoutReaders, rangeSourceEnabled]);

  useEffect(() => {
    sharedOwnerMountedRef.current = true;
    return () => { sharedOwnerMountedRef.current = false; };
  }, []);

  // ── 5. Theme — Absinthe Design System tokens via CSS variables ───
  const theme = useMemo(() => buildThemeClasses(), []);

  // ── 6. user — useMemo로 안정화 ────────────────────────────────────
  // 개선 전: const user = { ... } — 매 렌더마다 새 객체 생성 → globalProps useMemo deps
  //          에 넣으면 무한 루프, 빼면 stale closure. 양쪽 다 문제.
  // 개선 후: authUser.id / email이 바뀔 때만 새 객체 생성 → deps에 안전하게 포함 가능.
  const user = useMemo(() => ({
    id:   authUser.id,
    name: authUser.email?.split('@')[0] || 'User',
  }), [authUser.id, authUser.email]);

  // ── 7. Auth ───────────────────────────────────────────────────────
  const handleSignOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const openSettingsSection = useCallback((section: SettingsSectionId) => {
    setSettingsScrollTarget(section);
    setActiveTab('settings');
  }, []);

  const homeNavigationRef = useRef({ accountId: authUser.id, enabled: homeCompositeEnabled, lifetime: 0 });
  const homeNavigationPrevious = homeNavigationRef.current;
  const homeNavigationLifetime = homeNavigationPrevious.lifetime
    + Number(homeNavigationPrevious.accountId !== authUser.id || homeNavigationPrevious.enabled !== homeCompositeEnabled);
  homeNavigationRef.current = { accountId: authUser.id, enabled: homeCompositeEnabled, lifetime: homeNavigationLifetime };
  const openTodayWorkout = useCallback(() => {
    const current = homeNavigationRef.current;
    if (!current.enabled || current.accountId !== authUser.id || current.lifetime !== homeNavigationLifetime) return;
    // Capture the action-time instant; existing formatDate/local calendar semantics
    // interpret it in the user timezone, without waiting for useNow's minute tick.
    const today = new Date();
    setSelectedDate(today);
    setCurrentDate(today);
    setActiveTab('health');
  }, [authUser.id, homeNavigationLifetime]);

  const previewCurrentRef = useRef(workoutRangeReadSource.isPreviewCurrent);
  previewCurrentRef.current = workoutRangeReadSource.isPreviewCurrent;
  const openSearchWorkoutPreview = useCallback((evidence: SearchWorkoutPreviewEvidence): boolean => {
    const current = searchCurrentRef.current;
    if (!sharedOwnerMountedRef.current || !current.searchCompositeEnabled
      || evidence.accountId !== current.accountId || evidence.localDate !== current.dateStr
      || !previewCurrentRef.current(evidence.read)) return false;
    const [year, month, day] = evidence.localDate.split('-').map(Number);
    // Calendar-only navigation; no Notes helper, recent write, or repository query.
    const date = new Date(year!, month! - 1, day!, 12);
    setSelectedDate(date);
    setCurrentDate(date);
    setActiveTab('health');
    return true;
  }, []);
  const retrySearchWorkoutPreview = useCallback(() => {
    if (sharedOwnerMountedRef.current && isSearchWorkoutCompositeEnabled(searchHostRef.current,
      searchHostRef.current.current, rangeAccountRef.current)) rangeInvalidateRef.current();
  }, []);

  // ── 8. globalProps ────────────────────────────────────────────────
  // 개선 전: eslint-disable로 deps 경고를 무시. user/formatDate/showToast 등 stable
  //          ref들이 누락되어 stale closure 가능성 존재.
  // 개선 후: 모든 deps를 명시. stable refs(useCallback/useMemo 결과)는 참조가
  //          바뀌지 않으므로 deps에 포함해도 불필요한 리렌더가 발생하지 않음.
  const globalProps: ViewProps = useMemo(() => ({
    user, now, currentDate, setCurrentDate, selectedDate, setSelectedDate,
    formatDate, isToday, showToast,
    mutateDaily, mutateStatic,
    mutateTodos, mutateRoutines,
    appSettings, updateSetting, theme, THEME_COLORS,
    schedules, todos, routines, workouts, inbody, weeklySchedules,
    markedDates, healthBlocks, healthRoutines,
    isDailyLoading,
    onSignOut: handleSignOut,
  }), [
    user, now, currentDate, setCurrentDate, selectedDate, setSelectedDate,
    formatDate, isToday, showToast,
    mutateDaily, mutateStatic, mutateTodos, mutateRoutines,
    appSettings, updateSetting, theme,
    schedules, todos, routines, workouts, inbody, weeklySchedules,
    markedDates, healthBlocks, healthRoutines,
    isDailyLoading,
    handleSignOut,
  ]);

  return (
    <div
      className="abs-cosmos-shell flex flex-col lg:flex-row h-[100dvh] min-h-0 min-w-0 font-body p-0 lg:p-3 relative transition-colors duration-500 overflow-hidden bg-background"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      data-app-shell
      data-app-height-owner="dynamic-viewport"
    >
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        appSettings={appSettings}
        updateSetting={updateSetting}
        handleSignOut={handleSignOut}
        userName={user.name}
        onOpenSettingsSection={openSettingsSection}
      />

      <div
        className={`${WORKSPACE_VIEWPORT_CLASS} flex flex-col p-3 lg:p-0`}
        data-workspace-viewport
        data-workspace-scroll-mode={WORKSPACE_SCROLL_MODE.delegated}
      >
        <Suspense fallback={<ViewLoadingFallback />}>
          {activeTab === 'home' && <HomeView key={authUser.id} {...globalProps}
            homeWorkoutComposite={homeCompositeEnabled ? selectedDayRead : undefined}
            onOpenTodayWorkout={homeCompositeEnabled ? openTodayWorkout : undefined} />}
          {activeTab === 'planner'   && <PlannerView   key={authUser.id} {...globalProps} />}
          {activeTab === 'health' && !selectedDayReaderEnabled && (!healthStartupCurrent || (healthBootstrapRequired && startupState.health.status === 'pending')) && (
            <ViewLoadingFallback label={t('startupHealthLoading')} />
          )}
          {activeTab === 'health' && !selectedDayReaderEnabled && healthStartupCurrent && healthBootstrapRequired && startupState.health.status === 'failed' && (
            <StartupFailureBoundary
              message={t('startupHealthFailed')}
              onRetry={() => startupRunRef.current?.retry('health')}
            />
          )}
          {activeTab === 'health' && !selectedDayReaderEnabled && healthRuntimeReady && (
            <>
              {startupState.health.status === 'failed' && (
                <StartupFailureNotice
                  message={t('startupHealthFailed')}
                  onRetry={() => startupRunRef.current?.retry('health')}
                />
              )}
              <HealthView key={authUser.id} {...globalProps} />
            </>
          )}
          {selectedDayReaderEnabled && (
            <>
              {(!healthStartupCurrent || startupState.health.status === 'pending') && (
                <div role="status" data-health-remote-bootstrap="pending" className="mb-3 rounded-xl border px-4 py-2 text-xs">
                  Remote Health recovery is pending; verified local workout sources are read independently.
                </div>
              )}
              {healthStartupCurrent && startupState.health.status === 'failed' && (
                <StartupFailureNotice message={t('startupHealthFailed')}
                  onRetry={() => startupRunRef.current?.retry('health')} />
              )}
              <HealthView key={authUser.id} {...globalProps}
                workouts={selectedDayRead.legacyDaily?.workouts ?? []}
                inbody={selectedDayRead.legacyDaily?.inbody ?? { weight: 0, smm: 0, pbf: 0 }}
                isDailyLoading={selectedDayRead.phase === 'loading'}
                healthRoutinesState={healthRoutinesState}
                selectedDayComposite={selectedDayRead}
                workoutRangeComposite={workoutRangeReaderEnabled ? workoutRangeRead : undefined}
                onLocalWorkoutCommitted={onLocalWorkoutCommitted}
              />
            </>
          )}
          {activeTab === 'analytics' && (
            <AnalyticsView
              {...globalProps}
              accountId={authUser.id}
              onPlannerRestoreComplete={revalidatePlannerAfterRestore}
            />
          )}
          {activeTab === 'settings'  && (
            <SettingsView
              {...globalProps}
              settingsScrollTarget={settingsScrollTarget}
              onSettingsScrollTargetConsumed={() => setSettingsScrollTarget(null)}
            />
          )}
          {activeTab === 'recipe'    && <RecipeView key={authUser.id} accountId={authUser.id} showToast={showToast} appSettings={appSettings} updateSetting={updateSetting} theme={theme} THEME_COLORS={THEME_COLORS}/>}
        </Suspense>
        {activeTab === 'note' && startupState.notes.status === 'pending' && (
          <ViewLoadingFallback label={t('startupNotesLoading')} />
        )}
        {activeTab === 'note' && startupState.notes.status === 'failed' && (
          <StartupFailureBoundary
            message={t('startupNotesFailed')}
            onRetry={() => startupRunRef.current?.retry('notes')}
          />
        )}
        {startupState.notes.status === 'ready' && (
          <NotesRouteBoundary active={activeTab === 'note'} showToast={showToast} accountId={authUser.id} />
        )}
      </div>

      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full shadow-2xl z-[999] animate-in slide-in-from-bottom-5 font-semibold text-sm flex items-center gap-2 ${
            toast.type === 'error'
              ? 'abs-danger-filled-control'
              : toast.type === 'warning'
                ? 'bg-amber-500 text-white'
                : toast.type === 'info'
                  ? 'bg-blue-600 text-white'
                  : 'bg-surface-alt text-primary'
          }`}
        >
          {toast.type === 'error' ? <AlertCircle size={16} />
            : toast.type === 'warning' ? <AlertTriangle size={16} />
              : toast.type === 'info' ? <Info size={16} />
                : <CheckCircle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* Daily data fetch feedback; Health startup has its own boundary. */}
      {isDailyLoading && (activeTab === 'home' || activeTab === 'health') && (
        <div
          data-testid="global-daily-spinner"
          className="fixed top-6 right-6 bg-surface-alt p-3 rounded-absinthe-full shadow-absinthe-lg z-[999] text-primary"
        >
          <Loader2 size={20} className="animate-spin" />
        </div>
      )}

      <GlobalSearchHost
        key={authUser.id}
        accountId={authUser.id}
        appSettings={appSettings}
        onSearchHasQueryChange={setSearchHasQuery}
        searchHostLifetime={searchHost}
        onSearchActivationChange={onSearchActivationChange}
        workoutPreviewRead={searchCompositeEnabled ? workoutRangeReadSource.previewRead : undefined}
        onOpenWorkoutPreview={openSearchWorkoutPreview}
        onRetryWorkoutPreview={retrySearchWorkoutPreview}
        schedules={schedules}
        todos={todos}
        todosState={todosState}
        routines={routines}
        workouts={workouts}
        healthBlocks={healthBlocks}
        healthBlocksState={healthBlocksState}
        weeklySchedules={weeklySchedules}
      />
    </div>
  );
}
