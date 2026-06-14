/** Task toggle/add/edit callbacks wired from PlannerView. */
export interface DayTodoActions {
  onToggle?: (todoId: string, currentDone: boolean) => void;
  onEdit?: (todoId: string, text: string) => void;
  onAdd?: (text: string) => void;
}

export function dayTodoActionsEnabled(actions?: DayTodoActions): boolean {
  return Boolean(actions?.onToggle ?? actions?.onEdit ?? actions?.onAdd);
}
