import type { Todo, Theme } from '../../../../../types';
import { useTranslation } from '../../../../../../lib/i18n';
import { formatDayTodoSummary } from './dayCalendarPresentation';
import type { DayTodoActions } from './dayTodoActions';
import { dayTodoActionsEnabled } from './dayTodoActions';

export interface DayTodoSummaryProps {
  todos: readonly Todo[];
  theme: Theme;
  todoActions?: DayTodoActions;
}

export function DayTodoSummary({ todos, theme, todoActions }: DayTodoSummaryProps) {
  const { t } = useTranslation();
  const summaryLabel = formatDayTodoSummary(todos);
  const interactive = dayTodoActionsEnabled(todoActions);

  return (
    <section className="flex flex-col gap-1.5" data-planner-day-todos>
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-[10px] lg:text-xs font-bold uppercase tracking-wide text-muted">
          {t('scheduleSectionTodos')}
        </h4>
        {summaryLabel ? (
          <span className={`text-[10px] lg:text-xs font-semibold ${theme.textMuted}`}>
            {summaryLabel}
          </span>
        ) : null}
      </div>

      {todos.length === 0 ? (
        <p className="text-[10px] lg:text-xs text-muted px-1">{t('scheduleSectionEmpty')}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {todos.map(todo => (
            <li key={todo.id}>
              {interactive && todoActions?.onToggle ? (
                <button
                  type="button"
                  onClick={() => todoActions.onToggle!(todo.id, todo.done)}
                  className={`w-full text-left px-2 py-1 text-xs lg:text-sm rounded-md border ${theme.border}
                    flex items-center gap-2 min-h-[32px]
                    ${todo.done ? 'opacity-60 line-through' : 'font-medium'}
                    hover:bg-surface-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary`}
                  data-planner-day-todo={todo.id}
                  data-planner-day-todo-done={todo.done ? 'true' : 'false'}
                >
                  <input
                    type="checkbox"
                    checked={todo.done}
                    readOnly
                    tabIndex={-1}
                    className="w-4 h-4 accent-primary pointer-events-none shrink-0"
                  />
                  <span className="truncate">{todo.text}</span>
                </button>
              ) : (
                <div
                  className={`px-2 py-1 text-xs lg:text-sm rounded-md border ${theme.border}
                    ${todo.done ? 'opacity-60 line-through' : 'font-medium'}`}
                  data-planner-day-todo={todo.id}
                  data-planner-day-todo-done={todo.done ? 'true' : 'false'}
                >
                  {todo.text}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
