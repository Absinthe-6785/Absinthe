import { useState, useCallback, useMemo } from 'react';
import useSWR from 'swr';
import { fetcher } from '../../lib/fetcher';
import { API_URL } from '../../lib/config';
import { Plus, X, Trash2, BookOpen, Briefcase, Dumbbell, User, Moon, Users } from 'lucide-react';
import { useConfirm } from '../../hooks/useConfirm';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { useApiMutation } from '../../hooks/useApiMutation';
import { ConfirmModal } from '../common/ConfirmModal';
import { PlannerProps, Schedule, Routine } from '../../types';
import { useTranslation } from '../../lib/i18n';
import { CalendarShell } from './features/planner/calendar-ui';
import { openNote } from '../../lib/noteNavigation';

export const PlannerView = ({
  now, currentDate, setCurrentDate, selectedDate, setSelectedDate,
  formatDate, isToday, showToast, mutateDaily, mutateStatic,
  mutateTodos, mutateRoutines,
  appSettings, schedules, todos, routines, weeklySchedules, theme, THEME_COLORS,
}: PlannerProps) => {
  const { t, lang } = useTranslation();
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

  const [showExceptionModal, setShowExceptionModal] = useState(false);
  const [exceptionForm, setExceptionForm] = useState({ start_date: '', end_date: '', reason: '' });

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
  // 전날 일정 — calendar projection carry-over

  useEscapeKey(() => {
    setShowForm(false);
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
  const handleUpdateRoutineText = async (id: string, text: string) => {
    if (!text.trim()) return;
    await api('PUT', `/api/routines/${id}`, { text }, { revalidate: 'daily' });
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
    if (!text.trim()) return;
    await api('PUT', `/api/todos_text/${id}`,
      { date: formatDate(selectedDate), text },
      { revalidate: 'daily' },
    );
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

  const routineExceptionDates = useMemo(
    () => (routines[0]?.is_exception_day ? new Set([formatDate(selectedDate)]) : undefined),
    [routines, selectedDate, formatDate],
  );

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
                    { id: 'Study',    label: 'Study',   Icon: BookOpen,  color: 'gold' },
                    { id: 'Work',     label: 'Work',    Icon: Briefcase, color: 'blue' },
                    { id: 'Exercise', label: 'Workout', Icon: Dumbbell,  color: 'blue' },
                    { id: 'Personal', label: 'Personal', Icon: User,     color: 'green' },
                    { id: 'Sleep',    label: 'Sleep',   Icon: Moon,      color: 'gray' },
                    { id: 'Social',   label: 'Social',  Icon: Users,     color: 'pink' },
                  ] as const).map(cat => (
                    <button key={cat.id} onClick={() => (() => {
                          if (cat.id === 'Exercise') {
                            setNewSch(prev => ({
                              ...prev,
                              category:   'Exercise',
                              color:      cat.color,
                              text:       prev.text || 'Workout',
                            }));
                          } else if (cat.id === 'Sleep') {
                            setNewSch(prev => ({
                              ...prev,
                              category:   'Sleep',
                              color:      cat.color,
                              text:       prev.text || 'Sleep',
                              start_time: prev.start_time === '10:00' ? '22:30' : prev.start_time,
                              end_time:   prev.end_time   === '11:00' ? '07:00' : prev.end_time,
                            }));
                          } else {
                            setNewSch(prev => ({ ...prev, category: cat.id, color: cat.color }));
                          }
                        })()}
                      className={`py-2.5 rounded-xl text-xs font-semibold transition-colors flex flex-col items-center gap-1 border-2
                        ${newSch.category === cat.id
                          ? `${THEME_COLORS.find(c => c.id === cat.color)?.bg ?? 'bg-primary'} text-white border-transparent shadow-sm`
                          : `border-transparent ${theme.input}`}`}>
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
