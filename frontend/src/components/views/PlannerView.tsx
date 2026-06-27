import { useState, useCallback, useMemo, useEffect } from 'react';
import useSWR from 'swr';
import { fetcher } from '../../lib/fetcher';
import { API_URL } from '../../lib/config';
import { remoteSWRKey } from '../../lib/remoteBoundary';
import { X, Calendar } from 'lucide-react';
import { useConfirm } from '../../hooks/useConfirm';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { useApiMutation } from '../../hooks/useApiMutation';
import { ConfirmModal } from '../common/ConfirmModal';
import { WorkspacePageHeader } from '../common/WorkspacePageHeader';
import { WORKSPACE_GAP_CLASS } from '../../lib/uiSpacingTokens';
import { WORKSPACE_MODAL_SURFACE } from '../common/workspaceCardSizes';
import { PlannerProps, Schedule } from '../../types';
import { useTranslation } from '../../lib/i18n';
import { CalendarShell } from './features/planner/calendar-ui';
import { usePlannerScheduleEventActions } from './features/planner/hooks/usePlannerScheduleEventActions';
import { EventNoteDialog } from './features/knowledge/trace/EventNoteDialog';
import { buildNoteChrome } from './noteEditorTheme';
import { openNote } from '../../lib/noteNavigation';
import { openRelatedNote, findNoteByTitle } from '../../lib/crossDomainReferences';
import { registerSearchDomainHandlers } from './features/search/searchDomainNavigation';
import { recordPlannerActivity } from './features/planner/plannerActivityStorage';
import { ScheduleEventDetailPanel } from './features/planner/calendar-ui/day/ScheduleEventDetailPanel';
import { formatLongDate } from './k102DateFormat';
import type { PlannerScheduleRow } from './features/planner/calendar';

type ScheduleDday = Schedule & { date: string };

export const PlannerView = ({
  now, currentDate, setCurrentDate, selectedDate, setSelectedDate,
  formatDate, isToday, showToast,   mutateDaily, mutateStatic, mutateRoutines,
  appSettings, schedules, todos, routines, weeklySchedules, theme, THEME_COLORS,
}: PlannerProps) => {
  const { t, lang } = useTranslation();
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
  const [scheduleDetailId, setScheduleDetailId] = useState<string | null>(null);
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
  const { data: prevSchedules = [] } = useSWR<Schedule[]>(
    remoteSWRKey(`${API_URL}/api/schedules?date=${prevDateStr}`),
    fetcher,
    { revalidateOnFocus: false }
  );
  const { data: ddaySchedules = [], mutate: mutateDdaySchedules } = useSWR<ScheduleDday[]>(
    remoteSWRKey(`${API_URL}/api/schedules/ddays`),
    fetcher,
    { revalidateOnFocus: false },
  );
  // 전날 일정 — calendar projection carry-over

  useEscapeKey(() => {
    setShowForm(false);
    setScheduleDetailId(null);
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
  const openModal = (sch?: Schedule | ScheduleDday) => {
    setNewSch(sch ?? { text: '', start_time: '10:00', end_time: '11:00', is_dday: false, color: 'purple', category: 'Personal' });
    setEditingId(sch?.id ?? null);
    setEndNextDay(sch?.end_next_day ?? false);
    setScheduleDateStr(sch && 'date' in sch ? sch.date : formatDate(selectedDate));
    setShowForm(true);
  };
  const handleSaveSchedule = async () => {
    if (!newSch.text) return showToast(t('enterText'), 'error');
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
    const doSave = async () => {
      const ok = await api(
        editingId ? 'PUT' : 'POST',
        editingId ? `/api/schedules/${editingId}` : '/api/schedules',
        { ...payload, date: scheduleDateStr, end_next_day: isDday ? false : endNextDay },
        { revalidate: 'both', successMsg: t('scheduleSaved') },
      );
      if (ok) {
        setShowForm(false);
        void mutateDdaySchedules();
      }
    };
    if (isOverlap) { showConfirm(t('overlapMsg'), doSave, { confirmLabel: t('saveLabel'), variant: 'primary' }); return; }
    doSave();
  };
  const handleDeleteSchedule = (id: string) =>
    showConfirm(t('deleteSchedule'), async () => {
      const ok = await api('DELETE', `/api/schedules/${id}`, undefined, { revalidate: 'both', successMsg: t('deleted') });
      if (ok) void mutateDdaySchedules();
    },
      { confirmLabel: t('deleteLabel') },
    );

  const handleDuplicateSchedule = useCallback((id: string) => {
    const sch = schedules.find(s => s.id === id);
    if (!sch) return;
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
    setShowForm(true);
  }, [schedules]);

  const scheduleDetailBlock = useMemo((): PlannerScheduleRow | null => {
    if (!scheduleDetailId) return null;
    const sch = schedules.find(s => s.id === scheduleDetailId)
      ?? prevSchedules.find(s => s.id === scheduleDetailId);
    if (!sch) return null;
    return {
      id: sch.id,
      dateKey: formatDate(selectedDate),
      title: sch.text,
      startTime: sch.start_time,
      endTime: sch.end_time,
      endNextDay: sch.end_next_day ?? false,
      category: sch.category,
      color: sch.color,
      source: 'schedule',
    };
  }, [scheduleDetailId, schedules, prevSchedules, selectedDate, formatDate]);

  const openScheduleDetail = useCallback((id: string) => {
    const sch = schedules.find(s => s.id === id) ?? prevSchedules.find(s => s.id === id);
    if (sch) recordPlannerActivity('schedule', id, sch.text);
    setScheduleDetailId(id);
  }, [schedules, prevSchedules]);

  const handleOpenScheduleRelatedNote = useCallback(() => {
    if (!scheduleDetailBlock) return;
    openRelatedNote({
      title: scheduleDetailBlock.title,
      returnTab: 'planner',
      breadcrumb: [
        { type: 'key', key: 'planner' },
        { type: 'key', key: 'k113OpenRelatedNote' },
      ],
    });
  }, [scheduleDetailBlock]);

  const scheduleRelatedNoteAvailable = useMemo(() => {
    if (!scheduleDetailBlock) return false;
    return Boolean(findNoteByTitle(scheduleDetailBlock.title));
  }, [scheduleDetailBlock]);

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
      setScheduleDetailId(null);
      const sch = schedules.find(s => s.id === id);
      if (sch) openModal(sch);
    },
    onDelete: (id: string) => {
      setScheduleDetailId(null);
      handleDeleteSchedule(id);
    },
    onDuplicate: handleDuplicateSchedule,
  }), [schedules, openScheduleDetail, handleDeleteSchedule, handleDuplicateSchedule]);

  const routineActions = useMemo(() => ({
    onAdd: (text: string) => {
      void api(
        'POST',
        '/api/routines',
        { text, created_date: formatDate(selectedDate) },
        { revalidate: 'daily', successMsg: t('routineSaved') },
      );
    },
    onToggle: (routineId: string, currentDone: boolean) => {
      mutateRoutines(
        cur => cur.map(routine => (
          routine.id === routineId ? { ...routine, done: !currentDone } : routine
        )),
        false,
      );
      void api(
        'POST',
        '/api/routine_logs',
        { routine_id: routineId, date: formatDate(selectedDate), done: !currentDone },
        { revalidate: 'daily' },
      );
    },
    onEdit: (routineId: string, text: string) => {
      void api(
        'PUT',
        `/api/routines/${routineId}`,
        { text },
        { revalidate: 'daily', successMsg: t('routineSaved') },
      );
    },
    onDelete: (routineId: string) => {
      showConfirm(
        t('deleteRoutine'),
        async () => {
          await api(
            'DELETE',
            `/api/routines/${routineId}`,
            undefined,
            { revalidate: 'daily', successMsg: t('routineDeleted') },
          );
        },
        { confirmLabel: t('deleteLabel') },
      );
    },
  }), [api, formatDate, mutateRoutines, selectedDate, showConfirm, t]);

  return (
    <div className={`flex-1 flex flex-col min-h-0 overflow-hidden animate-in fade-in duration-300 ${WORKSPACE_GAP_CLASS}`} data-workspace="planner" data-k134b-workspace-scroll>
      <div className="shrink-0 px-0.5">
        <WorkspacePageHeader
          workspace="schedule"
          title={t('planner')}
          subtitle={t('k125ScheduleSubtitle')}
          icon={Calendar}
          theme={theme}
          dark={appSettings.darkMode}
        />
      </div>
      <CalendarShell
        now={now}
        anchorDate={formatDate(selectedDate)}
        schedules={schedules}
        previousDaySchedules={prevSchedules}
        previousDayDate={prevDateStr}
        routines={routines}
        ddaySchedules={ddaySchedules}
        weeklySchedules={weeklySchedules}
        appSettings={appSettings}
        theme={theme}
        onEventNoteClick={openPlannerNote}
        onAnchorDateChange={handleCalendarAnchorChange}
        dayScheduleActions={cardScheduleActions}
        routineActions={routineActions}
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
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 backdrop-blur-sm" onClick={() => setShowForm(false)}>
          <div className={`${WORKSPACE_MODAL_SURFACE} w-full max-w-[380px] ${theme.card}`} onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-heading text-lg font-bold">{editingId ? t('editSchedule') : t('newSchedule')}</h3>
              <button onClick={() => setShowForm(false)} className={`min-h-[40px] min-w-[40px] flex items-center justify-center rounded-full ${theme.hoverBg}`}><X size={18}/></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className={`block text-xs font-bold uppercase tracking-wide mb-1.5 ${theme.textMuted}`}>{t('labelText')}</label>
                <input autoFocus type="text" value={newSch.text} onChange={e => setNewSch({ ...newSch, text: e.target.value })}
                  onKeyDown={e => e.key === 'Enter' && handleSaveSchedule()}
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
              <div>
                <label className={`block text-xs font-bold uppercase tracking-wide mb-1.5 ${theme.textMuted}`}>{t('defaultCategory')}</label>
                <select
                  value={newSch.category ?? 'Personal'}
                  onChange={e => setNewSch({ ...newSch, category: e.target.value })}
                  className={`w-full rounded-xl p-3 outline-none text-sm font-semibold ${theme.input}`}
                >
                  {(['Study', 'Work', 'Exercise', 'Personal'] as const).map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
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
                  <div>
                    <label className={`block text-xs font-bold uppercase tracking-wide mb-1.5 ${theme.textMuted}`}>{t('defaultCategory')}</label>
                    <select
                      value={newSch.category ?? 'Personal'}
                      onChange={e => setNewSch({ ...newSch, category: e.target.value })}
                      className={`w-full rounded-xl p-3 outline-none text-sm font-semibold ${theme.input}`}
                    >
                      {(['Study', 'Work', 'Exercise', 'Personal'] as const).map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <p className={`text-[11px] ${theme.textMuted}`}>{t('k80DdayTimeHint')}</p>
                </>
              )}
              <button onClick={handleSaveSchedule} className="w-full bg-primary text-primary-foreground font-bold text-base rounded-xl py-3 hover:opacity-90 transition-opacity shadow-md">
                {t('saveSchedule')}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirm && <ConfirmModal message={confirm.message} onConfirm={handleConfirm} onCancel={clearConfirm} darkMode={appSettings.darkMode} confirmLabel={confirm.confirmLabel} variant={confirm.variant}/>}

      {scheduleDetailBlock ? (
        <ScheduleEventDetailPanel
          block={scheduleDetailBlock}
          theme={theme}
          dateLabel={formatLongDate(selectedDate, lang)}
          onEdit={() => {
            const sch = schedules.find(s => s.id === scheduleDetailBlock.id)
              ?? prevSchedules.find(s => s.id === scheduleDetailBlock.id);
            setScheduleDetailId(null);
            if (sch) openModal(sch);
          }}
          onDelete={() => {
            handleDeleteSchedule(scheduleDetailBlock.id);
            setScheduleDetailId(null);
          }}
          onDuplicate={() => {
            handleDuplicateSchedule(scheduleDetailBlock.id);
            setScheduleDetailId(null);
          }}
          onClose={() => setScheduleDetailId(null)}
          relatedNoteAvailable={scheduleRelatedNoteAvailable}
          onOpenRelatedNote={handleOpenScheduleRelatedNote}
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
