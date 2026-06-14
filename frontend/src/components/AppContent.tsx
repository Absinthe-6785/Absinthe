import { useState, useCallback, useMemo, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

import { supabase } from '../lib/supabase';
import { registerNotesTabSwitcher } from '../lib/noteNavigation';
import { useAppStore } from '../store/useAppStore';
import { useNotesStore } from '../store/useNotesStore';
import { useNow } from '../hooks/useNow';
import { useToast } from '../hooks/useToast';
import { useDailyData } from '../hooks/useDaily';
import { useStaticData } from '../hooks/useStatic';
import { ThemeColor, ViewProps } from '../types';
import { buildThemeClasses } from '../theme';
import { Sidebar, TabId } from './common/Sidebar';

import { PlannerView } from './views/PlannerView';
import { HealthView } from './views/HealthView';
import { AnalyticsView } from './views/AnalyticsView';
import { SettingsView } from './views/SettingsView';
import { NoteView } from './views/NoteView';
import { migrateLegacyDdays } from '../lib/migrateLegacyDdays';

// ── 상수 — 모듈 레벨로 분리해 매 렌더마다 재생성 방지 ──────────────
const THEME_COLORS: ThemeColor[] = [
  { id: 'gold',   bg: 'bg-primary',  text: 'text-primary-foreground', border: 'border-primary' },
  { id: 'blue',   bg: 'bg-blue-500',   text: 'text-white',      border: 'border-blue-500'   },
  { id: 'green',  bg: 'bg-green-500',  text: 'text-white',      border: 'border-green-500'  },
  { id: 'purple', bg: 'bg-purple-500', text: 'text-white',      border: 'border-purple-500' },
  { id: 'pink',   bg: 'bg-pink-500',   text: 'text-white',      border: 'border-pink-500'   },
  { id: 'gray',   bg: 'bg-gray-500',   text: 'text-white',      border: 'border-gray-500'   },
];

export function AppContent({ authUser }: { authUser: User }) {
  const { appSettings, updateSetting } = useAppStore();
  const hydrateFromDB = useNotesStore(s => s.hydrateFromDB);
  const [activeTab, setActiveTab] = useState<TabId>('note');

  // ── 1. now / formatDate / isToday ────────────────────────────────
  const { now, formatDate, isToday } = useNow();

  // ── 2. Toast — must be declared before effects that call showToast ─
  const { toast, showToast } = useToast();

  // ── 3. 날짜 상태 ──────────────────────────────────────────────────
  const [currentDate, setCurrentDate] = useState(now.toJSDate());
  const [selectedDate, setSelectedDate] = useState(now.toJSDate());

  // 앱 시작 시 DB에서 최신 노트 로드 — 세션이 준비된 후 실행
  useEffect(() => {
    hydrateFromDB().then(() => {
      void migrateLegacyDdays(count => {
        if (count > 0) showToast(`Migrated ${count} countdown${count === 1 ? '' : 's'} to notes`);
      });
    });
  }, [hydrateFromDB, showToast]);

  useEffect(() => {
    return registerNotesTabSwitcher(() => setActiveTab('note'));
  }, []);

  // ── 4. SWR ────────────────────────────────────────────────────────
  const dateStr = formatDate(selectedDate);
  const {
    schedules, todos, routines, workouts, inbody,
    mutate: mutateDaily,
    mutateTodos, mutateRoutines,
    isLoading: isDailyLoading,
  } = useDailyData(dateStr, showToast);

  // useNow가 1분마다 now를 갱신 → AppContent 리렌더 → monthStart/monthEnd 매번 재계산.
  // currentDate가 바뀔 때만 실제로 값이 달라지므로 useMemo로 명시적 메모이제이션.
  const { monthStart, monthEnd } = useMemo(() => ({
    monthStart: formatDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)),
    monthEnd:   formatDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)),
  }), [currentDate, formatDate]);
  const {
    markedDates, healthBlocks, healthRoutines, weeklySchedules,
    mutate: mutateStatic,
  } = useStaticData(monthStart, monthEnd, showToast);

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
  const handleSignOut = useCallback(async () => { await supabase.auth.signOut(); }, []);

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
    onSignOut: handleSignOut,
  }), [
    user, now, currentDate, setCurrentDate, selectedDate, setSelectedDate,
    formatDate, isToday, showToast,
    mutateDaily, mutateStatic, mutateTodos, mutateRoutines,
    appSettings, updateSetting, theme,
    schedules, todos, routines, workouts, inbody, weeklySchedules,
    markedDates, healthBlocks, healthRoutines,
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
      />

      <div className="flex-1 overflow-hidden flex flex-col p-3 lg:p-0">
        {activeTab === 'planner'   && <PlannerView   {...globalProps} />}
        {activeTab === 'health'    && <HealthView    {...globalProps} />}
        {activeTab === 'analytics' && <AnalyticsView {...globalProps} />}
        {activeTab === 'settings'  && <SettingsView  {...globalProps} />}
        {activeTab === 'note'      && <NoteView />}
        {activeTab === 'recipe'    && <RecipeView showToast={showToast} appSettings={appSettings} updateSetting={updateSetting} theme={theme} THEME_COLORS={THEME_COLORS}/>}
      </div>

      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full shadow-2xl z-[999] animate-in slide-in-from-bottom-5 font-semibold text-sm flex items-center gap-2 ${
            toast.type === 'error' ? 'bg-danger text-white' : 'bg-surface-alt text-primary'
          }`}
        >
          {toast.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* Fix 9: 모든 탭에서 로딩 인디케이터 표시 */}
      {isDailyLoading && (
        <div className="fixed top-6 right-6 bg-surface-alt p-3 rounded-absinthe-full shadow-absinthe-lg z-[999] text-primary">
          <Loader2 size={20} className="animate-spin" />
        </div>
      )}
    </div>
  );
}
