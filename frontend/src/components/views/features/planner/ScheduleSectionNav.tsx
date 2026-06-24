import {
  CalendarDays,
  CalendarRange,
  Clock,
  Sun,
} from 'lucide-react';
import { useTranslation } from '../../../../lib/i18n';
import type { Theme } from '../../../../types';
import { WorkspaceSectionNav } from '../../../common/WorkspaceSectionNav';

export type ScheduleSectionId = 'today' | 'calendar' | 'timetable' | 'routine';

export const SCHEDULE_SECTIONS: readonly {
  id: ScheduleSectionId;
  icon: typeof Sun;
}[] = [
  { id: 'today', icon: Sun },
  { id: 'routine', icon: Clock },
  { id: 'timetable', icon: CalendarDays },
  { id: 'calendar', icon: CalendarRange },
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
      case 'timetable': return t('k74TimetableTab');
      case 'routine': return t('k117ScheduleSectionRoutine');
    }
  };

  return (
    <WorkspaceSectionNav
      mode="anchor"
      variant="tailwind"
      theme={theme}
      compact={compact}
      onSelect={id => (onNavigate ?? scrollToScheduleSection)(id as ScheduleSectionId)}
      ariaLabel={t('k117ScheduleSectionNav')}
      dataHook="schedule-section"
      legacyHook="data-k117-schedule-section-nav"
      items={SCHEDULE_SECTIONS.map(({ id, icon }) => ({ id, icon, label: labelFor(id) }))}
    />
  );
}
