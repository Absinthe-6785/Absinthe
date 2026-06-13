import { useState } from 'react';
import { CalendarDays, Plus, X } from 'lucide-react';
import { useConfirm } from '../../../../hooks/useConfirm';
import { useEscapeKey } from '../../../../hooks/useEscapeKey';
import { useApiMutation } from '../../../../hooks/useApiMutation';
import { useTranslation } from '../../../../lib/i18n';
import type { AppSettings, Theme, ThemeColor, WeeklySchedule } from '../../../../types';
import { ConfirmModal } from '../../../common/ConfirmModal';

const DAYS_OF_WEEK = ['월', '화', '수', '목', '금', '토', '일'] as const;

const parseTime = (timeStr: string): number => {
  const [h, m] = timeStr.split(':');
  return parseInt(h || '0') + parseInt(m || '0') / 60;
};

export interface WeeklyTimetableSectionProps {
  weeklySchedules: WeeklySchedule[];
  theme: Theme;
  appSettings: AppSettings;
  THEME_COLORS: ThemeColor[];
  mutateStatic: () => void;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

export function WeeklyTimetableSection({
  weeklySchedules,
  theme,
  appSettings,
  THEME_COLORS,
  mutateStatic,
  showToast,
}: WeeklyTimetableSectionProps) {
  const { t } = useTranslation();
  const { mutate: api } = useApiMutation(null, mutateStatic, showToast);
  const { confirm, showConfirm, clearConfirm, handleConfirm } = useConfirm();

  const [showWeeklyModal, setShowWeeklyModal] = useState(false);
  const [editingWeeklyId, setEditingWeeklyId] = useState<string | null>(null);
  const [newWeeklySch, setNewWeeklySch] = useState<Partial<WeeklySchedule>>({
    day: 0,
    title: '',
    start_time: '09:00',
    end_time: '10:00',
    color: THEME_COLORS.find(c => c.id === 'blue')?.bg ?? THEME_COLORS[0].bg,
  });

  useEscapeKey(() => {
    setShowWeeklyModal(false);
    clearConfirm();
  });

  const openWeeklyModal = (sch?: WeeklySchedule) => {
    setNewWeeklySch(sch ?? {
      day: 0,
      title: '',
      start_time: '09:00',
      end_time: '10:00',
      color: THEME_COLORS.find(c => c.id === 'blue')?.bg ?? THEME_COLORS[0].bg,
    });
    setEditingWeeklyId(sch?.id ?? null);
    setShowWeeklyModal(true);
  };

  const saveWeeklySchedule = async () => {
    if (!newWeeklySch.title) return showToast(t('enterTitleAct'), 'error');
    if (newWeeklySch.start_time && newWeeklySch.end_time && newWeeklySch.start_time >= newWeeklySch.end_time) {
      return showToast('종료 시간은 시작 시간보다 늦어야 합니다.', 'error');
    }
    const ok = await api(
      editingWeeklyId ? 'PUT' : 'POST',
      editingWeeklyId ? `/api/weekly_schedules/${editingWeeklyId}` : '/api/weekly_schedules',
      { ...newWeeklySch },
      { revalidate: 'static', successMsg: t('scheduleSaved') },
    );
    if (ok) setShowWeeklyModal(false);
  };

  const deleteWeeklySchedule = (id: string) =>
    showConfirm('이 활동을 삭제할까요?', () =>
      api('DELETE', `/api/weekly_schedules/${id}`, undefined, { revalidate: 'static', successMsg: t('deleted') }),
      { confirmLabel: t('delete') },
    );

  const HOURS = Array.from({ length: 24 }, (_, i) => i);
  const ROW_H = 48;
  const [expanded, setExpanded] = useState(weeklySchedules.length > 0);

  return (
    <>
      <section
        className={`w-full rounded-[24px] lg:rounded-[32px] shadow-sm p-5 lg:p-6 flex flex-col overflow-hidden transition-colors ${theme.card} ${expanded ? 'min-h-[420px] lg:min-h-[480px]' : ''}`}
        data-planner-weekly-timetable
        data-planner-weekly-timetable-expanded={expanded ? 'true' : 'false'}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="font-heading text-base lg:text-lg font-bold flex items-center gap-2">
            <CalendarDays size={16} className="text-primary" strokeWidth={2.25}/>{t('weeklyTimetable')}
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setExpanded(v => !v)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${theme.input} ${theme.textMuted} hover:text-primary`}
              data-planner-weekly-timetable-toggle
              aria-expanded={expanded}
            >
              {expanded ? t('plannerWeeklyTimetableCollapse') : t('plannerWeeklyTimetableExpand')}
            </button>
            {expanded && (
            <button
              type="button"
              onClick={() => openWeeklyModal()}
              className="text-sm bg-primary text-primary-foreground px-4 py-2 rounded-xl font-bold flex items-center gap-1.5 shadow-md hover:scale-105 transition-transform"
              data-planner-weekly-timetable-add
            >
              <Plus size={16} strokeWidth={3}/> 추가
            </button>
            )}
          </div>
        </div>
        {expanded && (
        <div className={`flex-1 flex flex-col relative border rounded-2xl overflow-hidden min-h-[360px] ${theme.border} ${appSettings.darkMode ? 'bg-surface-alt/30' : 'bg-gray-50/50'}`}>
          <div className={`flex border-b h-9 shrink-0 ${theme.border} ${appSettings.darkMode ? 'bg-surface' : 'bg-white'}`}>
            <div className={`w-10 lg:w-14 border-r shrink-0 ${theme.border}`}/>
            {DAYS_OF_WEEK.map(day => (
              <div key={day} className={`flex-1 flex items-center justify-center border-r last:border-r-0 ${theme.border}`}>
                <span className={`text-[10px] lg:text-xs font-semibold ${theme.textMuted}`}>{day}</span>
              </div>
            ))}
          </div>
          <div className={`flex-1 flex overflow-y-auto ${appSettings.darkMode ? 'bg-[#18181A]/50' : 'bg-white'}`}>
            <div className={`w-10 lg:w-14 shrink-0 border-r relative z-10 ${theme.border} ${appSettings.darkMode ? 'bg-surface' : 'bg-white'}`}>
              {HOURS.map(h => (
                <div key={h} className={`border-b flex items-start justify-center pt-1 ${theme.border}`} style={{ height: `${ROW_H}px` }}>
                  <span className={`text-[9px] lg:text-[10px] font-medium tabular-nums ${theme.textMuted}`}>{String(h).padStart(2, '0')}:00</span>
                </div>
              ))}
            </div>
            <div className="flex-1 relative" style={{ minHeight: `${24 * ROW_H}px` }}>
              {HOURS.map(h => (
                <div
                  key={h}
                  className={`absolute w-full border-b ${theme.border} ${h % 6 === 0 ? 'opacity-50' : 'opacity-20'}`}
                  style={{ top: `${h * ROW_H}px`, height: `${ROW_H}px` }}
                />
              ))}
              <div className="absolute inset-0 flex pointer-events-none">
                {DAYS_OF_WEEK.map((_, i) => (
                  <div key={i} className={`flex-1 border-r border-dashed opacity-30 last:border-r-0 ${theme.border}`}/>
                ))}
              </div>
              {(weeklySchedules || []).map((block: WeeklySchedule) => {
                const start = parseTime(block.start_time);
                let dur = parseTime(block.end_time) - start;
                if (dur < 0) dur += 24;
                return (
                  <button
                    key={block.id}
                    type="button"
                    onClick={() => openWeeklyModal(block)}
                    className="absolute px-0.5 py-0.5 cursor-pointer z-10"
                    style={{
                      top: `${start * ROW_H}px`,
                      height: `${Math.max(dur * ROW_H, ROW_H * 0.5)}px`,
                      left: `${(block.day / 7) * 100}%`,
                      width: `${100 / 7}%`,
                    }}
                    data-planner-weekly-block={block.id}
                    aria-label={block.title}
                  >
                    <div className={`w-full h-full rounded-lg p-1 shadow-sm flex flex-col justify-center items-center text-center overflow-hidden text-white opacity-90 hover:opacity-100 hover:scale-[1.02] transition-all ${block.color}`}>
                      <span className="text-[9px] lg:text-[10px] font-bold leading-tight line-clamp-2">{block.title}</span>
                      {dur >= 0.75 && (
                        <span className="text-[8px] lg:text-[9px] opacity-80 mt-0.5 tabular-nums hidden sm:block">
                          {block.start_time}–{block.end_time}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        )}
      </section>

      {showWeeklyModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 backdrop-blur-sm" onClick={() => setShowWeeklyModal(false)}>
          <div className={`rounded-[32px] p-6 lg:p-8 w-full max-w-[400px] shadow-2xl ${theme.card}`} onClick={e => e.stopPropagation()} data-planner-weekly-timetable-modal>
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-heading text-xl lg:text-2xl font-bold">{editingWeeklyId ? '활동 수정' : '새 활동'}</h3>
              <button type="button" onClick={() => setShowWeeklyModal(false)} className={`p-2 rounded-full ${theme.hoverBg}`}><X size={20}/></button>
            </div>
            <div className="space-y-5">
              <div>
                <label className={`block text-sm font-semibold mb-2 ${theme.textMuted}`}>{t('activityTitle')}</label>
                <input type="text" value={newWeeklySch.title} onChange={e => setNewWeeklySch({ ...newWeeklySch, title: e.target.value })}
                  className={`w-full rounded-2xl p-4 outline-none focus:ring-2 focus:ring-primary text-base font-semibold ${theme.input}`} placeholder={t('activityPh')}/>
              </div>
              <div>
                <label className={`block text-sm font-semibold mb-2 ${theme.textMuted}`}>{t('dayOfWeek')}</label>
                <select value={newWeeklySch.day} onChange={e => setNewWeeklySch({ ...newWeeklySch, day: parseInt(e.target.value) })}
                  className={`w-full rounded-2xl p-4 outline-none focus:ring-2 focus:ring-primary text-base font-semibold ${theme.input}`}>
                  {DAYS_OF_WEEK.map((d, i) => <option key={i} value={i}>{d}</option>)}
                </select>
              </div>
              <div className="flex gap-4">
                {(
                  [
                    { label: '시작', field: 'start_time' as const },
                    { label: '종료', field: 'end_time' as const },
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
                <label className={`block text-sm font-semibold mb-2 ${theme.textMuted}`}>{t('colorTheme')}</label>
                <div className="grid grid-cols-3 gap-2">
                  {THEME_COLORS.map(c => (
                    <button key={c.id} type="button" onClick={() => setNewWeeklySch({ ...newWeeklySch, color: c.bg })}
                      className={`h-10 rounded-xl transition-all shadow-sm ${c.bg} ${newWeeklySch.color === c.bg ? 'ring-4 ring-offset-2 ring-gray-400 scale-105' : 'opacity-80 hover:opacity-100'}`}/>
                  ))}
                </div>
              </div>
              <div className="pt-2 flex gap-3">
                {editingWeeklyId && (
                  <button type="button" onClick={() => deleteWeeklySchedule(editingWeeklyId)} className="flex-1 bg-red-500/10 text-red-500 font-bold rounded-2xl p-4 hover:bg-red-500/20 transition-colors">{t('delete')}</button>
                )}
                <button type="button" onClick={saveWeeklySchedule} className={`bg-primary text-primary-foreground font-bold text-lg rounded-2xl p-4 transition-transform active:scale-[0.98] ${editingWeeklyId ? 'flex-[2]' : 'w-full'}`}>
                  저장
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirm && (
        <ConfirmModal
          message={confirm.message}
          onConfirm={handleConfirm}
          onCancel={clearConfirm}
          darkMode={appSettings.darkMode}
          confirmLabel={confirm.confirmLabel}
          variant={confirm.variant}
        />
      )}
    </>
  );
}
