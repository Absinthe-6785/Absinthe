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
import { ThemeColor, ViewProps } from '../types';
import { buildThemeClasses } from '../theme';
import { Sidebar, TabId, type SettingsSectionId } from './common/Sidebar';
import { ViewLoadingFallback } from './common/ViewLoadingFallback';

import { NoteView } from './views/NoteView';

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
import { shouldUseRemoteData } from '../lib/remoteBoundary';
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
  const healthBootstrapRequired = !shouldUseRemoteData() && authUser.id !== 'local-user';
  const shouldBootstrapHealth = authUser.id !== 'local-user';
  const [startupState, setStartupState] = useState<StartupState>(() => pendingStartupState(healthBootstrapRequired));

  // ── 1. now / formatDate / isToday ────────────────────────────────
  const { now, formatDate, isToday } = useNow();

  // ── 2. Toast — must be declared before effects that call showToast ─
  const { toast, showToast } = useToast();

  // ── 3. 날짜 상태 ──────────────────────────────────────────────────
  const [currentDate, setCurrentDate] = useState(now.toJSDate());
  const [selectedDate, setSelectedDate] = useState(now.toJSDate());

  const [activeTab, setActiveTab] = useState<TabId>('home');
  const [settingsScrollTarget, setSettingsScrollTarget] = useState<SettingsSectionId | null>(null);

  // Notes and Health have separate internal sequencing, but both begin after
  // the same authenticated account boundary. A slow domain no longer holds
  // the other domain's startup or the unrelated shell.
  useEffect(() => {
    let cancelled = false;
    setStartupState(pendingStartupState(healthBootstrapRequired));
    const run = startIndependentStartup({
      startNotes: async () => {
        await initNotesStorage(authUser.id);
        if (cancelled) return;
        await bootstrapFromSupabase();
        if (cancelled) return;
        const notesState = useNotesStore.getState();
        const authorityFailed = notesState.notesAuthorityState === 'RECOVERY_REQUIRED'
          || notesState.foldersAuthorityState === 'RECOVERY_REQUIRED';
        const emptyAfterFailure = Boolean(notesState.syncError)
          && notesState.notes.length === 0
          && notesState.folders.length === 0;
        if (authorityFailed || emptyAfterFailure) {
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
  const healthRuntimeReady = !healthBootstrapRequired || startupState.health.status === 'ready';
  const {
    schedules, todos, routines, workouts, inbody,
    mutate: mutateDaily,
    mutateTodos, mutateRoutines,
    isLoading: isDailyLoading,
  } = useDailyData(dateStr, showToast, authUser.id, healthRuntimeReady);

  // useNow가 1분마다 now를 갱신 → AppContent 리렌더 → monthStart/monthEnd 매번 재계산.
  // currentDate가 바뀔 때만 실제로 값이 달라지므로 useMemo로 명시적 메모이제이션.
  const { monthStart, monthEnd } = useMemo(() => ({
    monthStart: formatDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)),
    monthEnd:   formatDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)),
  }), [currentDate, formatDate]);
  const {
    markedDates, healthBlocks, healthRoutines, weeklySchedules,
    mutate: mutateStatic,
  } = useStaticData(monthStart, monthEnd, showToast, authUser.id, healthRuntimeReady);

  useEffect(() => {
    const refreshLocalHealth = () => {
      mutateDaily();
      mutateStatic();
    };
    window.addEventListener(HEALTH_LOCAL_BOOTSTRAP_COMPLETE_EVENT, refreshLocalHealth);
    return () => window.removeEventListener(HEALTH_LOCAL_BOOTSTRAP_COMPLETE_EVENT, refreshLocalHealth);
  }, [mutateDaily, mutateStatic]);

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
      className="flex flex-col lg:flex-row h-[100dvh] font-body p-0 lg:p-3 relative transition-colors duration-500 overflow-hidden bg-background"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
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

      <div className="flex-1 overflow-hidden flex flex-col p-3 lg:p-0">
        <Suspense fallback={<ViewLoadingFallback />}>
          {activeTab === 'home'      && <HomeView       {...globalProps} />}
          {activeTab === 'planner'   && <PlannerView   {...globalProps} />}
          {activeTab === 'health' && healthBootstrapRequired && startupState.health.status === 'pending' && (
            <ViewLoadingFallback label={t('startupHealthLoading')} />
          )}
          {activeTab === 'health' && healthBootstrapRequired && startupState.health.status === 'failed' && (
            <StartupFailureBoundary
              message={t('startupHealthFailed')}
              onRetry={() => startupRunRef.current?.retry('health')}
            />
          )}
          {activeTab === 'health' && (!healthBootstrapRequired || startupState.health.status === 'ready') && (
            <>
              {startupState.health.status === 'failed' && (
                <StartupFailureNotice
                  message={t('startupHealthFailed')}
                  onRetry={() => startupRunRef.current?.retry('health')}
                />
              )}
              <HealthView {...globalProps} />
            </>
          )}
          {activeTab === 'analytics' && <AnalyticsView {...globalProps} accountId={authUser.id} />}
          {activeTab === 'settings'  && (
            <SettingsView
              {...globalProps}
              settingsScrollTarget={settingsScrollTarget}
              onSettingsScrollTargetConsumed={() => setSettingsScrollTarget(null)}
            />
          )}
          {activeTab === 'recipe'    && <RecipeView showToast={showToast} appSettings={appSettings} updateSetting={updateSetting} theme={theme} THEME_COLORS={THEME_COLORS}/>}
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
        {activeTab === 'note' && startupState.notes.status === 'ready' && <NoteView showToast={showToast} accountId={authUser.id} />}
      </div>

      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full shadow-2xl z-[999] animate-in slide-in-from-bottom-5 font-semibold text-sm flex items-center gap-2 ${
            toast.type === 'error'
              ? 'bg-danger text-white'
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

      {/* Fix 9: 모든 탭에서 로딩 인디케이터 표시 */}
      {isDailyLoading && (
        <div className="fixed top-6 right-6 bg-surface-alt p-3 rounded-absinthe-full shadow-absinthe-lg z-[999] text-primary">
          <Loader2 size={20} className="animate-spin" />
        </div>
      )}

      <GlobalSearchHost
        appSettings={appSettings}
        schedules={schedules}
        todos={todos}
        routines={routines}
        workouts={workouts}
        healthBlocks={healthBlocks}
        weeklySchedules={weeklySchedules}
      />
    </div>
  );
}
