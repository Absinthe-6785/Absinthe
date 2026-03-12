import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import useSWR from 'swr';
import { fetcher } from '../../lib/fetcher';
import { API_URL } from '../../lib/config';
import { Plus, X, Trash2, Edit2, Clock, Target, Activity, CheckCircle, Inbox, FileText, ChevronLeft, ChevronRight, FolderPlus, Folder, FolderOpen, RotateCcw, AlertTriangle } from 'lucide-react';
import { DateTime } from 'luxon';
import { useAppStore } from '../../store/useAppStore';
import { useConfirm } from '../../hooks/useConfirm';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { useApiMutation } from '../../hooks/useApiMutation';
import { ConfirmModal } from '../common/ConfirmModal';
import { Modal } from '../common/Modal';
import { EmptyState } from '../common/EmptyState';
import { PlannerProps, Schedule, Todo, Routine, DDay } from '../../types';
import { buildCalendarDays } from '../../lib/calendarUtils';

// timeSlots는 currentDate/schedules와 무관한 고정 값(00:00~23:30, 48개).
// useMemo 내부에 두면 schedules 변경마다 불필요하게 재생성됨 → 모듈 레벨 상수로 분리.
const TIME_SLOTS = Array.from({ length: 48 }, (_, i) =>
  `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 === 0 ? '00' : '30'}`
);

export const PlannerView = ({
  now, currentDate, setCurrentDate, selectedDate, setSelectedDate,
  formatDate, isToday, showToast, mutateDaily, mutateStatic,
  mutateTodos, mutateRoutines,
  appSettings, schedules, todos, routines, ddays, markedDates, theme, THEME_COLORS,
}: PlannerProps) => {
  const {
    notes, folders, activeNoteId, activeFolderId,
    createNote, updateNote, moveNoteToTrash, restoreNote, permanentDeleteNote,
    setActiveNoteId, createFolder, renameFolder, deleteFolder, setActiveFolderId,
    fetchFolders,
  } = useAppStore();

  const [showFolderInput, setShowFolderInput] = useState(false);
  const [folderInputVal, setFolderInputVal] = useState('');
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newSch, setNewSch] = useState<Partial<Schedule>>({
    text: '', start_time: '10:00', end_time: '11:00',
    is_dday: false, color: appSettings.defaultColor, category: appSettings.defaultCategory,
  });
  const [endNextDay, setEndNextDay] = useState(false);
  const [mobilePlannerTab, setMobilePlannerTab] = useState<'todo' | 'memo' | 'calendar' | 'timeline'>('todo');
  const [editingRoutineId, setEditingRoutineId] = useState<string | null>(null);
  const [newRoutineText, setNewRoutineText] = useState('');
  const [newTodoText, setNewTodoText] = useState('');
  const [editRoutineText, setEditRoutineText] = useState('');
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const [editTodoText, setEditTodoText] = useState('');
  const [showDdayForm, setShowDdayForm] = useState(false);
  const [editingDdayId, setEditingDdayId] = useState<string | null>(null);
  const [ddayForm, setDdayForm] = useState<{ text: string; date: string }>({ text: '', date: '' });

  const { mutate: api } = useApiMutation(mutateDaily, mutateStatic, showToast);
  const { confirm, showConfirm, clearConfirm, handleConfirm } = useConfirm();

  // 폴더 로드
  useEffect(() => { fetchFolders(); }, []);

  // 현재 폴더/휴지통 기준 필터링
  const visibleNotes = useMemo(() => {
    if (activeFolderId === 'trash') return notes.filter(n => n.deletedAt !== null);
    const active = notes.filter(n => n.deletedAt === null);
    if (activeFolderId === null) return active;
    return active.filter(n => n.folderId === activeFolderId);
  }, [notes, activeFolderId]);

  const activeNote = visibleNotes.find(n => n.id === activeNoteId) ?? visibleNotes[0] ?? null;

  const timelineScrollRef = useRef<HTMLDivElement>(null);

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
    setShowForm(false); setShowDdayForm(false);
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

  const calculateDday = useCallback((dateStr: string) => {
    if (!dateStr) return '';
    const target = DateTime.fromFormat(dateStr, 'yyyy-MM-dd', { zone: now.zoneName || 'Asia/Seoul' });
    if (!target.isValid) return 'Invalid Date';
    const diff = Math.round(target.startOf('day').diff(now.startOf('day'), 'days').days);
    return diff === 0 ? 'D-Day' : diff > 0 ? `D-${diff}` : `D+${Math.abs(diff)}`;
  }, [now]);

  // ── D-Day ──────────────────────────────────────────────────────────
  const openDdayModal = (d?: DDay) => {
    setDdayForm(d ? { text: d.text, date: d.date } : { text: '', date: '' });
    setEditingDdayId(d?.id ?? null);
    setShowDdayForm(true);
  };
  const handleSaveDday = async () => {
    if (!ddayForm.text || !ddayForm.date) return showToast('Enter title and date!', 'error');
    const path = editingDdayId ? `/api/schedules/${editingDdayId}` : '/api/schedules';
    const ok = await api(
      editingDdayId ? 'PUT' : 'POST', path,
      { text: ddayForm.text, date: ddayForm.date, start_time: '00:00', end_time: '00:00', is_dday: true, color: 'gold', category: 'Personal' },
      { revalidate: 'static', successMsg: 'D-Day saved' },
    );
    if (ok) setShowDdayForm(false);
  };
  const handleDeleteDday = (id: string) =>
    showConfirm('Delete this D-Day?', () =>
      api('DELETE', `/api/schedules/${id}`, undefined, { revalidate: 'static', successMsg: 'Deleted' }),
      { confirmLabel: 'Delete' },
    );

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
    showConfirm('Delete this routine?', () =>
      api('DELETE', `/api/routines/${id}`, undefined, { revalidate: 'daily', successMsg: 'Routine deleted' }),
      { confirmLabel: 'Delete' },
    );
  const handleUpdateRoutineText = async (id: string, text: string) => {
    if (!text.trim()) return setEditingRoutineId(null);
    const ok = await api('PUT', `/api/routines/${id}`, { text }, { revalidate: 'daily' });
    if (ok) setEditingRoutineId(null);
  };

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
    api('DELETE', `/api/todos/${id}`, undefined, { revalidate: 'daily', successMsg: 'Task deleted' });
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
    if (!newSch.text) return showToast('Enter text!', 'error');
    if (!endNextDay && newSch.start_time && newSch.end_time && newSch.start_time >= newSch.end_time)
      return showToast('End time must be after start time! (Check "Next day" for overnight schedules)', 'error');

    // 익일인 경우 overlap 체크 생략 (자정 넘는 일정은 단순 문자열 비교 불가)
    const isOverlap = !endNextDay && schedules.some(s =>
      s.id !== editingId && newSch.start_time! < s.end_time && newSch.end_time! > s.start_time
    );
    const doSave = async () => {
      const ok = await api(
        editingId ? 'PUT' : 'POST',
        editingId ? `/api/schedules/${editingId}` : '/api/schedules',
        { ...newSch, date: formatDate(selectedDate), end_next_day: endNextDay },
        { revalidate: 'both', successMsg: 'Schedule saved' },
      );
      if (ok) setShowForm(false);
    };
    if (isOverlap) { showConfirm('This schedule overlaps. Save anyway?', doSave, { confirmLabel: 'Save', variant: 'primary' }); return; }
    doSave();
  };
  const handleTimelineClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // 일정 블록이나 버튼 위 클릭은 무시
    if ((e.target as HTMLElement).closest('.sch-block')) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top + e.currentTarget.scrollTop;
    // 40px = 30분, y → 분 계산
    const totalMins = Math.floor(y / 40) * 30;
    const h = String(Math.floor(totalMins / 60) % 24).padStart(2, '0');
    const m = totalMins % 60 === 0 ? '00' : '30';
    const endH = String((Math.floor(totalMins / 60) + 1) % 24).padStart(2, '0');
    setNewSch({ text: '', start_time: `${h}:${m}`, end_time: `${endH}:${m}`, is_dday: false, color: appSettings.defaultColor, category: appSettings.defaultCategory });
    setEditingId(null);
    setEndNextDay(false);
    setShowForm(true);
  }, [appSettings.defaultColor, appSettings.defaultCategory]);
    showConfirm('Delete this schedule?', () =>
      api('DELETE', `/api/schedules/${id}`, undefined, { revalidate: 'both', successMsg: 'Deleted' }),
      { confirmLabel: 'Delete' },
    );

  // ── Derived values ─────────────────────────────────────────────────
  const { year, month, calendarDays, sortedSchedules } = useMemo(() => {
    const y = currentDate.getFullYear(), m = currentDate.getMonth();
    return {
      year: y, month: m,
      calendarDays: buildCalendarDays(y, m),
      sortedSchedules: [...schedules].sort((a, b) => a.start_time.localeCompare(b.start_time)),
    };
  }, [currentDate, schedules]);

  const timeToPos = useCallback((ts: string) => {
    if (!ts) return 0;
    const [h, m] = ts.split(':');
    return (parseInt(h || '0') * 60 + parseInt(m || '0')) * (40 / 30);
  }, []);


  return (
    <div className="flex-1 flex flex-col lg:flex-row gap-4 lg:gap-5 overflow-y-auto lg:overflow-hidden pr-1 animate-in fade-in duration-300 pb-20 lg:pb-0">

      {/* ── 모바일 탭 바 ── */}
      <div className={`lg:hidden flex gap-1.5 shrink-0 p-1 rounded-2xl ${theme.card}`}>
        {(['todo', 'memo', 'calendar', 'timeline'] as const).map(tab => (
          <button key={tab} onClick={() => setMobilePlannerTab(tab)}
            className={`flex-1 py-2 rounded-xl text-[11px] font-bold transition-colors
              ${mobilePlannerTab === tab ? 'bg-[#1C1C1E] text-[#FACC15]' : `${theme.input} ${theme.textMuted}`}`}>
            {tab === 'todo' ? 'Planner' : tab === 'memo' ? 'Memo' : tab === 'calendar' ? 'Calendar' : 'Timeline'}
          </button>
        ))}
      </div>

      {/* ══ Col-1: 루틴 + 투두 ══ */}
      <div className={`flex-1 lg:flex-[2] flex-col gap-4 lg:gap-5 lg:overflow-y-auto lg:pb-2 ${mobilePlannerTab === "todo" ? "flex" : "hidden lg:flex"}`}>

        {/* 루틴 */}
        <div className={`relative flex-1 rounded-[24px] lg:rounded-[32px] p-5 lg:p-6 overflow-hidden flex flex-col transition-colors ${theme.card}`}>
          <h2 className={`font-heading text-base lg:text-lg font-bold mb-3 relative z-10 flex items-center gap-2 ${appSettings.darkMode ? 'bg-[#2C2C2E]' : 'bg-[#FAFAF8]'}`}>
            <Activity size={18} className="text-green-500"/> Routines
          </h2>
          <div className="absolute left-0 right-0 top-[52px] bottom-0 pointer-events-none z-0"
            style={{ backgroundImage: `linear-gradient(transparent 43px, ${appSettings.darkMode ? '#3A3A3C' : '#E5E7EB'} 44px)`, backgroundSize: '100% 44px' }} />
          <div className="flex-1 overflow-y-auto relative z-10 pr-2">
            {routines.length === 0 && <div className="h-[80px]"><EmptyState theme={theme} icon={Activity} text="Build a daily routine!" /></div>}
            {routines.map((r: Routine) => (
              <div key={r.id} className="min-h-[44px] flex items-center justify-between group" style={{ height: '44px' }}>
                {editingRoutineId === r.id ? (
                  <input autoFocus value={editRoutineText}
                    onChange={e => setEditRoutineText(e.target.value)}
                    onBlur={() => setEditingRoutineId(null)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleUpdateRoutineText(r.id, editRoutineText);
                      else if (e.key === 'Escape') setEditingRoutineId(null);
                    }}
                    className="flex-1 bg-transparent outline-none border-b-2 border-[#FACC15] text-base font-semibold"
                  />
                ) : (
                  <label className="flex items-center gap-3 cursor-pointer flex-1 h-full">
                    <input type="checkbox" checked={r.done} onChange={() => handleToggleRoutine(r.id, r.done)} className="w-5 h-5 accent-[#FACC15] cursor-pointer" />
                    <span className={`text-base font-medium ${r.done ? 'line-through opacity-50' : ''}`}>{r.text}</span>
                  </label>
                )}
                <div className={`flex gap-1 ml-2 ${theme.textMuted} opacity-0 group-hover:opacity-100 transition-opacity`}>
                  {r.is_active && <button onClick={() => { setEditingRoutineId(r.id); setEditRoutineText(r.text); }} className="p-2.5 rounded-lg active:scale-95 hover:text-blue-500"><Edit2 size={15}/></button>}
                  {r.is_active && <button onClick={() => handleDeleteRoutine(r.id)} className="p-2.5 rounded-lg active:scale-95 hover:text-red-500"><X size={15}/></button>}
                </div>
              </div>
            ))}
            <div className="flex items-center gap-2" style={{ height: '44px' }}>
              <Plus size={16} className={`shrink-0 ${theme.textMuted}`}/>
              <input type="text" value={newRoutineText} onChange={e => setNewRoutineText(e.target.value)}
                placeholder="Add new routine..." className="flex-1 bg-transparent outline-none text-sm font-medium"
                onKeyDown={e => { if (e.key === 'Enter' && newRoutineText.trim()) { handleAddRoutine(newRoutineText); setNewRoutineText(''); } }}/>
              {newRoutineText.trim() && (
                <button onClick={() => { handleAddRoutine(newRoutineText); setNewRoutineText(''); }}
                  className="shrink-0 bg-[#1C1C1E] text-[#FACC15] px-3 py-1 rounded-lg text-xs font-bold active:scale-95">Add</button>
              )}
            </div>
          </div>
        </div>

        {/* 할일 */}
        <div className={`relative flex-1 rounded-[24px] lg:rounded-[32px] p-5 lg:p-6 overflow-hidden flex flex-col transition-colors ${theme.card}`}>
          <h2 className={`font-heading text-base lg:text-lg font-bold mb-3 relative z-10 flex items-center gap-2 ${appSettings.darkMode ? 'bg-[#2C2C2E]' : 'bg-[#FAFAF8]'}`}>
            <CheckCircle size={18} className="text-[#FACC15]"/> To-do list
          </h2>
          <div className="absolute left-0 right-0 top-[52px] bottom-0 pointer-events-none z-0"
            style={{ backgroundImage: `linear-gradient(transparent 43px, ${appSettings.darkMode ? '#3A3A3C' : '#E5E7EB'} 44px)`, backgroundSize: '100% 44px' }} />
          <div className="flex-1 overflow-y-auto relative z-10 pr-2">
            {todos.length === 0 && <div className="h-[80px]"><EmptyState theme={theme} icon={Inbox} text="No tasks. Chill out!" /></div>}
            {todos.map((t: Todo) => (
              <div key={t.id} className="min-h-[44px] flex items-center justify-between group" style={{ height: '44px' }}>
                {editingTodoId === t.id ? (
                  <input autoFocus value={editTodoText}
                    onChange={e => setEditTodoText(e.target.value)}
                    onBlur={() => setEditingTodoId(null)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleUpdateTodoText(t.id, editTodoText);
                      else if (e.key === 'Escape') setEditingTodoId(null);
                    }}
                    className="flex-1 bg-transparent outline-none border-b-2 border-[#FACC15] text-base font-semibold"
                  />
                ) : (
                  <label className="flex items-center gap-3 cursor-pointer flex-1 h-full">
                    <input type="checkbox" checked={t.done} onChange={() => handleToggleTodo(t.id, t.done)} className="w-5 h-5 accent-[#FACC15] cursor-pointer" />
                    <span className={`text-base font-medium ${t.done ? 'line-through opacity-50' : ''}`}>{t.text}</span>
                  </label>
                )}
                <div className={`flex gap-1 ml-2 ${theme.textMuted} opacity-0 group-hover:opacity-100 transition-opacity`}>
                  <button onClick={() => { setEditingTodoId(t.id); setEditTodoText(t.text); }} className="p-2.5 rounded-lg active:scale-95 hover:text-blue-500"><Edit2 size={15}/></button>
                  <button onClick={() => handleDeleteTodo(t.id)} className="p-2.5 rounded-lg active:scale-95 hover:text-red-500"><X size={15}/></button>
                </div>
              </div>
            ))}
            <div className="flex items-center gap-2" style={{ height: '44px' }}>
              <Plus size={16} className={`shrink-0 ${theme.textMuted}`}/>
              <input type="text" value={newTodoText} onChange={e => setNewTodoText(e.target.value)}
                placeholder="Add new task..." className="flex-1 bg-transparent outline-none text-sm font-medium"
                onKeyDown={e => { if (e.key === 'Enter' && newTodoText.trim()) { handleAddTodo(newTodoText); setNewTodoText(''); } }}/>
              {newTodoText.trim() && (
                <button onClick={() => { handleAddTodo(newTodoText); setNewTodoText(''); }}
                  className="shrink-0 bg-[#1C1C1E] text-[#FACC15] px-3 py-1 rounded-lg text-xs font-bold active:scale-95">Add</button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ══ Col-2: D-Day 위 + Memo 아래 ══ */}
      <div className={`flex-1 lg:flex-[2.2] flex-col gap-4 lg:gap-5 ${mobilePlannerTab === "memo" ? "flex" : "hidden lg:flex"}`}>

        {/* D-Day */}
        <div className={`rounded-[24px] lg:rounded-[32px] p-5 lg:p-6 flex flex-col shrink-0 transition-colors ${theme.card}`}>
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-heading text-base lg:text-lg font-bold flex items-center gap-2">
              <Target size={18} className="text-red-500"/> D-Day
            </h2>
            <button onClick={() => openDdayModal()} className="bg-[#1C1C1E] text-[#FACC15] px-2.5 py-1.5 rounded-xl text-xs font-bold">
              <Plus size={14} className="inline mr-1"/>Add
            </button>
          </div>
          <div className="max-h-[140px] overflow-y-auto pr-1 space-y-2">
            {ddays.length === 0
              ? <EmptyState theme={theme} icon={Target} text="No D-Days yet" onClick={() => openDdayModal()} />
              : ddays.map((d: DDay) => (
                <div key={d.id} className={`group flex justify-between items-center border-b ${theme.border} pb-2.5`}>
                  <p className="text-sm font-semibold truncate flex-1 mr-2">{d.text}</p>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openDdayModal(d)} className={`p-1.5 rounded-lg ${theme.hoverBg} ${theme.textMuted} active:scale-95`}><Edit2 size={13}/></button>
                      <button onClick={() => handleDeleteDday(d.id)} className={`p-1.5 rounded-lg ${theme.hoverBg} ${theme.textMuted} active:scale-95`}><Trash2 size={13}/></button>
                    </div>
                    <span className="font-heading text-xs font-bold bg-[#FACC15] text-[#1C1C1E] px-2.5 py-1 rounded-xl shrink-0">
                      {calculateDday(d.date)}
                    </span>
                  </div>
                </div>
              ))
            }
          </div>
        </div>

        {/* Memo — 폴더 + 휴지통 */}
        <div className={`flex-1 min-h-[400px] lg:min-h-0 rounded-[24px] lg:rounded-[32px] flex overflow-hidden transition-colors ${theme.card}`}>

          {/* 왼쪽: 폴더 + 노트 목록 */}
          <div className={`w-[140px] lg:w-[170px] shrink-0 flex flex-col border-r ${theme.border}`}>

            {/* 상단: 새 노트 버튼 */}
            <div className="flex items-center justify-between px-3 py-2.5 shrink-0">
              <span className="font-heading text-xs font-black tracking-wide flex items-center gap-1">
                <FileText size={12} className="text-yellow-400"/> Memo
              </span>
              <div className="flex gap-1">
                <button onClick={() => setShowFolderInput(v => !v)} title="New Folder"
                  className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors ${theme.hoverBg} ${theme.textMuted}`}>
                  <FolderPlus size={11}/>
                </button>
                {activeFolderId !== 'trash' && (
                  <button onClick={() => createNote()} title="New Note"
                    className="w-5 h-5 rounded-md bg-[#FACC15] text-[#1C1C1E] flex items-center justify-center active:scale-90 transition-all">
                    <Plus size={11} strokeWidth={3}/>
                  </button>
                )}
              </div>
            </div>

            {/* 폴더 이름 입력 */}
            {showFolderInput && (
              <div className="px-2 pb-2 shrink-0">
                <input autoFocus value={folderInputVal} onChange={e => setFolderInputVal(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && folderInputVal.trim()) {
                      createFolder(folderInputVal.trim());
                      setFolderInputVal(''); setShowFolderInput(false);
                    }
                    if (e.key === 'Escape') { setShowFolderInput(false); setFolderInputVal(''); }
                  }}
                  placeholder="Folder name"
                  className={`w-full text-xs font-semibold px-2 py-1.5 rounded-lg outline-none focus:ring-1 focus:ring-[#FACC15] ${theme.input}`}/>
              </div>
            )}

            <div className={`h-px shrink-0 ${appSettings.darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}/>

            {/* 폴더 목록 */}
            <div className="shrink-0">
              {/* 전체 */}
              <button onClick={() => setActiveFolderId(null)}
                className={`w-full flex items-center gap-1.5 px-3 py-2 text-left transition-colors
                  ${activeFolderId === null ? (appSettings.darkMode ? 'bg-[#3A3A3C]' : 'bg-[#F5F0DC]') : theme.hoverBg}`}>
                <Inbox size={11} className={activeFolderId === null ? 'text-[#FACC15]' : theme.textMuted}/>
                <span className={`text-[11px] font-bold truncate ${activeFolderId === null ? 'text-[#FACC15]' : ''}`}>All Memos</span>
                <span className={`ml-auto text-[10px] font-bold ${theme.textMuted}`}>{notes.filter(n => !n.deletedAt).length}</span>
              </button>

              {/* 사용자 폴더 */}
              {folders.map(f => (
                <div key={f.id} className={`group relative flex items-center transition-colors
                  ${activeFolderId === f.id ? (appSettings.darkMode ? 'bg-[#3A3A3C]' : 'bg-[#F5F0DC]') : theme.hoverBg}`}>
                  {renamingFolderId === f.id ? (
                    <input autoFocus value={renameVal} onChange={e => setRenameVal(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && renameVal.trim()) { renameFolder(f.id, renameVal.trim()); setRenamingFolderId(null); }
                        if (e.key === 'Escape') setRenamingFolderId(null);
                      }}
                      className={`flex-1 text-[11px] font-bold px-3 py-2 bg-transparent outline-none ${theme.textMuted}`}/>
                  ) : (
                    <button onClick={() => setActiveFolderId(f.id)}
                      onDoubleClick={() => { setRenamingFolderId(f.id); setRenameVal(f.name); }}
                      className="flex-1 flex items-center gap-1.5 px-3 py-2 text-left">
                      {activeFolderId === f.id
                        ? <FolderOpen size={11} className="text-[#FACC15] shrink-0"/>
                        : <Folder size={11} className={`${theme.textMuted} shrink-0`}/>}
                      <span className={`text-[11px] font-bold truncate ${activeFolderId === f.id ? 'text-[#FACC15]' : ''}`}>{f.name}</span>
                      <span className={`ml-auto text-[10px] font-bold shrink-0 ${theme.textMuted}`}>{notes.filter(n => !n.deletedAt && n.folderId === f.id).length}</span>
                    </button>
                  )}
                  <button onClick={() => showConfirm(`Delete folder "${f.name}"?`, () => deleteFolder(f.id), { confirmLabel: 'Delete' })}
                    className={`absolute right-1 p-0.5 rounded opacity-0 group-hover:opacity-100 text-red-400 transition-opacity`}>
                    <X size={9}/>
                  </button>
                </div>
              ))}

              {/* 휴지통 */}
              <button onClick={() => setActiveFolderId('trash')}
                className={`w-full flex items-center gap-1.5 px-3 py-2 text-left transition-colors
                  ${activeFolderId === 'trash' ? (appSettings.darkMode ? 'bg-[#3A3A3C]' : 'bg-[#F5F0DC]') : theme.hoverBg}`}>
                <Trash2 size={11} className={activeFolderId === 'trash' ? 'text-red-400' : theme.textMuted}/>
                <span className={`text-[11px] font-bold truncate ${activeFolderId === 'trash' ? 'text-red-400' : ''}`}>Trash</span>
                <span className={`ml-auto text-[10px] font-bold ${theme.textMuted}`}>{notes.filter(n => n.deletedAt !== null).length || ''}</span>
              </button>
            </div>

            <div className={`h-px shrink-0 ${appSettings.darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}/>

            {/* 노트 목록 */}
            <div className="flex-1 overflow-y-auto py-1">
              {visibleNotes.length === 0 && (
                <p className={`text-[10px] text-center py-4 px-2 ${theme.textMuted}`}>
                  {activeFolderId === 'trash' ? 'Trash is empty' : 'No memos'}
                </p>
              )}
              {visibleNotes.map(n => (
                <button key={n.id} onClick={() => setActiveNoteId(n.id)}
                  className={`w-full text-left px-3 py-2.5 transition-colors group relative
                    ${n.id === activeNoteId
                      ? appSettings.darkMode ? 'bg-[#3A3A3C]' : 'bg-[#F5F0DC]'
                      : theme.hoverBg}`}>
                  <p className={`text-xs font-bold truncate ${n.id === activeNoteId ? 'text-[#FACC15]' : ''}`}>
                    {n.title || 'Untitled'}
                  </p>
                  <p className={`text-[10px] truncate mt-0.5 ${theme.textMuted}`}>
                    {new Date(n.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </p>
                  <button
                    onClick={e => { e.stopPropagation(); activeFolderId === 'trash' ? permanentDeleteNote(n.id) : moveNoteToTrash(n.id); }}
                    className={`absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity ${theme.hoverBg} ${activeFolderId === 'trash' ? 'text-red-500' : 'text-red-400'}`}>
                    <X size={10}/>
                  </button>
                </button>
              ))}
            </div>
          </div>

          {/* 오른쪽: 노트 편집기 */}
          {activeNote ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* 타이틀 + 폴더 이동 */}
              <div className="px-4 pt-3 pb-2 shrink-0">
                {activeFolderId === 'trash' ? (
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle size={13} className="text-red-400 shrink-0"/>
                    <span className={`text-[11px] font-semibold text-red-400`}>In Trash · deleted {new Date(activeNote.deletedAt!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    <button onClick={() => restoreNote(activeNote.id)}
                      className="ml-auto flex items-center gap-1 text-[11px] font-bold text-green-400 hover:text-green-300 transition-colors shrink-0">
                      <RotateCcw size={11}/> Restore
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 mb-1.5">
                    <select value={activeNote.folderId ?? ''}
                      onChange={e => updateNote(activeNote.id, { folderId: e.target.value || null })}
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-lg outline-none ${theme.input} ${theme.textMuted}`}>
                      <option value="">No Folder</option>
                      {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                    <p className={`text-[10px] ml-auto ${theme.textMuted}`}>
                      {new Date(activeNote.updatedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                )}
                <input value={activeNote.title}
                  onChange={e => activeFolderId !== 'trash' && updateNote(activeNote.id, { title: e.target.value })}
                  readOnly={activeFolderId === 'trash'}
                  placeholder="Title"
                  className="font-heading text-lg lg:text-xl font-bold bg-transparent outline-none border-none w-full"/>
              </div>
              <div className={`mx-4 h-px shrink-0 ${appSettings.darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}/>
              <div className="flex-1 relative overflow-hidden px-4 py-1">
                <div className="absolute inset-x-4 inset-y-1 pointer-events-none"
                  style={{ backgroundImage: `linear-gradient(transparent 23px, ${appSettings.darkMode ? '#3A3A3C' : '#E8E8E8'} 24px)`, backgroundSize: '100% 24px', backgroundPositionY: '4px' }}/>
                <textarea value={activeNote.body}
                  onChange={e => activeFolderId !== 'trash' && updateNote(activeNote.id, { body: e.target.value })}
                  readOnly={activeFolderId === 'trash'}
                  className="relative z-10 w-full h-full resize-none text-[15px] lg:text-[14px] bg-transparent outline-none border-none font-medium"
                  placeholder="Start writing..."
                  style={{ lineHeight: '24px', paddingTop: '4px' }}/>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <button onClick={() => activeFolderId !== 'trash' && createNote()}
                className={`text-sm font-semibold ${theme.textMuted}`}>+ New Memo</button>
            </div>
          )}
        </div>
      </div>

      {/* ── 우측 컬럼: 캘린더 / 타임라인 ── */}
      <div className={`flex-1 lg:flex-[3.5] flex-col gap-4 lg:gap-5 lg:min-h-0 shrink-0 ${mobilePlannerTab === "calendar" || mobilePlannerTab === "timeline" ? "flex" : "hidden lg:flex"}`}>
        {/* 캘린더 */}
        <div className={`h-[auto] lg:h-[32%] rounded-[24px] lg:rounded-[32px] p-4 lg:p-5 flex-col transition-colors shrink-0 ${theme.card} ${mobilePlannerTab === "calendar" ? "flex" : "hidden lg:flex"}`}>
          <div className="flex justify-between items-center mb-2">
            <h2 className="font-heading text-sm lg:text-base font-bold tabular-nums">
              {currentDate.toLocaleString('en-US', { month: 'long', year: 'numeric' })}
            </h2>
            <div className="flex gap-1">
              <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className={`p-1 rounded-full ${theme.hoverBg}`}><ChevronLeft size={15}/></button>
              <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className={`p-1 rounded-full ${theme.hoverBg}`}><ChevronRight size={15}/></button>
            </div>
          </div>
          <div className={`grid grid-cols-7 gap-1 text-center text-[11px] mb-1.5 font-semibold ${theme.textMuted}`}>
            {['Mo','Tu','We','Th','Fr','Sa','Su'].map(d => <div key={d}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-y-0 text-center text-xs lg:text-sm font-bold">
            {calendarDays.map((day, idx) => {
              if (!day) return <div key={`e-${idx}`}/>;
              const pad = (n: number) => String(n).padStart(2, '0');
              const dateStr = `${year}-${pad(month + 1)}-${pad(day)}`;
              const isSelected = selectedDate.getDate() === day && selectedDate.getMonth() === month && selectedDate.getFullYear() === year;
              const isTodayCell = isToday(dateStr);
              return (
                <div key={day} onClick={() => setSelectedDate(new Date(year, month, day))} className="relative flex justify-center items-center h-7 cursor-pointer">
                  <div className={`w-7 h-7 flex items-center justify-center rounded-full transition-colors font-bold
                    ${isSelected ? 'bg-[#FACC15] text-[#1C1C1E] shadow-md'
                      : isTodayCell ? `ring-2 ring-[#FACC15] ${theme.hoverBg}`
                      : theme.hoverBg}`}>
                    {day}
                  </div>
                  {markedDates?.includes(dateStr) && !isSelected &&
                    <div className={`absolute bottom-0 w-1.5 h-1.5 rounded-full ${appSettings.darkMode ? 'bg-white' : 'bg-[#1C1C1E]'}`}/>
                  }
                </div>
              );
            })}
          </div>
        </div>

        {/* 타임라인 */}
        <div className={`relative lg:flex-1 rounded-[24px] lg:rounded-[32px] p-5 lg:p-6 overflow-hidden flex-col transition-colors min-h-[520px] lg:min-h-0 ${theme.card} ${mobilePlannerTab === "timeline" ? "flex" : "hidden lg:flex"}`}>
          <div className="flex justify-between items-center mb-5">
            <div>
              <h2 className="font-heading text-xl lg:text-2xl font-bold flex items-center gap-2.5">
                <Clock size={24} className="text-[#FACC15]"/> Timeline
              </h2>
              <p className={`text-xs font-semibold mt-0.5 ${theme.textMuted}`}>
                {selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' })}
              </p>
            </div>
            <button onClick={() => openModal()} className="bg-[#1C1C1E] text-[#FACC15] p-2.5 rounded-full shadow-md hover:scale-105 transition-transform">
              <Plus size={20} strokeWidth={3}/>
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
              <div className="flex-1 relative pr-2" onClick={handleTimelineClick} style={{ cursor: 'crosshair' }}>
                {Array.from({ length: 48 }).map((_, i) => (
                  <div key={i} className={`absolute w-full h-px ${appSettings.darkMode ? 'bg-gray-700' : 'bg-gray-100'}`} style={{ top: `${i * 40}px` }}/>
                ))}
                {sortedSchedules.length === 0 && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 opacity-40 pointer-events-none" style={{ top: '320px' }}>
                    <Clock size={28} className={theme.textMuted}/>
                    <p className={`text-sm font-semibold ${theme.textMuted}`}>No schedules yet</p>
                  </div>
                )}
                {/* ── 당일 스케줄 ── */}
                {sortedSchedules.map((sch: Schedule) => {
                  const top = timeToPos(sch.start_time);
                  const TIMELINE_END = 1920;
                  const rawEnd = timeToPos(sch.end_time);
                  const height = sch.end_next_day
                    ? TIMELINE_END - top
                    : Math.max(rawEnd - top, 20);
                  const color = THEME_COLORS.find(c => c.id === sch.color) || THEME_COLORS[0];
                  return (
                    <div key={sch.id}
                      className={`sch-block group absolute left-2 right-2 flex items-start justify-between rounded-xl p-2 shadow-sm ${color.bg} ${color.text}`}
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
                            → continues {sch.end_time} tomorrow
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
                      className={`sch-block group absolute left-2 right-2 flex items-start justify-between rounded-xl p-2 shadow-sm opacity-90 ${color.bg} ${color.text}`}
                      style={{ top: `${top}px`, height: `${height}px` }}>
                      <div className="flex flex-col gap-0.5 ml-1 overflow-hidden flex-1">
                        {/* 전일 연속 배지 */}
                        <span className="text-[10px] font-bold bg-black/25 px-2 py-0.5 rounded-full self-start mb-0.5">
                          ← from yesterday
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

      {/* ── 스케줄 추가/편집 모달 ── */}
      {showForm && (
        <Modal title={editingId ? 'Edit Schedule' : 'New Schedule'} onClose={() => setShowForm(false)} darkMode={appSettings.darkMode}>
          <div className="space-y-5">
            <div>
              <label className={`block text-sm font-semibold mb-2 ${appSettings.darkMode ? 'text-gray-400' : 'text-[#6B6860]'}`}>Text</label>
              <input autoFocus type="text" value={newSch.text} onChange={e => setNewSch({ ...newSch, text: e.target.value })}
                onKeyDown={e => e.key === 'Enter' && handleSaveSchedule()}
                className={`w-full rounded-2xl p-4 outline-none focus:ring-2 focus:ring-[#FACC15] text-base font-medium ${appSettings.darkMode ? 'bg-[#3A3A3C] text-gray-100' : 'bg-[#F2F0EA] text-[#1C1C1E]'}`} placeholder="e.g. Meeting"/>
            </div>
            <div>
              <label className={`block text-sm font-semibold mb-2 ${appSettings.darkMode ? 'text-gray-400' : 'text-[#6B6860]'}`}>Category</label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { id: 'Study',    label: 'Study',   icon: '📚' },
                  { id: 'Work',     label: 'Work',    icon: '💼' },
                  { id: 'Exercise', label: 'Exercise',icon: '🏋️' },
                  { id: 'Personal', label: 'Personal',icon: '👤' },
                  { id: 'Sleep',    label: 'Sleep',   icon: '🌙' },
                  { id: 'Social',   label: 'Social',  icon: '🤝' },
                ] as const).map(cat => (
                  <button key={cat.id} onClick={() => (() => {
                        if (cat.id === 'Sleep') {
                          setNewSch(prev => ({
                            ...prev,
                            category:   'Sleep',
                            color:      'gray',
                            text:       prev.text || 'Sleep',
                            start_time: prev.start_time === '10:00' ? '22:30' : prev.start_time,
                            end_time:   prev.end_time   === '11:00' ? '07:00' : prev.end_time,
                          }));
                          setEndNextDay(true);
                        } else {
                          setNewSch(prev => ({ ...prev, category: cat.id }));
                        }
                      })()}
                    className={`py-2.5 rounded-xl text-xs font-semibold transition-colors flex flex-col items-center gap-1
                      ${newSch.category === cat.id ? 'bg-[#1C1C1E] text-[#FACC15]' : appSettings.darkMode ? 'bg-[#3A3A3C] text-gray-100' : 'bg-[#F2F0EA] text-[#1C1C1E]'}`}>
                    <span className="text-base leading-none">{cat.icon}</span>
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className={`block text-sm font-semibold mb-2 ${appSettings.darkMode ? 'text-gray-400' : 'text-[#6B6860]'}`}>Start</label>
                <input type="time" value={newSch.start_time} step="1800"
                  onChange={e => setNewSch({ ...newSch, start_time: e.target.value })}
                  className={`w-full rounded-2xl p-4 outline-none font-medium text-base tabular-nums ${appSettings.darkMode ? 'bg-[#3A3A3C] text-gray-100' : 'bg-[#F2F0EA] text-[#1C1C1E]'}`}/>
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-center mb-2">
                  <label className={`text-sm font-semibold ${appSettings.darkMode ? 'text-gray-400' : 'text-[#6B6860]'}`}>End</label>
                  <button type="button"
                    onClick={() => setEndNextDay(v => !v)}
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-lg transition-colors
                      ${endNextDay ? 'bg-[#FACC15] text-[#1C1C1E]' : appSettings.darkMode ? 'bg-[#3A3A3C] text-gray-400' : 'bg-[#F2F0EA] text-[#6B6860]'}`}>
                    +1 day
                  </button>
                </div>
                <input type="time" value={newSch.end_time} step="1800"
                  onChange={e => setNewSch({ ...newSch, end_time: e.target.value })}
                  className={`w-full rounded-2xl p-4 outline-none font-medium text-base tabular-nums ${appSettings.darkMode ? 'bg-[#3A3A3C] text-gray-100' : 'bg-[#F2F0EA] text-[#1C1C1E]'}
                    ${endNextDay ? 'ring-2 ring-[#FACC15]' : ''}`}/>
                {endNextDay && <p className="text-[10px] text-[#FACC15] font-bold mt-1 pl-1">익일 종료</p>}
              </div>
            </div>
            <div>
              <label className={`block text-sm font-semibold mb-2 ${appSettings.darkMode ? 'text-gray-400' : 'text-[#6B6860]'}`}>Color</label>
              <div className="flex gap-3">
                {THEME_COLORS.map(c => (
                  <div key={c.id} onClick={() => setNewSch({ ...newSch, color: c.id })}
                    className={`w-10 h-10 rounded-full cursor-pointer shadow-sm transition-transform hover:scale-110 ${c.bg}
                      ${newSch.color === c.id ? `ring-4 ring-offset-2 ${appSettings.darkMode ? 'ring-gray-300 ring-offset-[#2C2C2E]' : 'ring-gray-800 ring-offset-[#FAFAF8]'}` : ''}`}/>
                ))}
              </div>
            </div>
            <label className={`flex items-center gap-3 cursor-pointer p-4 rounded-2xl ${appSettings.darkMode ? 'bg-[#3A3A3C]' : 'bg-[#F2F0EA]'}`}>
              <input type="checkbox" checked={newSch.is_dday} onChange={e => setNewSch({ ...newSch, is_dday: e.target.checked })} className="w-5 h-5 accent-[#FACC15]"/>
              <span className="text-base font-semibold">Set as D-Day</span>
            </label>
            <button onClick={handleSaveSchedule} className="w-full bg-[#1C1C1E] text-[#FACC15] font-bold text-lg rounded-2xl p-4 mt-2 hover:bg-gray-800 transition-colors shadow-lg">
              Save Schedule
            </button>
          </div>
        </Modal>
      )}

      {/* ── D-Day 모달 ── */}
      {showDdayForm && (
        <Modal title={editingDdayId ? 'Edit D-Day' : 'New D-Day'} onClose={() => setShowDdayForm(false)} darkMode={appSettings.darkMode} maxWidth="max-w-[380px]">
          <div className="space-y-4">
            <div>
              <label className={`block text-sm font-semibold mb-2 ${appSettings.darkMode ? 'text-gray-400' : 'text-[#6B6860]'}`}>Title</label>
              <input autoFocus type="text" value={ddayForm.text} onChange={e => setDdayForm({ ...ddayForm, text: e.target.value })}
                onKeyDown={e => e.key === 'Enter' && handleSaveDday()}
                className={`w-full rounded-2xl p-4 outline-none focus:ring-2 focus:ring-[#FACC15] text-base font-medium ${appSettings.darkMode ? 'bg-[#3A3A3C] text-gray-100' : 'bg-[#F2F0EA] text-[#1C1C1E]'}`} placeholder="e.g. Exam Day"/>
            </div>
            <div>
              <label className={`block text-sm font-semibold mb-2 ${appSettings.darkMode ? 'text-gray-400' : 'text-[#6B6860]'}`}>Date</label>
              <input type="date" value={ddayForm.date} onChange={e => setDdayForm({ ...ddayForm, date: e.target.value })}
                className={`w-full rounded-2xl p-4 outline-none focus:ring-2 focus:ring-[#FACC15] text-base font-medium ${appSettings.darkMode ? 'bg-[#3A3A3C] text-gray-100' : 'bg-[#F2F0EA] text-[#1C1C1E]'}`}/>
            </div>
            <button onClick={handleSaveDday} className="w-full bg-[#1C1C1E] text-[#FACC15] font-bold text-lg rounded-2xl p-4 hover:bg-gray-800 transition-colors shadow-lg">
              Save D-Day
            </button>
          </div>
        </Modal>
      )}

      {confirm && <ConfirmModal message={confirm.message} onConfirm={handleConfirm} onCancel={clearConfirm} darkMode={appSettings.darkMode} confirmLabel={confirm.confirmLabel} variant={confirm.variant}/>}
    </div>
  );
};
