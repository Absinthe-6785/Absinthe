import { memo } from 'react';
import { WorkoutMonthCalendar, type WorkoutMonthCalendarProps } from './WorkoutMonthCalendar';

/** K-125C — immediate-mount workout calendar (extracted from supporting panels). */
export const HealthCalendarPanel = memo(function HealthCalendarPanel(props: WorkoutMonthCalendarProps) {
  return (
    <div className="hidden lg:block shrink-0" data-k125c-health-immediate="calendar" data-k107-health-calendar-panel>
      <WorkoutMonthCalendar {...props} />
    </div>
  );
});
