import type { Todo, Theme } from '../../../../../types';
import { formatDayTodoSummary } from './dayCalendarPresentation';

export interface DayTodoSummaryProps {
  todos: readonly Todo[];
  theme: Theme;
}

export function DayTodoSummary({ todos, theme }: DayTodoSummaryProps) {
  const summaryLabel = formatDayTodoSummary(todos);
  if (!summaryLabel) return null;

  return (
    <section className="flex flex-col gap-2" data-planner-day-todos>
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs lg:text-sm font-bold uppercase tracking-wide text-muted">
          Todos
        </h4>
        <span className={`text-[10px] lg:text-xs font-semibold ${theme.textMuted}`}>
          {summaryLabel}
        </span>
      </div>

      <ul className="flex flex-col gap-1">
        {todos.map(todo => (
          <li
            key={todo.id}
            className={`px-2 py-1.5 text-xs lg:text-sm rounded-md border ${theme.border}
              ${todo.done ? 'opacity-60 line-through' : 'font-medium'}`}
            data-planner-day-todo={todo.id}
            data-planner-day-todo-done={todo.done ? 'true' : 'false'}
          >
            {todo.text}
          </li>
        ))}
      </ul>
    </section>
  );
}
