import {
  CalendarDays,
  CalendarRange,
  Clock,
  ListTodo,
  Sun,
} from 'lucide-react';
import { useLayoutEffect, useState } from 'react';
import { useTranslation } from '../../../../lib/i18n';
import type { Theme } from '../../../../types';

export type ScheduleSectionId = 'today' | 'calendar' | 'upcoming' | 'timetable' | 'routine';

export const SCHEDULE_SECTIONS: readonly {
  id: ScheduleSectionId;
  icon: typeof Sun;
}[] = [
  { id: 'routine', icon: Clock },
  { id: 'today', icon: Sun },
  { id: 'timetable', icon: CalendarDays },
  { id: 'calendar', icon: CalendarRange },
  { id: 'upcoming', icon: ListTodo },
];

export function scrollToScheduleSection(id: ScheduleSectionId): void {
  const el = document.querySelector(`[data-k117-schedule-section="${id}"]`);
  if (el instanceof HTMLElement && el.classList.contains('hidden')) return;
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function useDomHiddenScheduleSections(): ScheduleSectionId[] {
  const [hidden, setHidden] = useState<ScheduleSectionId[]>([]);
  useLayoutEffect(() => {
    const sync = () => {
      setHidden(
        SCHEDULE_SECTIONS
          .filter(({ id }) => document.querySelector(`[data-k117-schedule-section="${id}"]`)?.classList.contains('hidden'))
          .map(({ id }) => id),
      );
    };
    sync();
    const frame = requestAnimationFrame(sync);
    return () => cancelAnimationFrame(frame);
  });
  return hidden;
}

export interface ScheduleSectionNavProps {
  theme: Theme;
  compact?: boolean;
  onNavigate?: (id: ScheduleSectionId) => void;
  /** K-125B — omit section anchors when empty (e.g. upcoming). */
  hiddenSections?: readonly ScheduleSectionId[];
}

/** K-117 — in-page section anchors for unified Schedule workspace. */
export function ScheduleSectionNav({ theme, compact, onNavigate, hiddenSections }: ScheduleSectionNavProps) {
  const { t } = useTranslation();
  const domHidden = useDomHiddenScheduleSections();
  const resolvedHidden = hiddenSections ?? domHidden;

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
      data-k125b-schedule-section-nav
    >
      {SCHEDULE_SECTIONS.filter(({ id }) => !resolvedHidden.includes(id)).map(({ id, icon: Icon }) => (
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
