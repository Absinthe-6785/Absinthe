import type { PlannerMilestoneRow } from '../../calendar';
import { useTranslation } from '@/lib/i18n';

export interface DayMilestonesSectionProps {
  milestones: readonly PlannerMilestoneRow[];
  onEventNoteClick?: (noteId: string) => void;
}

/** Milestones / notes created on the selected day (month history panel). */
export function DayMilestonesSection({ milestones, onEventNoteClick }: DayMilestonesSectionProps) {
  const { t } = useTranslation();
  if (milestones.length === 0) return null;

  return (
    <section className="flex flex-col gap-1.5" data-planner-day-milestones>
      <h4 className="text-[10px] lg:text-xs font-bold uppercase tracking-wide text-muted">
        {t('k73NotesCreated')}
      </h4>
      <ul className="flex flex-col gap-1">
        {milestones.map(m => (
          <li key={m.noteId}>
            <button
              type="button"
              onClick={() => onEventNoteClick?.(m.noteId)}
              className="w-full text-left px-2 py-1 text-xs lg:text-sm font-semibold rounded-md border border-border hover:bg-surface-alt transition-colors"
              data-planner-day-milestone={m.noteId}
            >
              {m.label}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
