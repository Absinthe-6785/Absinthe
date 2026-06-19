/**
 * K-121 — Calendar month cell schedule editing restoration audit.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export function auditScheduleEditingRestoration(): Record<string, boolean> {
  const cell = readFileSync(join(ROOT, 'components/views/features/planner/calendar-ui/month/MonthCalendarCell.tsx'), 'utf8');
  const grid = readFileSync(join(ROOT, 'components/views/features/planner/calendar-ui/month/MonthCalendarGrid.tsx'), 'utf8');
  const month = readFileSync(join(ROOT, 'components/views/features/planner/calendar-ui/month/MonthCalendarView.tsx'), 'utf8');
  const detail = readFileSync(join(ROOT, 'components/views/features/planner/calendar-ui/SelectedDayDetailPanel.tsx'), 'utf8');
  const agenda = readFileSync(join(ROOT, 'components/views/features/planner/calendar-ui/agenda/UnifiedAgendaList.tsx'), 'utf8');
  return {
    blockClickHook: cell.includes('data-k121-month-schedule-block'),
    clickHandler: cell.includes('onScheduleBlockClick'),
    keyboardAccessible: cell.includes('onKeyDown') && cell.includes('role={onScheduleBlockClick ? \'button\''),
    gridForwards: grid.includes('onScheduleBlockClick'),
    viewFromActions: month.includes('scheduleActions?.onView') && month.includes('onScheduleBlockClick={onScheduleBlockClick}'),
    detailForwardsActions: detail.includes('scheduleActions={scheduleActions}'),
    agendaCrud: agenda.includes('onEdit') && agenda.includes('onDelete') && agenda.includes('onDuplicate'),
  };
}

export function auditScheduleEditingRc(): boolean {
  const r = auditScheduleEditingRestoration();
  return Object.values(r).every(Boolean);
}
