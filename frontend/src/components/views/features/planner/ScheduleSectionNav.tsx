import {
  CalendarDays,
  CalendarRange,
  Clock,
  ListTodo,
  Sun,
} from 'lucide-react';
import { useTranslation } from '../../../../lib/i18n';
import type { Theme } from '../../../../types';

export type ScheduleSectionId = 'today' | 'calendar' | 'upcoming' | 'timetable' | 'routine';

export const SCHEDULE_SECTIONS: readonly {
  id: ScheduleSectionId;
  icon: typeof Sun;
}[] = [
  { id: 'today', icon: Sun },
  { id: 'calendar', icon: CalendarRange },
  { id: 'upcoming', icon: ListTodo },
  { id: 'timetable', icon: CalendarDays },
  { id: 'routine', icon: Clock },
];

export function scrollToScheduleSection(id: ScheduleSectionId): void {
  document
    .querySelector(`[data-k117-schedule-section="${id}"]`)
    ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export interface ScheduleSectionNavProps {
  theme: Theme;
  compact?: boolean;
  onNavigate?: (id: ScheduleSectionId) => void;
}

/** K-117 — in-page section anchors for unified Schedule workspace. */
export function ScheduleSectionNav({ theme, compact, onNavigate }: ScheduleSectionNavProps) {
  const { t } = useTranslation();

  const labelFor = (id: ScheduleSectionId): string => {
    switch (id) {
      case 'today': return t('plannerToday');
      case 'calendar': return t('k117ScheduleSectionCalendar');
      case 'upcoming': return t('k80UpcomingAgenda');
      case 'timetable': return t('k74TimetableTab');
      case 'routine': return t('k117ScheduleSectionRoutine');
    }
  };

  return (
    <nav
      aria-label={t('k117ScheduleSectionNav')}
      className={`flex gap-1 shrink-0 overflow-x-auto pb-0.5 ${compact ? '' : ''}`}
      data-k117-schedule-section-nav
    >
      {SCHEDULE_SECTIONS.map(({ id, icon: Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => (onNavigate ?? scrollToScheduleSection)(id)}
          data-k117-schedule-section-link={id}
          className={`flex items-center gap-1 rounded-lg font-bold transition-colors whitespace-nowrap shrink-0
            ${compact ? 'min-h-[36px] px-2 py-1.5 text-[10px]' : 'min-h-[32px] px-2.5 py-1.5 text-[11px]'}
            ${theme.input} ${theme.textMuted} hover:text-foreground hover:bg-muted/50`}
        >
          <Icon size={compact ? 12 : 13} strokeWidth={2.25} className="shrink-0" />
          <span className="truncate">{labelFor(id)}</span>
        </button>
      ))}
    </nav>
  );
}
