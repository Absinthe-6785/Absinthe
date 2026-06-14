import { useState } from 'react';
import { Plus } from 'lucide-react';
import type { Todo, Theme } from '../../../../../../types';
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
  const [newText, setNewText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const doneCount = todos.filter(todo => todo.done).length;
  const progressPct = todos.length > 0 ? Math.round((doneCount / todos.length) * 100) : 0;

  const submitAdd = () => {
    const text = newText.trim();
    if (!text || !todoActions?.onAdd) return;
    todoActions.onAdd(text);
    setNewText('');
  };

  const submitEdit = (id: string) => {
    const text = editText.trim();
    if (!text || !todoActions?.onEdit) return setEditingId(null);
    todoActions.onEdit(id, text);
    setEditingId(null);
  };

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

      {todos.length > 0 ? (
        <div className="h-1 rounded-full bg-surface-alt overflow-hidden" data-planner-day-todo-progress>
          <div className="h-full bg-primary transition-all" style={{ width: `${progressPct}%` }} />
        </div>
      ) : null}

      {todos.length === 0 && !todoActions?.onAdd ? (
        <p className="text-[10px] lg:text-xs text-muted px-1">{t('scheduleSectionEmpty')}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {todos.map(todo => (
            <li key={todo.id}>
              {editingId === todo.id ? (
                <input
                  autoFocus
                  value={editText}
                  onChange={e => setEditText(e.target.value)}
                  onBlur={() => submitEdit(todo.id)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); submitEdit(todo.id); }
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  className={`w-full px-2 py-1 text-xs lg:text-sm rounded-md border ${theme.border} bg-surface outline-none focus-visible:ring-2 focus-visible:ring-primary`}
                  data-planner-day-todo-edit={todo.id}
                />
              ) : interactive && todoActions?.onToggle ? (
                <button
                  type="button"
                  onClick={() => todoActions.onToggle!(todo.id, todo.done)}
                  onDoubleClick={todoActions.onEdit ? () => {
                    setEditingId(todo.id);
                    setEditText(todo.text);
                  } : undefined}
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
                >
                  {todo.text}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {todoActions?.onAdd ? (
        <div className="flex items-center gap-1.5 mt-0.5">
          <Plus size={12} className={`shrink-0 ${theme.textMuted}`} />
          <input
            type="text"
            value={newText}
            onChange={e => setNewText(e.target.value)}
            placeholder={t('addTask')}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submitAdd(); } }}
            className={`flex-1 bg-transparent outline-none text-[10px] lg:text-xs font-medium border-b ${theme.border} py-0.5`}
            data-planner-day-todo-add
          />
        </div>
      ) : null}
    </section>
  );
}
