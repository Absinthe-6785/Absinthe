import type { Todo, Theme } from '../../../../../types';
import { useTranslation } from '../../../../../../lib/i18n';
import { formatDayTodoSummary } from './dayCalendarPresentation';

export interface DayTodoSummaryProps {
  todos: readonly Todo[];
  theme: Theme;
}

export function DayTodoSummary({ todos, theme }: DayTodoSummaryProps) {
  const { t } = useTranslation();
  const summaryLabel = formatDayTodoSummary(todos);

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
            <li
              key={todo.id}
              className={`px-2 py-1 text-xs lg:text-sm rounded-md border ${theme.border}
                ${todo.done ? 'opacity-60 line-through' : 'font-medium'}`}
              data-planner-day-todo={todo.id}
              data-planner-day-todo-done={todo.done ? 'true' : 'false'}
            >
              {todo.text}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
