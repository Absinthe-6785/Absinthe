import type { Theme } from '../../../../../types';
import type { PlannerCalendarViewMode } from '../calendar';
import { PLANNER_CALENDAR_MODES } from './calendarShellModels';

const MODE_LABELS: Record<PlannerCalendarViewMode, string> = {
  month: '월',
  week: '주',
  day: '일',
  agenda: '아젠다',
};

export interface CalendarModeSwitcherProps {
  activeMode: PlannerCalendarViewMode;
  onModeChange: (mode: PlannerCalendarViewMode) => void;
  theme: Theme;
}

export function CalendarModeSwitcher({
  activeMode,
  onModeChange,
  theme,
}: CalendarModeSwitcherProps) {
  return (
    <div
      className={`flex gap-1.5 shrink-0 p-1 rounded-2xl ${theme.card}`}
      data-planner-calendar-mode-switcher
      role="tablist"
      aria-label="Calendar mode"
    >
      {PLANNER_CALENDAR_MODES.map(mode => (
        <button
          key={mode}
          type="button"
          role="tab"
          aria-selected={activeMode === mode}
          data-planner-calendar-mode-option={mode}
          onClick={() => onModeChange(mode)}
          className={`flex-1 py-2.5 px-3 min-h-[44px] rounded-xl text-[11px] lg:text-xs font-bold transition-colors
            ${activeMode === mode
              ? 'bg-primary text-primary-foreground'
              : `${theme.input} ${theme.textMuted}`}`}
        >
          {MODE_LABELS[mode]}
        </button>
      ))}
    </div>
  );
}
