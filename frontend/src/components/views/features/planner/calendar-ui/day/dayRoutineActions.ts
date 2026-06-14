/** Routine toggle/add/edit callbacks wired from PlannerView. */
export interface DayRoutineActions {
  onToggle?: (routineId: string, currentDone: boolean) => void;
  onEdit?: (routineId: string, text: string) => void;
  onAdd?: (text: string) => void;
}

export function dayRoutineActionsEnabled(actions?: DayRoutineActions): boolean {
  return Boolean(actions?.onToggle ?? actions?.onEdit ?? actions?.onAdd);
}
