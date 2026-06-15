/** Schedule CRUD callbacks wired from PlannerView (same flows as Timeline). */
export interface DayScheduleActions {
  onAdd?: () => void;
  onEdit?: (scheduleId: string) => void;
  onDelete?: (scheduleId: string) => void;
  onDuplicate?: (scheduleId: string) => void;
}

/** Note-backed event / countdown actions from schedule surfaces. */
export interface AgendaEventActions {
  onEdit?: (noteId: string) => void;
  onDelete?: (noteId: string) => void;
  onDuplicate?: (noteId: string) => void;
  onOpen?: (noteId: string) => void;
}

export function dayScheduleActionsEnabled(actions?: DayScheduleActions): boolean {
  return Boolean(actions?.onAdd ?? actions?.onEdit ?? actions?.onDelete ?? actions?.onDuplicate);
}
