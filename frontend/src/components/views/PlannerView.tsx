import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import useSWR from 'swr';
import { fetcher } from '../../lib/fetcher';
import { API_URL } from '../../lib/config';
import { Plus, X, Trash2, Edit2, Clock, Activity, CheckCircle, Inbox, BookOpen, Briefcase, Dumbbell, User, Moon, Users } from 'lucide-react';
import { DateTime } from 'luxon';
import { useConfirm } from '../../hooks/useConfirm';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { useApiMutation } from '../../hooks/useApiMutation';
import { ConfirmModal } from '../common/ConfirmModal';
import { EmptyState } from '../common/EmptyState';
import { PlannerProps, Schedule, Todo, Routine } from '../../types';
import { useTranslation } from '../../lib/i18n';
import { useNotesStore } from '../../store/useNotesStore';
import { applyEventToNote } from './features/knowledge/trace/eventNotes';
import { WeeklyTimetableSection } from './features/planner/WeeklyTimetableSection';
import { CalendarShell } from './features/planner/calendar-ui';
import { ScheduleCountdownPanel } from './features/planner/ScheduleCountdownPanel';
import { usePlannerCalendarProjection } from './features/planner/calendar-ui/usePlannerCalendarProjection';
import { openNote } from '../../lib/noteNavigation';
import type { PlannerCalendarViewMode } from './features/planner/calendar';

// timeSlots는 currentDate/schedules와 무관한 고정 값(00:00~23:30, 48개).
// useMemo 내부에 두면 schedules 변경마다 불필요하게 재생성됨 → 모듈 레벨 상수로 분리.
const TIME_SLOTS = Array.from({ length: 48 }, (_, i) =>
  `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 === 0 ? '00' : '30'}`
);

/** Mobile panel order: Timeline → Tasks (K-48). Memo retired — use Note tab. */
const MOBILE_PLANNER_TABS = ['timeline', 'todo'] as const;

export const PlannerView = ({
  now, currentDate, setCurrentDate, selectedDate, setSelectedDate,
  formatDate, isToday, showToast, mutateDaily, mutateStatic,
  mutateTodos, mutateRoutines,
  appSettings, schedules, todos, routines, weeklySchedules, theme, THEME_COLORS,
}: PlannerProps) => {
  const { t, lang } = useTranslation();
  const createNote = useNotesStore(s => s.createNote);
  const updateNote = useNotesStore(s => s.updateNote);
  const { mutate: api } = useApiMutation(mutateDaily, mutateStatic, showToast);
  const { confirm, showConfirm, clearConfirm, handleConfirm } = useConfirm();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newSch, setNewSch] = useState<Partial<Schedule>>({
    text: '', start_time: '10:00', end_time: '11:00',
    is_dday: false, color: appSettings.defaultColor, category: appSettings.defaultCategory,
  });
  // end_next_day: 익일 종료 여부 (23:00 ~ 01:00 같은 자정 넘는 일정 지원)
  const [endNextDay, setEndNextDay] = useState(false);
  const [mobilePlannerTab, setMobilePlannerTab] = useState<(typeof MOBILE_PLANNER_TABS)[number]>('timeline');
  const [calendarViewMode, setCalendarViewMode] = useState<PlannerCalendarViewMode>('day');
  const showLegacyTimeline = calendarViewMode === 'week' || calendarViewMode === 'month';
  const isDashboardMode = calendarViewMode === 'day' || calendarViewMode === 'agenda';
  const visibleMobileTabs = showLegacyTimeline ? MOBILE_PLANNER_TABS : (['todo'] as const);

  useEffect(() => {
    if (!showLegacyTimeline && mobilePlannerTab === 'timeline') {
      setMobilePlannerTab('todo');
    }
  }, [showLegacyTimeline, mobilePlannerTab]);

  const [editingRoutineId, setEditingRoutineId] = useState<string | null>(null);
  const [showExceptionModal, setShowExceptionModal] = useState(false);
  const [exceptionForm, setExceptionForm] = useState({ start_date: '', end_date: '', reason: '' });
  const [newRoutineText, setNewRoutineText] = useState('');
  const [newTodoText, setNewTodoText] = useState('');
  const [editRoutineText, setEditRoutineText] = useState('');
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const [editTodoText, setEditTodoText] = useState('');

  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const newRoutineInputRef = useRef<HTMLInputElement>(null);
  const newTodoInputRef = useRef<HTMLInputElement>(null);

  // 전날 스케줄 fetch — end_next_day 블록을 익일 타임라인에 표시하기 위해
  const prevDate = useMemo(() => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    return d;
  }, [selectedDate]);
  const prevDateStr = useMemo(() => formatDate(prevDate), [prevDate, formatDate]);
  const { data: prevSchedules = [] } = useSWR<Schedule[]>(
    `${API_URL}/api/schedules?date=${prevDateStr}`,
    fetcher,
    { revalidateOnFocus: false }
  );
  // 전날 일정 중 end_next_day=true인 것 → 당일 00:00 ~ end_time 구간으로 표시
  const carryOverSchedules: Schedule[] = useMemo(() =>
    (prevSchedules as Schedule[]).filter(s => s.end_next_day),
  [prevSchedules]);

  useEscapeKey(() => {
    setShowForm(false);
    setEditingRoutineId(null); setEditingTodoId(null);
    clearConfirm();
  });

  // 타임라인 자동 스크롤 — selectedDate가 바뀔 때만 실행.
  // isToday/formatDate/now는 날짜 변경과 무관하게 안정적이므로 ref로 참조.
  const scrollParamsRef = useRef({ isToday, formatDate, now });
  useEffect(() => { scrollParamsRef.current = { isToday, formatDate, now }; });

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const el = timelineScrollRef.current;
      if (!el) return;
      const { isToday: isTodayFn, formatDate: fmt, now: nowDt } = scrollParamsRef.current;
      const target = isTodayFn(fmt(selectedDate))
        ? nowDt.hour * 60 + nowDt.minute
        : 7 * 60;
      el.scrollTop = Math.max(0, target * (40 / 30) - el.clientHeight / 2);
    });
    return () => cancelAnimationFrame(raf);
  }, [selectedDate]);


  const openPlannerNote = useCallback((id: string, breadcrumb?: readonly import('../../lib/noteBreadcrumb').NoteBreadcrumbSegment[]) => {
    openNote(id, {
      returnTab: 'planner',
      breadcrumb: breadcrumb ?? [
        { type: 'key', key: 'planner' },
        { type: 'key', key: 'scheduleCountdownTitle' },
      ],
    });
  }, []);

  const handleCreateCountdownNote = useCallback(() => {
    const dateKey = formatDate(selectedDate);
    const id = createNote({ title: '' });
    const note = useNotesStore.getState().notes.find(n => n.id === id);
    if (note) {
      const withEvent = applyEventToNote(note, { title: t('scheduleCountdownNewTitle'), eventDate: dateKey });
      updateNote(id, { title: withEvent.title, properties: withEvent.properties });
    }
    openPlannerNote(id);
  }, [createNote, updateNote, formatDate, selectedDate, t, openPlannerNote]);

  // ── Routine ────────────────────────────────────────────────────────
  const handleAddRoutine = (text: string) => {
    if (text.trim()) api('POST', '/api/routines', { text, created_date: formatDate(new Date()) }, { revalidate: 'daily' });
  };
  const handleToggleRoutine = (id: string, current: boolean) => {
    // UI 즉시 반영 — 서버 응답 기다리지 않음
    mutateRoutines(
      (cur) => cur.map((r) => r.id === id ? { ...r, done: !current } : r),
      false, // revalidate: false → optimistic 상태 유지, 서버 응답 후 재검증은 api()가 담당
    );
    api('POST', '/api/routine_logs',
      { routine_id: id, date: formatDate(selectedDate), done: !current },
      { revalidate: 'daily' },
    ).then((ok) => {
      // 실패 시 롤백
      if (!ok) mutateRoutines((cur) => cur.map((r) => r.id === id ? { ...r, done: current } : r), false);
    });
  };
  const handleDeleteRoutine = (id: string) =>
    showConfirm(t('deleteRoutine'), () => {
      void api('DELETE', `/api/routines/${id}`, undefined, { revalidate: 'daily', successMsg: t('routineDeleted') });
    },
      { confirmLabel: t('deleteLabel') },
    );
  const handleUpdateRoutineText = async (id: string, text: string) => {
    if (!text.trim()) return setEditingRoutineId(null);
    const ok = await api('PUT', `/api/routines/${id}`, { text }, { revalidate: 'daily' });
    if (ok) setEditingRoutineId(null);
  };

  // ── Routine Exception ────────────────────────────────────────────────
  const handleSaveException = useCallback(async () => {
    if (!exceptionForm.start_date || !exceptionForm.end_date) return showToast(t('exStartEndRequired'), 'error');
    if (exceptionForm.start_date > exceptionForm.end_date) return showToast(t('exEndAfterStart'), 'error');
    const ok = await api('POST', '/api/routine_exceptions',
      { start_date: exceptionForm.start_date, end_date: exceptionForm.end_date, reason: exceptionForm.reason },
      { revalidate: 'daily', successMsg: t('exceptionSaved') }
    );
    if (ok) { setShowExceptionModal(false); setExceptionForm({ start_date: '', end_date: '', reason: '' }); }
  }, [api, exceptionForm, showToast]);

  // ── Todo ───────────────────────────────────────────────────────────
  const handleAddTodo = (text: string) => {
    if (text.trim()) api('POST', '/api/todos', { date: formatDate(selectedDate), text }, { revalidate: 'daily' });
  };
  const handleToggleTodo = (id: string, current: boolean) => {
    // UI 즉시 반영
    mutateTodos(
      (cur) => cur.map((t) => t.id === id ? { ...t, done: !current } : t),
      false,
    );
    api('PUT', `/api/todos/${id}`, { done: !current }, { revalidate: 'daily' })
      .then((ok) => {
        // 실패 시 롤백
        if (!ok) mutateTodos((cur) => cur.map((t) => t.id === id ? { ...t, done: current } : t), false);
      });
  };
  const handleDeleteTodo = (id: string) =>
    api('DELETE', `/api/todos/${id}`, undefined, { revalidate: 'daily', successMsg: t('taskDeleted') });
  const handleUpdateTodoText = async (id: string, text: string) => {
    if (!text.trim()) return setEditingTodoId(null);
    const ok = await api('PUT', `/api/todos_text/${id}`,
      { date: formatDate(selectedDate), text },
      { revalidate: 'daily' }
    );
    if (ok) setEditingTodoId(null);
  };

  // ── Schedule ───────────────────────────────────────────────────────
  const openModal = (sch?: Schedule) => {
    setNewSch(sch ?? { text: '', start_time: '10:00', end_time: '11:00', is_dday: false, color: appSettings.defaultColor, category: appSettings.defaultCategory });
    setEditingId(sch?.id ?? null);
    setEndNextDay(sch?.end_next_day ?? false);  // 편집 시 기존 end_next_day 복원
    setShowForm(true);
  };
  const handleSaveSchedule = async () => {
    if (!newSch.text) return showToast(t('enterText'), 'error');
    if (!endNextDay && newSch.start_time && newSch.end_time && newSch.start_time >= newSch.end_time)
      return showToast(t('endTimeError'), 'error');

    // 익일인 경우 overlap 체크 생략 (자정 넘는 일정은 단순 문자열 비교 불가)
    const isOverlap = !endNextDay && schedules.some(s =>
      s.id !== editingId && newSch.start_time! < s.end_time && newSch.end_time! > s.start_time
    );
    const doSave = async () => {
      const ok = await api(
        editingId ? 'PUT' : 'POST',
        editingId ? `/api/schedules/${editingId}` : '/api/schedules',
        { ...newSch, date: formatDate(selectedDate), end_next_day: endNextDay },
        { revalidate: 'both', successMsg: t('scheduleSaved') },
      );
      if (ok) setShowForm(false);
    };
    if (isOverlap) { showConfirm(t('overlapMsg'), doSave, { confirmLabel: t('saveLabel'), variant: 'primary' }); return; }
    doSave();
  };
  const handleDeleteSchedule = (id: string) =>
    showConfirm(t('deleteSchedule'), () => {
      void api('DELETE', `/api/schedules/${id}`, undefined, { revalidate: 'both', successMsg: t('deleted') });
    },
      { confirmLabel: t('deleteLabel') },
    );

  // ── Derived values ─────────────────────────────────────────────────
  const sortedSchedules = useMemo(
    () => [...schedules].sort((a, b) => a.start_time.localeCompare(b.start_time)),
    [schedules],
  );

  const timeToPos = useCallback((ts: string) => {
    if (!ts) return 0;
    const [h, m] = ts.split(':');
    return (parseInt(h || '0') * 60 + parseInt(m || '0')) * (40 / 30);
  }, []);


  const routineExceptionDates = useMemo(
    () => (routines[0]?.is_exception_day ? new Set([formatDate(selectedDate)]) : undefined),
    [routines, selectedDate, formatDate],
  );

  const { projection: calendarProjection, presentation: calendarPresentation } = usePlannerCalendarProjection({
    now,
    anchorDate: formatDate(selectedDate),
    viewMode: calendarViewMode,
    schedules,
    previousDaySchedules: prevSchedules,
    previousDayDate: prevDateStr,
    todos,
    routines,
    weeklySchedules,
    appSettings,
    routineExceptionDates,
  });

  const handleCalendarAnchorChange = useCallback((dateKey: string) => {
    const [y, m, d] = dateKey.split('-').map(Number);
    if (!y || !m || !d) return;
    setSelectedDate(new Date(y, m - 1, d));
    setCurrentDate(new Date(y, m - 1, 1));
  }, [setSelectedDate, setCurrentDate]);

  return (
    <div className="flex-1 flex flex-col overflow-y-auto lg:overflow-hidden pr-1 animate-in fade-in duration-300 pb-20 lg:pb-0">
      <CalendarShell
        now={now}
        anchorDate={formatDate(selectedDate)}
        schedules={schedules}
        previousDaySchedules={prevSchedules}
        previousDayDate={prevDateStr}
        todos={todos}
        routines={routines}
        weeklySchedules={weeklySchedules}
        appSettings={appSettings}
        theme={theme}
        routineExceptionDates={routineExceptionDates}
        onEventNoteClick={openPlannerNote}
        onAnchorDateChange={handleCalendarAnchorChange}
        onViewModeChange={setCalendarViewMode}
        dayScheduleActions={{
          onAdd: () => openModal(),
          onEdit: (id: string) => {
            const sch = schedules.find(s => s.id === id);
            if (sch) openModal(sch);
          },
          onDelete: handleDeleteSchedule,
        }}
        dayRoutineActions={{
          onToggle: handleToggleRoutine,
          onAdd: handleAddRoutine,
          onEdit: handleUpdateRoutineText,
        }}
        dayTodoActions={{
          onToggle: handleToggleTodo,
          onAdd: handleAddTodo,
          onEdit: handleUpdateTodoText,
        }}
      />

      <div className="flex flex-col gap-4 lg:gap-5 lg:flex-1 lg:min-h-0 lg:overflow-hidden">

      {/* Mobile task panels — CalendarShell above covers month/week/day/agenda */}
      <div className={`lg:hidden flex gap-1.5 shrink-0 p-1 rounded-2xl ${theme.card}`} data-planner-mobile-tabs>
        {visibleMobileTabs.map(tab => (
          <button key={tab} onClick={() => setMobilePlannerTab(tab)}
            className={`flex-1 py-2.5 min-h-[44px] rounded-xl text-[11px] font-bold transition-colors
              ${mobilePlannerTab === tab ? 'bg-primary text-primary-foreground' : `${theme.input} ${theme.textMuted}`}`}
            data-planner-mobile-tab={tab}
          >
            {tab === 'todo' ? t('plannerMobileTabTasks') : t('scheduleMobileTabTimeline')}
          </button>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-4 lg:gap-5 lg:flex-1 lg:min-h-0 lg:overflow-hidden">

      {/* ══ Col-1: D-Day + Routines + Tasks (K-32.1 hierarchy) ══ */}
      <div
        data-planner-column="planning"
        className={`flex-1 lg:flex-[2.2] flex-col gap-4 lg:gap-5 lg:overflow-y-auto lg:pb-2 lg:order-2 ${mobilePlannerTab === "todo" || !showLegacyTimeline ? "flex" : "hidden lg:flex"}`}
      >

        {/* Countdowns — note-backed + legacy */}
        <ScheduleCountdownPanel
          countdowns={calendarProjection.core.countdowns}
          presentation={calendarPresentation}
          theme={theme}
          onNoteClick={openPlannerNote}
          onAddCountdown={handleCreateCountdownNote}
        />

        {/* Routines + Tasks — hidden in day/agenda dashboard mode (interactive in Day view) */}
        {!isDashboardMode && (
        <>
        <div className={`relative flex-1 rounded-[24px] lg:rounded-[32px] p-5 lg:p-6 overflow-hidden flex flex-col transition-colors ${theme.card}`}>
          <div className="flex items-center justify-between mb-3 relative z-10">
            <h2 className={`font-heading text-base lg:text-lg font-bold flex items-center gap-2 ${appSettings.darkMode ? 'bg-surface' : 'bg-white'}`}>
              <Activity size={16} strokeWidth={2.25} className="text-green-500"/> {t('routines')}
            </h2>
            <button
              onClick={() => { setExceptionForm({ start_date: formatDate(selectedDate), end_date: formatDate(selectedDate), reason: '' }); setShowExceptionModal(true); }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold transition-all ${appSettings.darkMode ? 'bg-[#2A2A2A] text-gray-400 hover:text-blue-300' : 'bg-gray-100 text-gray-500 hover:text-blue-500'}`}
              title={t('setExceptionDayTitle')}>
              {t('exception')}
            </button>
          </div>
          <div className="absolute left-0 right-0 top-[52px] bottom-0 pointer-events-none z-0"
            style={{ backgroundImage: `linear-gradient(transparent 43px, ${appSettings.darkMode ? '#3A3A3C' : '#E5E7EB'} 44px)`, backgroundSize: '100% 44px' }} />
          <div className="flex-1 overflow-y-auto relative z-10 pr-2">
            {routines.length === 0 && (
              <div className="h-[80px]">
                <EmptyState
                  theme={theme}
                  icon={Activity}
                  text={t('noRoutines')}
                  onClick={() => newRoutineInputRef.current?.focus()}
                />
              </div>
            )}
            {/* 예외일 배너 */}
            {routines[0]?.is_exception_day && (
              <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold mb-1 ${appSettings.darkMode ? 'bg-blue-900/40 text-blue-300' : 'bg-blue-50 text-blue-600'}`}>
                {t('exceptionDay')}
              </div>
            )}
            {routines.map((r: Routine) => (
              <div
                key={r.id}
                tabIndex={editingRoutineId === r.id ? -1 : 0}
                role={editingRoutineId === r.id ? undefined : 'button'}
                aria-pressed={editingRoutineId === r.id ? undefined : r.done}
                className="min-h-[44px] flex items-center justify-between group rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary"
                style={{ height: '44px' }}
                onClick={() => {
                  if (editingRoutineId === r.id) return;
                  handleToggleRoutine(r.id, r.done);
                }}
                onKeyDown={e => {
                  if (editingRoutineId === r.id) return;
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleToggleRoutine(r.id, r.done);
                  }
                }}
              >
                {editingRoutineId === r.id ? (
                  <input autoFocus value={editRoutineText}
                    onChange={e => setEditRoutineText(e.target.value)}
                    onBlur={() => setEditingRoutineId(null)}
                    onClick={e => e.stopPropagation()}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleUpdateRoutineText(r.id, editRoutineText);
                      else if (e.key === 'Escape') setEditingRoutineId(null);
                    }}
                    className="flex-1 bg-transparent outline-none border-b-2 border-primary text-base font-semibold focus-visible:ring-0"
                  />
                ) : (
                  <label className="flex items-center gap-3 cursor-pointer flex-1 h-full pointer-events-none">
                    <input type="checkbox" checked={r.done} readOnly tabIndex={-1} className="w-5 h-5 accent-primary pointer-events-none" />
                    <span className={`text-base font-medium ${r.done ? 'line-through opacity-50' : ''}`}>{r.text}</span>
                  </label>
                )}
                <div className={`flex gap-1 ml-2 ${theme.textMuted} opacity-100 lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100 transition-opacity`}>
                  {r.is_active && <button type="button" onClick={e => { e.stopPropagation(); setEditingRoutineId(r.id); setEditRoutineText(r.text); }} className="p-2.5 rounded-lg active:scale-95 hover:text-blue-500 focus-visible:ring-2 focus-visible:ring-primary"><Edit2 size={15}/></button>}
                  {r.is_active && <button type="button" onClick={e => { e.stopPropagation(); handleDeleteRoutine(r.id); }} className="p-2.5 rounded-lg active:scale-95 hover:text-red-500 focus-visible:ring-2 focus-visible:ring-primary"><X size={15}/></button>}
                </div>
              </div>
            ))}
            <div className="flex items-center gap-2" style={{ height: '44px' }}>
              <Plus size={16} className={`shrink-0 ${theme.textMuted}`}/>
              <input ref={newRoutineInputRef} type="text" value={newRoutineText} onChange={e => setNewRoutineText(e.target.value)}
                placeholder={t('addRoutine')} className="flex-1 bg-transparent outline-none text-sm font-medium"
                onKeyDown={e => { if (e.key === 'Enter' && newRoutineText.trim()) { handleAddRoutine(newRoutineText); setNewRoutineText(''); } }}/>
              {newRoutineText.trim() && (
                <button onClick={() => { handleAddRoutine(newRoutineText); setNewRoutineText(''); }}
                  className="shrink-0 bg-primary text-primary-foreground px-3 py-1 rounded-lg text-xs font-bold active:scale-95">{t('add')}</button>
              )}
            </div>
          </div>
        </div>

        {/* 할일 */}
        <div className={`relative flex-1 rounded-[24px] lg:rounded-[32px] p-5 lg:p-6 overflow-hidden flex flex-col transition-colors ${theme.card}`}>
          <h2 className={`font-heading text-base lg:text-lg font-bold mb-3 relative z-10 flex items-center gap-2 ${appSettings.darkMode ? 'bg-surface' : 'bg-white'}`}>
            <CheckCircle size={18} className="text-primary"/> {t('todoList')}
          </h2>
          <div className="absolute left-0 right-0 top-[52px] bottom-0 pointer-events-none z-0"
            style={{ backgroundImage: `linear-gradient(transparent 43px, ${appSettings.darkMode ? '#3A3A3C' : '#E5E7EB'} 44px)`, backgroundSize: '100% 44px' }} />
          <div className="flex-1 overflow-y-auto relative z-10 pr-2">
            {todos.length === 0 && (
              <div className="h-[80px]">
                <EmptyState
                  theme={theme}
                  icon={Inbox}
                  text={t('noTasks')}
                  onClick={() => newTodoInputRef.current?.focus()}
                />
              </div>
            )}
            {todos.map((todo: Todo) => (
              <div key={todo.id} className="min-h-[44px] flex items-center justify-between group" style={{ height: '44px' }}>
                {editingTodoId === todo.id ? (
                  <input autoFocus value={editTodoText}
                    onChange={e => setEditTodoText(e.target.value)}
                    onBlur={() => setEditingTodoId(null)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleUpdateTodoText(todo.id, editTodoText);
                      else if (e.key === 'Escape') setEditingTodoId(null);
                    }}
                    className="flex-1 bg-transparent outline-none border-b-2 border-primary text-base font-semibold"
                  />
                ) : (
                  <label className="flex items-center gap-3 cursor-pointer flex-1 h-full">
                    <input type="checkbox" checked={todo.done} onChange={() => handleToggleTodo(todo.id, todo.done)} className="w-5 h-5 accent-primary cursor-pointer" />
                    <span className={`text-base font-medium ${todo.done ? 'line-through opacity-50' : ''}`}>{todo.text}</span>
                  </label>
                )}
                <div className={`flex gap-1 ml-2 ${theme.textMuted} opacity-100 lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100 transition-opacity`}>
                  <button onClick={() => { setEditingTodoId(todo.id); setEditTodoText(todo.text); }} className="p-2.5 rounded-lg active:scale-95 hover:text-blue-500 focus-visible:ring-2 focus-visible:ring-primary"><Edit2 size={15}/></button>
                  <button onClick={() => handleDeleteTodo(todo.id)} className="p-2.5 rounded-lg active:scale-95 hover:text-red-500 focus-visible:ring-2 focus-visible:ring-primary"><X size={15}/></button>
                </div>
              </div>
            ))}
            <div className="flex items-center gap-2" style={{ height: '44px' }}>
              <Plus size={16} className={`shrink-0 ${theme.textMuted}`}/>
              <input ref={newTodoInputRef} type="text" value={newTodoText} onChange={e => setNewTodoText(e.target.value)}
                placeholder={t('addTask')} className="flex-1 bg-transparent outline-none text-sm font-medium"
                onKeyDown={e => { if (e.key === 'Enter' && newTodoText.trim()) { handleAddTodo(newTodoText); setNewTodoText(''); } }}/>
              {newTodoText.trim() && (
                <button onClick={() => { handleAddTodo(newTodoText); setNewTodoText(''); }}
                  className="shrink-0 bg-primary text-primary-foreground px-3 py-1 rounded-lg text-xs font-bold active:scale-95">{t('add')}</button>
              )}
            </div>
          </div>
        </div>
        </>
        )}
      </div>

      {/* ══ Col-3: Time grid (week/month only — day/agenda use CalendarShell) ══ */}
      {showLegacyTimeline ? (
      <div
        data-planner-column="timeline"
        className={`flex-1 lg:flex-[3.5] flex-col gap-4 lg:gap-5 lg:min-h-0 shrink-0 lg:order-1 ${mobilePlannerTab === "timeline" ? "flex" : "hidden lg:flex"}`}
      >
        {/* Day timeline — complements CalendarShell day/week views */}
        <div className={`relative lg:flex-1 rounded-[24px] lg:rounded-[32px] p-5 lg:p-6 overflow-hidden flex-col transition-colors min-h-[520px] lg:min-h-0 ${theme.card} ${mobilePlannerTab === "timeline" ? "flex" : "hidden lg:flex"}`}>
          <div className="flex justify-between items-center mb-5">
            <div>
              <h2 className="font-heading text-xl lg:text-2xl font-bold flex items-center gap-2.5">
                <Clock size={24} className="text-primary"/> {t('timeline')}
              </h2>
              <p className={`text-xs font-semibold mt-0.5 ${theme.textMuted}`}>
                {selectedDate.toLocaleDateString(lang, { month: 'short', day: 'numeric', weekday: 'short' })}
              </p>
            </div>
            <button onClick={() => openModal()} className="bg-primary text-primary-foreground p-2.5 rounded-full shadow-md hover:scale-105 transition-transform">
              <Plus size={20} strokeWidth={2.25}/>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto" ref={timelineScrollRef}>
            <div className="flex min-h-[1920px]">
              <div className={`w-16 lg:w-20 shrink-0 border-r ${theme.border}`}>
                {TIME_SLOTS.map((time, idx) => (
                  <div key={time} className="h-[40px] flex items-center justify-center">
                    <span className={`tabular-nums ${idx % 2 === 0 ? 'text-xs lg:text-sm font-semibold' : 'text-[10px] lg:text-xs opacity-40'} ${theme.textMuted}`}>{time}</span>
                  </div>
                ))}
              </div>
              <div className="flex-1 relative pr-2">
                {Array.from({ length: 48 }).map((_, i) => (
                  <div key={i} className={`absolute w-full h-px ${appSettings.darkMode ? 'bg-gray-700' : 'bg-gray-100'}`} style={{ top: `${i * 40}px` }}/>
                ))}
                {sortedSchedules.length === 0 && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 opacity-40 pointer-events-none" style={{ top: '320px' }}>
                    <Clock size={28} className={theme.textMuted}/>
                    <p className={`text-sm font-semibold ${theme.textMuted}`}>{t('noSchedules')}</p>
                  </div>
                )}
                {/* ── 당일 스케줄 ── */}
                {sortedSchedules.map((sch: Schedule) => {
                  const top = timeToPos(sch.start_time);
                  // end_next_day: 자정(1920px) 끝까지 채우고 익일 배지 표시
                  const TIMELINE_END = 1920; // 48 슬롯 × 40px
                  const rawEnd = timeToPos(sch.end_time);
                  const height = sch.end_next_day
                    ? TIMELINE_END - top          // 당일 자정까지
                    : Math.max(rawEnd - top, 20);
                  const color = THEME_COLORS.find(c => c.id === sch.color) || THEME_COLORS[0];
                  return (
                    <div key={sch.id}
                      className={`group absolute left-2 right-2 flex items-start justify-between rounded-xl p-2 shadow-sm ${color.bg} ${color.text}`}
                      style={{ top: `${top}px`, height: `${height}px` }}>
                      <div className="flex flex-col gap-0.5 ml-1 overflow-hidden flex-1">
                        <p className="text-xs lg:text-sm font-semibold truncate">{sch.text}</p>
                        {height >= 40 && (
                          <p className="text-[10px] opacity-90 tabular-nums">
                            {sch.start_time} — {sch.end_next_day ? `${sch.end_time} +1` : sch.end_time}
                          </p>
                        )}
                        {/* 익일 연속 배지 */}
                        {sch.end_next_day && (
                          <span className="mt-auto mb-1 self-start text-[10px] font-bold bg-black/25 px-2 py-0.5 rounded-full">
                            {t('plannerUntilTomorrow')} {sch.end_time}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-1.5 mt-0.5 bg-black/20 p-1.5 rounded-full shrink-0">
                        <button onClick={() => openModal(sch)} className="p-1 hover:text-white active:scale-95"><Edit2 size={12}/></button>
                        <button onClick={() => handleDeleteSchedule(sch.id)} className="p-1 hover:text-red-300 active:scale-95"><Trash2 size={12}/></button>
                      </div>
                    </div>
                  );
                })}

                {/* ── 전날 end_next_day 블록 → 당일 00:00 ~ end_time ── */}
                {carryOverSchedules.map((sch: Schedule) => {
                  const top = 0; // 00:00부터
                  const height = Math.max(timeToPos(sch.end_time), 20);
                  const color = THEME_COLORS.find(c => c.id === sch.color) || THEME_COLORS[0];
                  return (
                    <div key={`carry-${sch.id}`}
                      className={`group absolute left-2 right-2 flex items-start justify-between rounded-xl p-2 shadow-sm opacity-90 ${color.bg} ${color.text}`}
                      style={{ top: `${top}px`, height: `${height}px` }}>
                      <div className="flex flex-col gap-0.5 ml-1 overflow-hidden flex-1">
                        {/* 전일 연속 배지 */}
                        <span className="text-[10px] font-bold bg-black/25 px-2 py-0.5 rounded-full self-start mb-0.5">
                          {t('plannerFromYesterday')}
                        </span>
                        <p className="text-xs lg:text-sm font-semibold truncate">{sch.text}</p>
                        {height >= 40 && (
                          <p className="text-[10px] opacity-90 tabular-nums">00:00 — {sch.end_time}</p>
                        )}
                      </div>
                      {/* 전일 블록은 편집/삭제 버튼 없음 (전날 날짜에서만 수정) */}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
      ) : null}
      </div>

      <WeeklyTimetableSection
        weeklySchedules={weeklySchedules}
        theme={theme}
        appSettings={appSettings}
        THEME_COLORS={THEME_COLORS}
        mutateStatic={mutateStatic}
        showToast={showToast}
      />
      </div>

      {/* ── 스케줄 추가/편집 모달 ── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 backdrop-blur-sm" onClick={() => setShowForm(false)}>
          <div className={`rounded-[32px] p-6 lg:p-8 w-full max-w-[400px] shadow-2xl ${theme.card}`} onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-heading text-xl lg:text-2xl font-bold">{editingId ? t('editSchedule') : t('newSchedule')}</h3>
              <button onClick={() => setShowForm(false)} className={`p-2 rounded-full ${theme.hoverBg}`}><X size={20}/></button>
            </div>
            <div className="space-y-5">
              <div>
                <label className={`block text-sm font-semibold mb-2 ${theme.textMuted}`}>{t('labelText')}</label>
                <input autoFocus type="text" value={newSch.text} onChange={e => setNewSch({ ...newSch, text: e.target.value })}
                  onKeyDown={e => e.key === 'Enter' && handleSaveSchedule()}
                  className={`w-full rounded-2xl p-4 outline-none focus:ring-2 focus:ring-primary text-base font-medium ${theme.input}`} placeholder={t('scheduleTextPh')}/>
              </div>
              <div>
                <label className={`block text-sm font-semibold mb-2 ${theme.textMuted}`}>{t('labelCategory')}</label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { id: 'Study',    label: 'Study',   Icon: BookOpen },
                    { id: 'Work',     label: 'Work',    Icon: Briefcase },
                    { id: 'Exercise', label: 'Workout', Icon: Dumbbell },
                    { id: 'Personal', label: 'Personal', Icon: User },
                    { id: 'Sleep',    label: 'Sleep',   Icon: Moon },
                    { id: 'Social',   label: 'Social',  Icon: Users },
                  ] as const).map(cat => (
                    <button key={cat.id} onClick={() => (() => {
                          if (cat.id === 'Exercise') {
                            setNewSch(prev => ({
                              ...prev,
                              category:   'Exercise',
                              color:      'blue',
                              text:       prev.text || 'Workout',
                            }));
                          } else if (cat.id === 'Sleep') {
                            setNewSch(prev => ({
                              ...prev,
                              category:   'Sleep',
                              color:      'gray',
                              text:       prev.text || 'Sleep',
                              start_time: prev.start_time === '10:00' ? '22:30' : prev.start_time,
                              end_time:   prev.end_time   === '11:00' ? '07:00' : prev.end_time,
                            }));
                            // setEndNextDay(true) 제거 — 수동 설정 유지
                          } else {
                            setNewSch(prev => ({ ...prev, category: cat.id }));
                          }
                        })()}
                      className={`py-2.5 rounded-xl text-xs font-semibold transition-colors flex flex-col items-center gap-1
                        ${newSch.category === cat.id ? 'bg-primary text-primary-foreground' : theme.input}`}>
                      <span className="leading-none flex justify-center"><cat.Icon size={16} strokeWidth={2.25} /></span>
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className={`block text-sm font-semibold mb-2 ${theme.textMuted}`}>{t('labelStart')}</label>
                  <input type="time" value={newSch.start_time} step="1800" lang={lang}
                    onChange={e => setNewSch({ ...newSch, start_time: e.target.value })}
                    className={`w-full rounded-2xl p-4 outline-none font-medium text-base tabular-nums ${theme.input}`}/>
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-2">
                    <label className={`text-sm font-semibold ${theme.textMuted}`}>{t('labelEnd')}</label>
                    <button type="button"
                      onClick={() => setEndNextDay(v => !v)}
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-lg transition-colors
                        ${endNextDay ? 'bg-primary text-primary-foreground' : `${theme.input} ${theme.textMuted}`}`}>
                      +1 day
                    </button>
                  </div>
                  <input type="time" value={newSch.end_time} step="1800" lang={lang}
                    onChange={e => setNewSch({ ...newSch, end_time: e.target.value })}
                    className={`w-full rounded-2xl p-4 outline-none font-medium text-base tabular-nums ${theme.input}
                      ${endNextDay ? 'ring-2 ring-primary' : ''}`}/>
                  {endNextDay && <p className="text-[10px] text-primary font-bold mt-1 pl-1">{t('nextDay')}</p>}
                </div>
              </div>
              <div>
                <label className={`block text-sm font-semibold mb-2 ${theme.textMuted}`}>{t('labelColor')}</label>
                <div className="flex gap-3">
                  {THEME_COLORS.map(c => (
                    <div key={c.id} onClick={() => setNewSch({ ...newSch, color: c.id })}
                      className={`w-10 h-10 rounded-full cursor-pointer shadow-sm transition-transform hover:scale-110 ${c.bg}
                        ${newSch.color === c.id ? `ring-4 ring-offset-2 ${appSettings.darkMode ? 'ring-gray-300 ring-offset-[#2C2C2E]' : 'ring-gray-800'}` : ''}`}/>
                  ))}
                </div>
              </div>
              <button onClick={handleSaveSchedule} className="w-full bg-primary text-primary-foreground font-bold text-lg rounded-2xl p-4 mt-2 hover:bg-gray-800 transition-colors shadow-lg">
                {t('saveSchedule')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 예외일 설정 모달 */}
      {showExceptionModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 backdrop-blur-sm" onClick={() => setShowExceptionModal(false)}>
          <div className={`rounded-[28px] p-6 w-full max-w-[360px] shadow-2xl ${theme.card}`} onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-heading text-lg font-bold flex items-center gap-2">{t('setException')}</h3>
              <button onClick={() => setShowExceptionModal(false)} className={`p-2 rounded-full ${theme.hoverBg}`}><X size={18}/></button>
            </div>
            <p className={`text-xs mb-4 ${theme.textMuted}`}>{t('exceptionDesc')}</p>
            <div className="space-y-3">
              <div>
                <label className={`block text-xs font-semibold mb-1 ${theme.textMuted}`}>{t('startDate')}</label>
                <input type="date" value={exceptionForm.start_date} onChange={e => setExceptionForm(f => ({ ...f, start_date: e.target.value }))}
                  className={`w-full rounded-xl p-3 outline-none text-sm font-semibold focus:ring-2 focus:ring-primary ${theme.input}`}/>
              </div>
              <div>
                <label className={`block text-xs font-semibold mb-1 ${theme.textMuted}`}>{t('endDate')}</label>
                <input type="date" value={exceptionForm.end_date} min={exceptionForm.start_date} onChange={e => setExceptionForm(f => ({ ...f, end_date: e.target.value }))}
                  className={`w-full rounded-xl p-3 outline-none text-sm font-semibold focus:ring-2 focus:ring-primary ${theme.input}`}/>
              </div>
              <div>
                <label className={`block text-xs font-semibold mb-1 ${theme.textMuted}`}>{t('exReason')}</label>
                <input type="text" value={exceptionForm.reason} onChange={e => setExceptionForm(f => ({ ...f, reason: e.target.value }))}
                  placeholder={t('exReasonPh')} className={`w-full rounded-xl p-3 outline-none text-sm focus:ring-2 focus:ring-primary ${theme.input}`}/>
              </div>
            </div>
            <button onClick={handleSaveException}
              className="w-full mt-5 py-3 rounded-2xl font-bold text-sm bg-primary text-primary-foreground hover:scale-[1.02] transition-transform">
              {t('saveException')}
            </button>
          </div>
        </div>
      )}

      {confirm && <ConfirmModal message={confirm.message} onConfirm={handleConfirm} onCancel={clearConfirm} darkMode={appSettings.darkMode} confirmLabel={confirm.confirmLabel} variant={confirm.variant}/>}
    </div>
  );
};
