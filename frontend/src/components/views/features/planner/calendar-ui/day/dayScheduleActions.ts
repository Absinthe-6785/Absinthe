/** Schedule CRUD callbacks wired from PlannerView (same flows as Timeline). */
export interface DayScheduleActions {
  onAdd?: () => void;
  onEdit?: (scheduleId: string) => void;
  onDelete?: (scheduleId: string) => void;
}

export function dayScheduleActionsEnabled(actions?: DayScheduleActions): boolean {
  return Boolean(actions?.onAdd ?? actions?.onEdit ?? actions?.onDelete);
}
