import { useState, useMemo, useCallback, useEffect, ReactNode } from 'react';
import { BookOpen, Briefcase, Dumbbell, Activity, Clock, Calendar, CalendarDays, CheckCircle, Plus, X, Moon, Users } from 'lucide-react';
import useSWR from 'swr';
import { fetcher } from '../../lib/fetcher';
import { API_URL } from '../../lib/config';
import { useConfirm } from '../../hooks/useConfirm';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { useApiMutation } from '../../hooks/useApiMutation';
import { AnalyticsProps, Schedule, Routine, WeeklySchedule } from '../../types';
import { ConfirmModal } from '../common/ConfirmModal';

const CATEGORY_META: Record<string, { icon: ReactNode; color: string; tw: string }> = {
  Study:    { icon: <BookOpen size={16}/>,  color: 'bg-blue-500',    tw: 'text-blue-500'    },
  Work:     { icon: <Briefcase size={16}/>, color: 'bg-purple-500',  tw: 'text-purple-500'  },
  Exercise: { icon: <Dumbbell size={16}/>,  color: 'bg-green-500',   tw: 'text-green-500'   },
  Personal: { icon: <Activity size={16}/>,  color: 'bg-pink-500',    tw: 'text-pink-500'    },
  Sleep:    { icon: <Moon size={16}/>,      color: 'bg-indigo-400',  tw: 'text-indigo-400'  },
  Social:   { icon: <Users size={16}/>,     color: 'bg-orange-400',  tw: 'text-orange-400'  },
};

// 완전히 정적인 값 — 렌더마다 재생성되지 않도록 모듈 레벨로 분리.
const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const SCHEDULE_HOURS = Array.from({ length: 24 }, (_, i) => i);

// parseTime: 렌더 루프 안에서 매번 재생성되지 않도록 모듈 레벨로 분리.
const parseTime = (t: string): number => {
  const [h, m] = t.split(':');
  return parseInt(h || '0') + parseInt(m || '0') / 60;
};

export const AnalyticsView = ({
  now, mutateStatic, showToast, weeklySchedules, schedules,
  appSettings, theme, THEME_COLORS, routines, formatDate,
}: AnalyticsProps) => {
  const { mutate: api } = useApiMutation(null, mutateStatic, showToast);
  const { confirm, showConfirm, clearConfirm, handleConfirm } = useConfirm();

  const [timeRange, setTimeRange] = useState('weekly');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const { analyticsStart, analyticsEnd } = useMemo(() => {
    const today = now.toJSDate();
    if (timeRange === 'weekly') {
      const dayOfWeek = (today.getDay() + 6) % 7;
      const mon = new Date(today); mon.setDate(today.getDate() - dayOfWeek);
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      return { analyticsStart: formatDate(mon), analyticsEnd: formatDate(sun) };
    }
    if (timeRange === 'monthly') {
      const y = today.getFullYear(), m = today.getMonth();
      return { analyticsStart: formatDate(new Date(y, m, 1)), analyticsEnd: formatDate(new Date(y, m + 1, 0)) };
    }
    if (timeRange === 'custom' && customStartDate && customEndDate)
      return { analyticsStart: customStartDate, analyticsEnd: customEndDate };
    return { analyticsStart: formatDate(today), analyticsEnd: formatDate(today) };
  }, [timeRange, customStartDate, customEndDate, now, formatDate]);

  const analyticsUrl = analyticsStart && analyticsEnd
    ? `${API_URL}/api/schedules/range?start_date=${analyticsStart}&end_date=${analyticsEnd}`
    : null;

  // lib/fetcher가 authFetch + HTTP 오류 throw를 이미 처리하므로 직접 사용.
  // 개선 전: authFetch를 직접 import해 동일한 에러처리를 useCallback으로 인라인 선언.
  // 개선 후: 공유 fetcher로 교체 → authFetch import 및 rangesFetcher useCallback 제거.
  const onRangeError = useCallback(
    () => showToast('Failed to load analytics data', 'error'),
    [showToast],
  );

  const { data: rangeSchedules, isLoading: isRangeLoading } = useSWR(
    analyticsUrl,
    fetcher,
    { onError: onRangeError },
  );

  const analyticsSchedules: Schedule[] = rangeSchedules ?? schedules;

  // ── Workout Days — 이번 주 월~일 날짜 계산 ──
  const thisWeekDates = useMemo(() => {
    const today = now.toJSDate();
    const dayOfWeek = (today.getDay() + 6) % 7; // 0=Mon
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - dayOfWeek + i);
      const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0');
      return `${y}-${m}-${day}`;
    });
  }, [now]);

  const workoutDaysUrl = thisWeekDates.length === 7
    ? `${API_URL}/api/workouts/range?start_date=${thisWeekDates[0]}&end_date=${thisWeekDates[6]}`
    : null;

  const { data: weekWorkouts } = useSWR(workoutDaysUrl, fetcher, { refreshInterval: 60000 });

  // 이번 주에 운동 기록이 있는 날짜 Set
  const workoutDoneSet = useMemo(() => {
    const s = new Set<string>();
    if (Array.isArray(weekWorkouts)) {
      weekWorkouts.forEach((w: { date: string }) => { if (w.date) s.add(w.date); });
    }
    return s;
  }, [weekWorkouts]);

  // 토글 오버라이드 — 이번 세션 중 사용자가 직접 누른 날짜
  const [workoutToggle, setWorkoutToggle] = useState<Record<string, boolean>>({});
  const toggleWorkoutDay = (dateStr: string) => {
    const current = workoutToggle[dateStr] ?? workoutDoneSet.has(dateStr);
    setWorkoutToggle(prev => ({ ...prev, [dateStr]: !current }));
  };
  const isWorkoutDone = (dateStr: string) =>
    workoutToggle[dateStr] ?? workoutDoneSet.has(dateStr);

  const [showWeeklyModal, setShowWeeklyModal] = useState(false);
  const [editingWeeklyId, setEditingWeeklyId] = useState<string | null>(null);
  const [newWeeklySch, setNewWeeklySch] = useState<Partial<WeeklySchedule>>({
    day: 0, title: '', start_time: '09:00', end_time: '10:00', color: THEME_COLORS.find(c => c.id === 'blue')?.bg ?? THEME_COLORS[0].bg,
  });

  useEscapeKey(() => { setShowWeeklyModal(false); clearConfirm(); });

  const openWeeklyModal = (sch?: WeeklySchedule) => {
    setNewWeeklySch(sch ?? { day: 0, title: '', start_time: '09:00', end_time: '10:00', color: THEME_COLORS.find(c => c.id === 'blue')?.bg ?? THEME_COLORS[0].bg });
    setEditingWeeklyId(sch?.id ?? null);
    setShowWeeklyModal(true);
  };
  const saveWeeklySchedule = async () => {
    if (!newWeeklySch.title) return showToast('Enter title', 'error');
    if (newWeeklySch.start_time && newWeeklySch.end_time && newWeeklySch.start_time >= newWeeklySch.end_time)
      return showToast('End time must be later!', 'error');
    const ok = await api(
      editingWeeklyId ? 'PUT' : 'POST',
      editingWeeklyId ? `/api/weekly_schedules/${editingWeeklyId}` : '/api/weekly_schedules',
      { ...newWeeklySch },
      { revalidate: 'static', successMsg: 'Schedule saved' },
    );
    if (ok) setShowWeeklyModal(false);
  };
  const deleteWeeklySchedule = (id: string) =>
    showConfirm('Delete this activity?', () =>
      api('DELETE', `/api/weekly_schedules/${id}`, undefined, { revalidate: 'static', successMsg: 'Deleted' }),
      { confirmLabel: 'Delete' },
    );

  const routineCompletionRate = routines?.length
    ? Math.round((routines.filter((r: Routine) => r.done).length / routines.length) * 100)
    : 0;

  const computedStats = useMemo(() => {
    if (!analyticsSchedules?.length) return [];
    const hoursByCat: Record<string, number> = {};
    for (const sch of analyticsSchedules) {
      if (!sch.start_time || !sch.end_time) continue;
      const [sh, sm] = sch.start_time.split(':').map(Number);
      const [eh, em] = sch.end_time.split(':').map(Number);
      const hrs = Math.max(0, (eh * 60 + em - sh * 60 - sm) / 60);
      const cat = sch.category || 'Personal';
      hoursByCat[cat] = (hoursByCat[cat] || 0) + hrs;
    }
    const total = Object.values(hoursByCat).reduce((a, b) => a + b, 0);
    if (!total) return [];
    return Object.entries(hoursByCat)
      .sort(([, a], [, b]) => b - a)
      .map(([cat, hrs]) => ({
        cat,
        icon: CATEGORY_META[cat]?.icon ?? <Activity size={16}/>,
        color: CATEGORY_META[cat]?.color ?? 'bg-gray-500',
        hrs: Math.round(hrs * 10) / 10,
        percent: Math.round((hrs / total) * 100),
      }));
  }, [analyticsSchedules]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden py-1 pr-1 animate-in fade-in duration-300">
      {/* ── 헤더 + 기간 선택 ── */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end mb-6 px-2 lg:pl-2 lg:pr-6 shrink-0 gap-4 lg:gap-0">
        <div>
          <h1 className={`font-heading text-2xl lg:text-3xl font-bold ${appSettings.darkMode ? 'text-white' : 'text-gray-900'}`}>Your Analytics</h1>
          <p className={`text-sm lg:text-base font-medium mt-1 ${theme.textMuted}`}>{analyticsStart} ~ {analyticsEnd}</p>
        </div>
        <div className="flex flex-col items-start lg:items-end gap-3 w-full lg:w-auto">
          <div className={`flex p-1.5 rounded-2xl shadow-inner w-full lg:w-auto overflow-x-auto ${appSettings.darkMode ? 'bg-[#2C2C2E]' : 'bg-[#E5E7EB]'}`}>
            {[['weekly','Weekly'],['monthly','Monthly']].map(([val, label]) => (
              <button key={val} onClick={() => setTimeRange(val)}
                className={`px-4 lg:px-5 py-2 rounded-xl text-xs lg:text-sm font-bold transition-all whitespace-nowrap
                  ${timeRange === val ? 'bg-[#1C1C1E] text-white shadow-sm' : `${theme.textMuted} hover:text-current`}`}>
                {label}
              </button>
            ))}
            <button onClick={() => setTimeRange('custom')}
              className={`px-4 lg:px-5 py-2 rounded-xl text-xs lg:text-sm font-bold transition-all flex items-center gap-1.5 whitespace-nowrap
                ${timeRange === 'custom' ? 'bg-[#1C1C1E] text-white shadow-sm' : `${theme.textMuted} hover:text-current`}`}>
              <CalendarDays size={16}/> Custom
            </button>
          </div>
          {timeRange === 'custom' && (
            <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-sm border animate-in slide-in-from-top-2 w-full lg:w-auto ${theme.card} ${theme.border}`}>
              <span className={`text-xs font-bold ${theme.textMuted}`}>From</span>
              <input type="date" value={customStartDate} onChange={e => setCustomStartDate(e.target.value)} className={`text-sm font-semibold px-2 py-1 rounded-lg outline-none ${theme.input}`}/>
              <span className={`font-bold ${theme.textMuted}`}>—</span>
              <span className={`text-xs font-bold ${theme.textMuted}`}>To</span>
              <input type="date" value={customEndDate} min={customStartDate} onChange={e => setCustomEndDate(e.target.value)} className={`text-sm font-semibold px-2 py-1 rounded-lg outline-none ${theme.input}`}/>
              {(!customStartDate || !customEndDate) && <span className="text-[10px] font-semibold text-amber-500 ml-1">Select both dates</span>}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-5 overflow-y-auto lg:overflow-hidden pr-2 pb-20 lg:pb-2">
        {/* ── 좌측: 통계 카드 3개 ── */}
        <div className="w-full lg:flex-[3.5] flex flex-col gap-5 shrink-0">
          {/* 시간 분포 */}
          <div className={`flex-[1.5] rounded-[24px] lg:rounded-[32px] shadow-sm p-6 lg:p-8 flex flex-col relative overflow-hidden transition-colors ${theme.card}`}>
            <h2 className={`font-heading text-lg font-bold mb-6 flex items-center gap-2 ${appSettings.darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
              <Clock size={20} className="text-blue-500"/> Time Distribution
            </h2>
            <div className="flex-1 flex flex-col justify-center space-y-6">
              {isRangeLoading && <p className={`text-sm ${theme.textMuted} text-center`}>Loading…</p>}
              {!isRangeLoading && computedStats.length === 0 && <p className={`text-sm ${theme.textMuted} text-center`}>No schedules in this period.</p>}
              {computedStats.map((stat) => (
                <div key={stat.cat}>
                  <div className="flex justify-between items-end mb-2.5">
                    <div className="flex items-center gap-2 font-bold text-sm">
                      <div className={`p-1.5 rounded-lg text-white ${stat.color}`}>{stat.icon}</div>
                      {stat.cat}
                    </div>
                    <div className="text-right">
                      <span className="text-base font-bold">{stat.hrs}h</span>
                      <span className={`text-xs font-semibold ml-2 ${theme.textMuted}`}>({stat.percent}%)</span>
                    </div>
                  </div>
                  <div className={`w-full h-3 rounded-full overflow-hidden ${appSettings.darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                    <div className={`h-full rounded-full ${stat.color} transition-all duration-1000`} style={{ width: `${stat.percent}%` }}/>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 운동 요일 */}
          <div className={`rounded-[24px] lg:rounded-[32px] shadow-sm p-5 lg:p-6 flex flex-col relative transition-colors ${theme.card}`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading text-base font-bold flex items-center gap-2">
                <Activity size={18} className="text-green-500"/> Workout Days
              </h2>
              <span className={`text-xs font-semibold ${theme.textMuted}`}>
                {thisWeekDates[0]?.slice(5)} ~ {thisWeekDates[6]?.slice(5)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-1">
              {['Mo','Tu','We','Th','Fr','Sa','Su'].map((day, idx) => {
                const dateStr = thisWeekDates[idx] ?? '';
                const done = isWorkoutDone(dateStr);
                const isToday = dateStr === formatDate(now.toJSDate());
                return (
                  <button key={idx}
                    onClick={() => toggleWorkoutDay(dateStr)}
                    className={`flex-1 flex flex-col items-center gap-1.5 py-2 rounded-2xl transition-all active:scale-95
                      ${done
                        ? 'bg-green-500/20 border border-green-500/40'
                        : isToday
                          ? `border-2 border-[#FACC15]/60 ${appSettings.darkMode ? 'bg-[#2C2C2E]' : 'bg-gray-50'}`
                          : `border border-transparent ${appSettings.darkMode ? 'bg-[#2C2C2E]/60' : 'bg-gray-50'}`}`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors
                      ${done ? 'bg-green-500 text-white shadow-sm' : appSettings.darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
                      {done
                        ? <CheckCircle size={14} strokeWidth={3}/>
                        : <span className={`text-[10px] font-bold ${theme.textMuted}`}>{idx + 1}</span>}
                    </div>
                    <span className={`text-[10px] font-bold leading-none
                      ${done ? 'text-green-400' : isToday ? 'text-[#FACC15]' : theme.textMuted}`}>
                      {day}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className={`text-[10px] mt-3 text-center ${theme.textMuted}`}>
              Tap to mark · Auto-updated when workout is saved
            </p>
          </div>

          {/* 루틴 달성률 */}
          <div className={`flex-1 rounded-[24px] lg:rounded-[32px] shadow-sm p-6 flex flex-col transition-colors ${theme.card}`}>
            <h2 className="font-heading text-base font-bold mb-4 flex items-center gap-2"><Calendar size={18} className="text-[#FACC15]"/> Routine Success</h2>
            <div className="flex-1 overflow-y-auto space-y-5 pr-1">
              <div>
                <div className="flex justify-between items-end mb-2">
                  <span className={`text-sm font-semibold ${theme.textMuted}`}>Today's Routine Rate</span>
                  <span className="text-sm font-bold">{routineCompletionRate}%</span>
                </div>
                <div className={`w-full h-3 rounded-full overflow-hidden ${appSettings.darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                  <div className={`h-full rounded-full transition-all duration-1000 ${routineCompletionRate >= 80 ? 'bg-[#FACC15]' : routineCompletionRate > 0 ? 'bg-yellow-400' : 'bg-gray-400'}`}
                    style={{ width: `${routineCompletionRate}%` }}/>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── 우측: 주간 타임테이블 ── */}
        <div className={`w-full lg:flex-[6.5] min-h-0 rounded-[24px] lg:rounded-[32px] shadow-sm p-5 lg:p-6 flex flex-col overflow-hidden transition-colors ${theme.card}`}>
          <div className="flex justify-between items-center mb-6">
            <h2 className="font-heading text-lg lg:text-xl font-bold flex items-center gap-2">
              <CalendarDays size={22} className="text-[#FACC15]"/> Weekly Timetable (24H)
            </h2>
            <button onClick={() => openWeeklyModal()} className="text-sm bg-[#1C1C1E] text-[#FACC15] px-4 py-2 rounded-xl font-bold flex items-center gap-1.5 shadow-md hover:scale-105 transition-transform">
              <Plus size={16} strokeWidth={3}/> Add
            </button>
          </div>
          <div className={`flex-1 flex flex-col relative border rounded-2xl overflow-hidden ${theme.border} ${appSettings.darkMode ? 'bg-[#3A3A3C]/30' : 'bg-gray-50/50'}`}>
            {/* 요일 헤더 */}
            <div className={`flex border-b h-10 shrink-0 ${theme.border} ${appSettings.darkMode ? 'bg-[#2C2C2E]' : 'bg-white'}`}>
              <div className={`w-12 lg:w-16 border-r ${theme.border}`}/>
              {DAYS_OF_WEEK.map(day => (
                <div key={day} className={`flex-1 flex items-center justify-center border-r last:border-r-0 ${theme.border}`}>
                  <span className={`text-[10px] lg:text-xs font-semibold ${theme.textMuted}`}>{day}</span>
                </div>
              ))}
            </div>
            <div className={`flex-1 flex overflow-y-auto relative ${appSettings.darkMode ? 'bg-[#18181A]/50' : 'bg-white'} pb-10`}>
              {/* 시간 라벨 */}
              <div className={`w-12 lg:w-16 flex flex-col border-r shrink-0 z-10 relative ${theme.border} ${appSettings.darkMode ? 'bg-[#2C2C2E]' : 'bg-white'}`}>
                {SCHEDULE_HOURS.map(h => (
                  <div key={h} className={`h-16 border-b flex items-start justify-center pt-1.5 ${theme.border}`}>
                    <span className={`text-[9px] lg:text-[10px] font-medium tabular-nums ${theme.textMuted}`}>{String(h).padStart(2,'0')}:00</span>
                  </div>
                ))}
              </div>
              {/* 그리드 + 블록 */}
              <div className="flex-1 relative min-h-[1536px]">
                {SCHEDULE_HOURS.map((_, i) => (
                  <div key={i} className={`absolute w-full h-16 border-b ${theme.border}`} style={{ top: `${i * 64}px` }}/>
                ))}
                <div className="absolute inset-0 flex">
                  {DAYS_OF_WEEK.map((_, i) => <div key={i} className={`flex-1 border-r border-dashed ${theme.border} last:border-r-0`}/>)}
                </div>
                {(weeklySchedules || []).map((block: WeeklySchedule) => {
                  const start = parseTime(block.start_time);
                  let dur = parseTime(block.end_time) - start;
                  if (dur < 0) dur += 24;
                  return (
                    <div key={block.id} onClick={() => openWeeklyModal(block)}
                      className="absolute p-0.5 lg:p-1 hover:scale-[1.02] cursor-pointer z-10 transition-transform"
                      style={{ top: `${start * 64}px`, height: `${dur * 64}px`, left: `${(block.day / 7) * 100}%`, width: `${100 / 7}%` }}>
                      <div className={`w-full h-full rounded-lg lg:rounded-xl p-1.5 lg:p-2 shadow-sm flex flex-col justify-center items-center text-center overflow-hidden text-white opacity-90 hover:opacity-100 transition-all ${block.color}`}>
                        <span className="text-[9px] lg:text-xs font-bold leading-tight line-clamp-2">{block.title}</span>
                        <span className="text-[10px] font-medium opacity-90 mt-1 hidden sm:block tabular-nums">{block.start_time} - {block.end_time}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 주간 일정 모달 ── */}
      {showWeeklyModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 backdrop-blur-sm" onClick={() => setShowWeeklyModal(false)}>
          <div className={`rounded-[32px] p-6 lg:p-8 w-full max-w-[400px] shadow-2xl ${theme.card}`} onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-heading text-xl lg:text-2xl font-bold">{editingWeeklyId ? 'Edit Activity' : 'New Activity'}</h3>
              <button onClick={() => setShowWeeklyModal(false)} className={`p-2 rounded-full ${theme.hoverBg}`}><X size={20}/></button>
            </div>
            <div className="space-y-5">
              <div>
                <label className={`block text-sm font-semibold mb-2 ${theme.textMuted}`}>Title</label>
                <input type="text" value={newWeeklySch.title} onChange={e => setNewWeeklySch({ ...newWeeklySch, title: e.target.value })}
                  className={`w-full rounded-2xl p-4 outline-none focus:ring-2 focus:ring-[#FACC15] text-base font-semibold ${theme.input}`} placeholder="e.g. Morning Workout"/>
              </div>
              <div>
                <label className={`block text-sm font-semibold mb-2 ${theme.textMuted}`}>Day of Week</label>
                <select value={newWeeklySch.day} onChange={e => setNewWeeklySch({ ...newWeeklySch, day: parseInt(e.target.value) })}
                  className={`w-full rounded-2xl p-4 outline-none focus:ring-2 focus:ring-[#FACC15] text-base font-semibold ${theme.input}`}>
                  {DAYS_OF_WEEK.map((d, i) => <option key={i} value={i}>{d}</option>)}
                </select>
              </div>
              <div className="flex gap-4">
                {(
                  [
                    { label: 'Start', field: 'start_time' as const },
                    { label: 'End',   field: 'end_time'   as const },
                  ] satisfies { label: string; field: keyof Pick<WeeklySchedule, 'start_time' | 'end_time'> }[]
                ).map(({ label, field }) => (
                  <div key={field} className="flex-1">
                    <label className={`block text-sm font-semibold mb-2 ${theme.textMuted}`}>{label}</label>
                    <input type="time" step="1800" value={newWeeklySch[field] ?? ''}
                      onChange={e => setNewWeeklySch({ ...newWeeklySch, [field]: e.target.value })}
                      className={`w-full rounded-2xl p-4 outline-none font-semibold text-base tabular-nums ${theme.input}`}/>
                  </div>
                ))}
              </div>
              <div>
                <label className={`block text-sm font-semibold mb-2 ${theme.textMuted}`}>Color Theme</label>
                <div className="grid grid-cols-3 gap-2">
                  {THEME_COLORS.map(c => (
                    <button key={c.id} onClick={() => setNewWeeklySch({ ...newWeeklySch, color: c.bg })}
                      className={`h-10 rounded-xl transition-all shadow-sm ${c.bg} ${newWeeklySch.color === c.bg ? 'ring-4 ring-offset-2 ring-gray-400 scale-105' : 'opacity-80 hover:opacity-100'}`}/>
                  ))}
                </div>
              </div>
              <div className="pt-2 flex gap-3">
                {editingWeeklyId && (
                  <button onClick={() => deleteWeeklySchedule(editingWeeklyId)} className="flex-1 bg-red-500/10 text-red-500 font-bold rounded-2xl p-4 hover:bg-red-500/20 transition-colors">Delete</button>
                )}
                <button onClick={saveWeeklySchedule} className={`bg-[#1C1C1E] text-[#FACC15] font-bold text-lg rounded-2xl p-4 transition-transform active:scale-[0.98] ${editingWeeklyId ? 'flex-[2]' : 'w-full'}`}>
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirm && <ConfirmModal message={confirm.message} onConfirm={handleConfirm} onCancel={clearConfirm} darkMode={appSettings.darkMode} confirmLabel={confirm.confirmLabel} variant={confirm.variant}/>}
    </div>
  );
};
