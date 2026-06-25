import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { Routine, Theme } from '@/types';
import { useTranslation } from '@/lib/i18n';
import { formatDayRoutineSummary } from './dayCalendarPresentation';
import type { DayRoutineActions } from './dayRoutineActions';
import { dayRoutineActionsEnabled } from './dayRoutineActions';

export interface DayRoutineSummaryProps {
  routines: readonly Routine[];
  isRoutineException: boolean;
  theme: Theme;
  routineActions?: DayRoutineActions;
  /** De-emphasize routine block when schedules are empty (day view hierarchy). */
  compactEmpty?: boolean;
}

export function DayRoutineSummary({
  routines,
  isRoutineException,
  theme,
  routineActions,
  compactEmpty = false,
}: DayRoutineSummaryProps) {
  const { t } = useTranslation();
  const summaryLabel = formatDayRoutineSummary(routines);
  const interactive = dayRoutineActionsEnabled(routineActions);
  const [newText, setNewText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const doneCount = routines.filter(r => r.done).length;
  const progressPct = routines.length > 0 ? Math.round((doneCount / routines.length) * 100) : 0;

  const submitAdd = () => {
    const text = newText.trim();
    if (!text || !routineActions?.onAdd) return;
    routineActions.onAdd(text);
    setNewText('');
  };

  const submitEdit = (id: string) => {
    const text = editText.trim();
    if (!text || !routineActions?.onEdit) return setEditingId(null);
    routineActions.onEdit(id, text);
    setEditingId(null);
  };

  return (
    <section
      className={`flex flex-col gap-1.5 ${compactEmpty && routines.length === 0 ? 'opacity-80' : ''}`}
      data-planner-day-routines
    >
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-[10px] lg:text-xs font-bold uppercase tracking-wide text-muted">
          {t('scheduleSectionRoutines')}
        </h4>
        {summaryLabel ? (
          <span className={`text-[10px] lg:text-xs font-semibold ${theme.textMuted}`}>
            {summaryLabel}
          </span>
        ) : null}
      </div>

      {routines.length > 0 ? (
        <div className="h-1 rounded-full bg-surface-alt overflow-hidden" data-planner-day-routine-progress>
          <div className="h-full bg-green-500 transition-all" style={{ width: `${progressPct}%` }} />
        </div>
      ) : null}

      {isRoutineException ? (
        <p className={`text-[10px] lg:text-xs ${theme.textMuted}`} data-planner-day-routine-exception>
          {t('scheduleRoutineException')}
        </p>
      ) : null}

      {routines.length === 0 && !routineActions?.onAdd ? (
        <p className="text-[10px] lg:text-xs text-muted px-1">{t('scheduleSectionEmpty')}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {routines.map(routine => (
            <li key={routine.id}>
              {editingId === routine.id ? (
                <input
                  autoFocus
                  value={editText}
                  onChange={e => setEditText(e.target.value)}
                  onBlur={() => submitEdit(routine.id)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); submitEdit(routine.id); }
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  className={`w-full px-2 py-1 text-xs lg:text-sm rounded-md border ${theme.border} bg-surface outline-none focus-visible:ring-2 focus-visible:ring-primary`}
                  data-planner-day-routine-edit={routine.id}
                />
              ) : interactive && routineActions?.onToggle ? (
                <div className={`flex items-center gap-1 rounded-md border ${theme.border} hover:bg-surface-alt`}>
                  <button
                    type="button"
                    onClick={() => routineActions.onToggle!(routine.id, routine.done)}
                    onDoubleClick={routineActions.onEdit ? () => {
                      setEditingId(routine.id);
                      setEditText(routine.text);
                    } : undefined}
                    className={`flex-1 min-w-0 text-left px-2 py-2.5 text-xs lg:text-sm
                      flex items-center gap-2 min-h-[44px]
                      ${routine.done ? 'opacity-60 line-through' : 'font-medium'}
                      focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary`}
                    data-planner-day-routine={routine.id}
                    data-planner-day-routine-done={routine.done ? 'true' : 'false'}
                  >
                    <input
                      type="checkbox"
                      checked={routine.done}
                      readOnly
                      tabIndex={-1}
                      className="w-4 h-4 accent-primary pointer-events-none shrink-0"
                    />
                    <span className="truncate flex-1 min-w-0">{routine.text}</span>
                  </button>
                  {routineActions.onDelete ? (
                    <button
                      type="button"
                      onClick={() => routineActions.onDelete!(routine.id)}
                      className="mr-1 p-1.5 min-h-[32px] min-w-[32px] rounded-full text-muted hover:text-red-500 hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary flex items-center justify-center"
                      data-planner-day-routine-delete={routine.id}
                      aria-label={t('delete')}
                    >
                      <Trash2 size={13} />
                    </button>
                  ) : null}
                </div>
              ) : (
                <div
                  className={`px-2 py-1 text-xs lg:text-sm rounded-md border ${theme.border}
                    ${routine.done ? 'opacity-60 line-through' : 'font-medium'}`}
                  data-planner-day-routine={routine.id}
                >
                  {routine.text}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {routineActions?.onAdd ? (
        <div className="flex items-center gap-1.5 mt-0.5">
          <Plus size={12} className={`shrink-0 ${theme.textMuted}`} />
          <input
            type="text"
            value={newText}
            onChange={e => setNewText(e.target.value)}
            placeholder={t('addRoutine')}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submitAdd(); } }}
            className={`flex-1 bg-transparent outline-none text-[10px] lg:text-xs font-medium border-b ${theme.border} py-0.5`}
            data-planner-day-routine-add
          />
        </div>
      ) : null}
    </section>
  );
}
