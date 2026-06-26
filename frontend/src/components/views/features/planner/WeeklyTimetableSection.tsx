import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, Plus, X } from 'lucide-react';
import { useConfirm } from '../../../../hooks/useConfirm';
import { useEscapeKey } from '../../../../hooks/useEscapeKey';
import { useApiMutation } from '../../../../hooks/useApiMutation';
import { useTranslation } from '../../../../lib/i18n';
import { useIsMobile } from '../../../../hooks/useIsMobile';
import type { AppSettings, Theme, ThemeColor, WeeklySchedule } from '../../../../types';
import { ConfirmModal } from '../../../common/ConfirmModal';
import { expandWeeklyScheduleDays, shouldFanOutWeeklyCreate } from '../../k98aTimetableMultiDay';
import { ProductEmptyState } from '../../../common/ProductEmptyState';
import { isDuplicatedWeeklyTitle } from '../../k101TimetableDuplicateDays';
import { WORKSPACE_CARD_RADIUS_CLASS } from '../../../common/workspaceCardSizes';

const WEEKDAY_KEYS = ['weekdayMon', 'weekdayTue', 'weekdayWed', 'weekdayThu', 'weekdayFri', 'weekdaySat', 'weekdaySun'] as const;

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
  /** Dedicated Timetable tab — always expanded, no collapse toggle (K-74). */
  standalone?: boolean;
  /** K-117 — embedded section inside unified Schedule workspace. */
  sectionEmbedded?: boolean;
}

export function WeeklyTimetableSection({
  weeklySchedules,
  theme,
  appSettings,
  THEME_COLORS,
  mutateStatic,
  showToast,
  standalone = false,
  sectionEmbedded = false,
}: WeeklyTimetableSectionProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
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
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([0]);

  useEscapeKey(() => {
    setShowWeeklyModal(false);
    clearConfirm();
  });

  const weekdays = WEEKDAY_KEYS.map(key => t(key));
  const hasActivities = weeklySchedules.length > 0;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const HOURS = Array.from({ length: 24 }, (_, i) => i);
  const ROW_H = 48;
  const now = useMemo(() => new Date(), []);
  const currentDay = (now.getDay() + 6) % 7;
  const currentTimeTop = (now.getHours() + now.getMinutes() / 60) * ROW_H;
  const inlineExpanded = standalone || sectionEmbedded;
  const [expanded, setExpanded] = useState(hasActivities || sectionEmbedded);
  const showCompactList = inlineExpanded && isMobile;
  const showGrid = inlineExpanded ? !isMobile : expanded;
  const showMobileList = showCompactList;

  const openWeeklyModal = (sch?: WeeklySchedule) => {
    setNewWeeklySch(sch ?? {
      day: 0,
      title: '',
      start_time: '09:00',
      end_time: '10:00',
      color: THEME_COLORS.find(c => c.id === 'blue')?.bg ?? THEME_COLORS[0].bg,
    });
    setSelectedWeekdays(sch ? [sch.day] : [0]);
    setEditingWeeklyId(sch?.id ?? null);
    setShowWeeklyModal(true);
  };

  const toggleWeekday = (day: number) => {
    if (editingWeeklyId) {
      setSelectedWeekdays([day]);
      setNewWeeklySch(prev => ({ ...prev, day }));
      return;
    }
    setSelectedWeekdays(prev => (
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort((a, b) => a - b)
    ));
  };

  const saveWeeklySchedule = async () => {
    if (!newWeeklySch.title) return showToast(t('enterTitleAct'), 'error');
    if (newWeeklySch.start_time && newWeeklySch.end_time && newWeeklySch.start_time >= newWeeklySch.end_time) {
      return showToast(t('plannerWeeklyEndAfterStart'), 'error');
    }
    if (!editingWeeklyId && selectedWeekdays.length === 0) {
      return showToast(t('plannerWeeklyEndAfterStart'), 'error');
    }

    if (editingWeeklyId) {
      const ok = await api(
        'PUT',
        `/api/weekly_schedules/${editingWeeklyId}`,
        { ...newWeeklySch, day: selectedWeekdays[0] ?? newWeeklySch.day },
        { revalidate: 'static', successMsg: t('scheduleSaved') },
      );
      if (ok) {
        setShowWeeklyModal(false);
        setExpanded(true);
      }
      return;
    }

    const payloads = shouldFanOutWeeklyCreate(editingWeeklyId, selectedWeekdays)
      ? expandWeeklyScheduleDays(newWeeklySch, selectedWeekdays)
      : [{ ...newWeeklySch, day: selectedWeekdays[0] ?? 0 }];

    let allOk = true;
    for (const payload of payloads) {
      const ok = await api('POST', '/api/weekly_schedules', payload, { revalidate: 'static' });
      if (!ok) allOk = false;
    }
    if (allOk) {
      showToast(t('scheduleSaved'));
      setShowWeeklyModal(false);
      setExpanded(true);
    }
  };

  const deleteWeeklySchedule = (id: string) =>
    showConfirm(t('plannerWeeklyDeleteConfirm'), async () => {
      const ok = await api('DELETE', `/api/weekly_schedules/${id}`, undefined, { revalidate: 'static', successMsg: t('deleted') });
      if (ok) {
        setShowWeeklyModal(false);
        setEditingWeeklyId(null);
      }
    },
      { confirmLabel: t('delete') },
    );

  useEffect(() => {
    if (!showGrid || !sectionEmbedded || !scrollRef.current) return;
    scrollRef.current.scrollTop = Math.max(0, currentTimeTop - ROW_H * 2);
  }, [currentTimeTop, sectionEmbedded, showGrid]);

  const mobileByDay = useMemo(() => {
    const groups = WEEKDAY_KEYS.map((_, day) => ({
      day,
      label: weekdays[day],
      blocks: (weeklySchedules || [])
        .filter(b => b.day === day)
        .sort((a, b) => a.start_time.localeCompare(b.start_time)),
    }));
    return groups.filter(g => g.blocks.length > 0);
  }, [weeklySchedules, weekdays]);

  return (
    <>
      <section
        className={`w-full shadow-sm flex flex-col overflow-hidden transition-colors ${theme.card}
          ${sectionEmbedded ? `${WORKSPACE_CARD_RADIUS_CLASS} p-3 lg:p-4 h-full min-h-0` : `${WORKSPACE_CARD_RADIUS_CLASS} p-5 lg:p-6`}
          ${showGrid || showMobileList ? (sectionEmbedded ? 'min-h-0' : 'min-h-[360px] lg:min-h-[480px]') : ''}`}
        data-planner-weekly-timetable
        data-planner-weekly-timetable-expanded={showGrid || showMobileList ? 'true' : 'false'}
        data-planner-weekly-timetable-standalone={standalone ? 'true' : 'false'}
        data-k117-timetable-embedded={sectionEmbedded ? 'true' : 'false'}
      >
        <div className={`flex justify-between items-center gap-3 ${sectionEmbedded ? 'mb-2' : 'mb-4'}`}>
          <div>
            <h2 className="font-heading text-base lg:text-lg font-bold flex items-center gap-2">
              <CalendarDays size={16} className="text-primary" strokeWidth={2.25}/>{t('weeklyTimetable')}
            </h2>
            {!standalone && !sectionEmbedded && !expanded && !hasActivities && (
              <p className={`text-xs mt-1 ${theme.textMuted}`}>{t('plannerWeeklyTimetableEmptyHint')}</p>
            )}
            {(standalone || sectionEmbedded) && (hasActivities || !sectionEmbedded) ? (
              <p className={`text-xs mt-0.5 ${theme.textMuted}`}>{t('k74TimetableHint')}</p>
            ) : null}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!standalone && !sectionEmbedded ? (
              <button
                type="button"
                onClick={() => setExpanded(v => !v)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${theme.input} ${theme.textMuted} hover:text-primary`}
                data-planner-weekly-timetable-toggle
                aria-expanded={expanded}
              >
                {expanded ? t('plannerWeeklyTimetableCollapse') : t('plannerWeeklyTimetableExpand')}
              </button>
            ) : null}
            {!sectionEmbedded ? (
            <button
              type="button"
              onClick={() => openWeeklyModal()}
              className="text-sm bg-primary text-primary-foreground px-4 py-2 rounded-xl font-bold flex items-center gap-1.5 shadow-md hover:scale-105 transition-transform"
              data-planner-weekly-timetable-add
            >
              <Plus size={16} strokeWidth={2.25}/> {hasActivities ? t('add') : t('plannerWeeklyTimetableAddFirst')}
            </button>
            ) : null}
          </div>
        </div>

        {!standalone && !sectionEmbedded && !expanded && !hasActivities && (
          <div className="py-3" data-k121-empty-state="planner-timetable-collapsed" data-planner-weekly-timetable-collapsed-empty="true">
            <ProductEmptyState
              variant="tailwind"
              theme={theme}
              icon={CalendarDays}
              title={t('k99EmptyPlannerTitle')}
              description={t('k99EmptyPlannerDesc')}
              dataHook="planner-timetable-empty"
              primaryAction={{ label: t('plannerWeeklyTimetableAddFirst'), onClick: () => openWeeklyModal() }}
            />
          </div>
        )}

        {showMobileList && (
          <div className={`${sectionEmbedded ? 'grid gap-2 lg:grid-cols-2 xl:grid-cols-3' : 'flex flex-col gap-5'}`} data-planner-weekly-timetable-mobile data-k134b-timetable-compact={sectionEmbedded ? 'true' : undefined}>
            {!hasActivities ? (
              <ProductEmptyState
                variant="tailwind"
                theme={theme}
                icon={CalendarDays}
                title={t('k99EmptyPlannerTitle')}
                description={t('k99EmptyPlannerDesc')}
                dataHook="planner-timetable-empty"
                primaryAction={{ label: t('plannerWeeklyTimetableAddFirst'), onClick: () => openWeeklyModal() }}
              />
            ) : (
              mobileByDay.map(({ day, label, blocks }) => (
                <div key={day} className={`${sectionEmbedded ? `rounded-xl border p-2.5 ${theme.border}` : 'pb-3 border-b border-border/40 last:border-b-0'}`} data-planner-weekly-day-group={day}>
                  <h3 className={`text-xs font-bold uppercase tracking-wide mb-2 ${theme.textMuted}`} data-planner-weekly-day-label>{label}</h3>
                  <ul className="flex flex-col gap-1.5">
                    {blocks.map(block => (
                      <li key={block.id}>
                        <button
                          type="button"
                          onClick={() => openWeeklyModal(block)}
                          className={`w-full text-left rounded-xl px-3 py-2 min-h-[40px] flex items-center justify-between gap-2 ${theme.input}`}
                          data-planner-weekly-mobile-block={block.id}
                        >
                          <span className="text-sm font-bold truncate">{block.title}</span>
                          <span className={`text-xs font-semibold tabular-nums shrink-0 ${theme.textMuted}`}>
                            {block.start_time}–{block.end_time}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </div>
        )}

        {showGrid && (
        <div className={`flex-1 flex flex-col relative border rounded-xl lg:rounded-2xl overflow-hidden ${sectionEmbedded ? 'min-h-0' : 'min-h-[360px]'} ${theme.border} ${appSettings.darkMode ? 'bg-surface-alt/30' : 'bg-gray-50/50'}`}>
          <div className={`flex border-b h-9 shrink-0 ${theme.border} ${appSettings.darkMode ? 'bg-surface' : 'bg-white'}`} data-planner-weekly-weekday-header>
            <div className={`w-10 lg:w-14 border-r shrink-0 ${theme.border}`}/>
            {weekdays.map((day, i) => (
              <div key={day} className={`flex-1 flex flex-col items-center justify-center border-r last:border-r-0 ${theme.border} ${i === currentDay ? 'bg-primary/10 text-primary' : i >= 5 ? 'bg-surface-alt/30' : ''}`} data-planner-weekly-weekday={i} data-planner-weekly-today={i === currentDay ? 'true' : undefined}>
                <span className={`text-[10px] lg:text-xs font-semibold ${i === currentDay ? 'text-primary' : theme.textMuted}`}>{day}</span>
              </div>
            ))}
          </div>
          <div ref={scrollRef} className={`flex-1 flex overflow-y-auto ${appSettings.darkMode ? 'bg-[#18181A]/50' : 'bg-white'}`} data-k139-timetable-scroll>
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
                {weekdays.map((_, i) => (
                  <div key={i} className={`flex-1 border-r border-dashed last:border-r-0 ${theme.border} ${i === currentDay ? 'bg-primary/5 opacity-100' : 'opacity-30'}`}/>
                ))}
              </div>
              <div
                className="absolute left-0 right-0 h-px bg-primary/70 z-10 pointer-events-none"
                style={{ top: `${currentTimeTop}px` }}
                data-k139-current-time-line
              />
              {(weeklySchedules || []).map((block: WeeklySchedule) => {
                const start = parseTime(block.start_time);
                let dur = parseTime(block.end_time) - start;
                if (dur < 0) dur += 24;
                const duplicated = isDuplicatedWeeklyTitle(block, weeklySchedules);
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
                    data-planner-weekly-block-duplicated={duplicated ? 'true' : undefined}
                    aria-label={block.title}
                  >
                    <div className={`w-full h-full rounded-lg p-1 shadow-sm flex flex-col justify-center items-center text-center overflow-hidden text-white opacity-90 hover:opacity-100 hover:scale-[1.02] transition-all k101-planner-chip ${block.color}${duplicated ? ' ring-2 ring-dashed ring-white/80 opacity-95' : ''}`}>
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
              {!hasActivities ? (
                <div
                  className={`absolute left-3 right-3 top-12 z-20 flex items-center justify-center gap-2 rounded-xl border border-dashed px-3 py-2 text-center ${theme.border} ${theme.textMuted} bg-surface/90`}
                  data-planner-weekly-timetable-empty="true"
                  data-k121-empty-state="planner-timetable"
                  data-k124c-timetable-empty-compact
                >
                  <CalendarDays size={18} strokeWidth={1.5} className="shrink-0 opacity-50" />
                  <p className="text-xs font-semibold">{t('plannerWeeklyTimetableEmptyHint')}</p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
        )}
      </section>

      {showWeeklyModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 backdrop-blur-sm" onClick={() => setShowWeeklyModal(false)}>
          <div className={`rounded-[32px] p-6 lg:p-8 w-full max-w-[400px] shadow-2xl ${theme.card}`} onClick={e => e.stopPropagation()} data-planner-weekly-timetable-modal>
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-heading text-xl lg:text-2xl font-bold">{editingWeeklyId ? t('plannerWeeklyEditActivity') : t('plannerWeeklyNewActivity')}</h3>
              <button type="button" onClick={() => setShowWeeklyModal(false)} className={`p-2 rounded-full ${theme.hoverBg}`}><X size={20}/></button>
            </div>
            <div className="space-y-5">
              <div>
                <label className={`block text-sm font-semibold mb-2 ${theme.textMuted}`}>{t('activityTitle')}</label>
                <input type="text" value={newWeeklySch.title} onChange={e => setNewWeeklySch({ ...newWeeklySch, title: e.target.value })}
                  className={`w-full rounded-2xl p-4 outline-none focus:ring-2 focus:ring-primary text-base font-semibold ${theme.input}`} placeholder={t('activityPh')}/>
              </div>
              <div>
                <label className={`block text-sm font-semibold mb-2 ${theme.textMuted}`}>{t('k98TimetableDays')}</label>
                {editingWeeklyId ? (
                  <select value={newWeeklySch.day} onChange={e => {
                    const day = parseInt(e.target.value);
                    setNewWeeklySch({ ...newWeeklySch, day });
                    setSelectedWeekdays([day]);
                  }}
                    className={`w-full rounded-2xl p-4 outline-none focus:ring-2 focus:ring-primary text-base font-semibold ${theme.input}`}>
                    {weekdays.map((d, i) => <option key={i} value={i}>{d}</option>)}
                  </select>
                ) : (
                  <>
                  <div className="flex flex-wrap gap-2 mb-2" data-k103-timetable-presets data-timetable-weekday-presets>
                    <button type="button" onClick={() => setSelectedWeekdays([0, 1, 2, 3, 4])}
                      className="px-2 py-1 rounded-lg text-xs font-bold bg-primary/10 text-primary">{t('k100TimetableWeekdays')}</button>
                    <button type="button" onClick={() => setSelectedWeekdays([5, 6])}
                      className="px-2 py-1 rounded-lg text-xs font-bold bg-primary/10 text-primary">{t('k100TimetableWeekends')}</button>
                    <button type="button" onClick={() => setSelectedWeekdays([0, 1, 2, 3, 4, 5, 6])}
                      className="px-2 py-1 rounded-lg text-xs font-bold bg-primary/10 text-primary">{t('k100TimetableEveryDay')}</button>
                  </div>
                  <div className="flex flex-wrap gap-2" data-planner-weekly-day-checkboxes>
                    {weekdays.map((label, day) => (
                      <label key={day} className={`flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer text-sm font-semibold ${theme.input}`}>
                        <input
                          type="checkbox"
                          checked={selectedWeekdays.includes(day)}
                          onChange={() => toggleWeekday(day)}
                        />
                        {label.slice(0, 3)}
                      </label>
                    ))}
                  </div>
                  </>
                )}
              </div>
              <div className="flex gap-4">
                {(
                  [
                    { label: t('plannerWeeklyStart'), field: 'start_time' as const },
                    { label: t('plannerWeeklyEnd'), field: 'end_time' as const },
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
                  {t('save')}
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
