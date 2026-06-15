import { CalendarDays, CalendarRange } from 'lucide-react';
import { useTranslation } from '../../../../lib/i18n';
import type { Theme } from '../../../../types';

export type ScheduleWorkspaceSection = 'schedule' | 'timetable';

export const SCHEDULE_WORKSPACE_SECTIONS: readonly {
  id: ScheduleWorkspaceSection;
  icon: typeof CalendarRange;
}[] = [
  { id: 'schedule', icon: CalendarRange },
  { id: 'timetable', icon: CalendarDays },
];

export interface ScheduleWorkspaceNavProps {
  active: ScheduleWorkspaceSection;
  onChange: (section: ScheduleWorkspaceSection) => void;
  theme: Theme;
  compact?: boolean;
}

/** Top-level Schedule workspace — calendar events vs weekly timetable (K-74). */
export function ScheduleWorkspaceNav({ active, onChange, theme, compact }: ScheduleWorkspaceNavProps) {
  const { t } = useTranslation();

  return (
    <nav
      aria-label={t('scheduleWorkspaceNav')}
      className={`flex gap-1.5 shrink-0 mb-3 ${compact ? 'overflow-x-auto pb-1' : ''}`}
      data-schedule-workspace-nav
    >
      {SCHEDULE_WORKSPACE_SECTIONS.map(({ id, icon: Icon }) => {
        const selected = active === id;
        const labelKey = id === 'schedule' ? 'k74ScheduleTab' : 'k74TimetableTab';
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            aria-current={selected ? 'page' : undefined}
            data-schedule-workspace-section={id}
            className={`flex items-center gap-1.5 rounded-xl font-bold transition-colors whitespace-nowrap
              ${compact ? 'flex-1 min-w-0 min-h-[44px] px-2 py-2.5 text-[10px] justify-center' : 'px-3 py-2 text-xs'}
              ${selected
                ? 'bg-primary text-primary-foreground shadow-sm'
                : `${theme.input} ${theme.textMuted} hover:text-foreground`}`}
          >
            <Icon size={compact ? 14 : 15} strokeWidth={2.25} className="shrink-0" />
            <span className="truncate">{t(labelKey)}</span>
          </button>
        );
      })}
    </nav>
  );
}
