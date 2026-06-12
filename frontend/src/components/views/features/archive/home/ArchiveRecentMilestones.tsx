import type { AppSettings, Theme } from '../../../../../types';
import type { ArchiveMilestoneEntry } from '../../knowledge/archive';

export interface ArchiveRecentMilestonesProps {
  milestones: readonly ArchiveMilestoneEntry[];
  theme: Theme;
  appSettings: AppSettings;
  onMilestoneClick?: (entry: ArchiveMilestoneEntry) => void;
}

export function ArchiveRecentMilestones({
  milestones,
  theme,
  appSettings,
  onMilestoneClick,
}: ArchiveRecentMilestonesProps) {
  const isEmpty = milestones.length === 0;

  return (
    <section
      className={`rounded-[24px] lg:rounded-[32px] shadow-sm p-5 lg:p-6 flex flex-col transition-colors ${theme.card}`}
      data-archive-recent-milestones
      data-archive-recent-milestones-empty={isEmpty ? 'true' : 'false'}
      aria-label="Recent milestones"
    >
      <h2 className="font-heading text-base font-bold mb-4">
        Recent transitions
      </h2>

      {isEmpty ? (
        <p className={`text-sm ${theme.textMuted}`} data-archive-recent-milestones-empty-message>
          No milestones recorded yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-2" data-archive-recent-milestones-list>
          {milestones.map(entry => (
            <li key={`${entry.noteId}:${entry.date}`}>
              <button
                type="button"
                className={`w-full text-left rounded-2xl px-3 py-2.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${
                  appSettings.darkMode ? 'hover:bg-white/5' : 'hover:bg-black/[0.03]'
                }`}
                data-archive-milestone-date={entry.date}
                data-archive-milestone-note-id={entry.noteId}
                data-archive-milestone-label={entry.displayLabel}
                {...(entry.kind ? { 'data-archive-milestone-kind': entry.kind } : {})}
                aria-label={`${entry.date} · ${entry.displayLabel}`}
                onClick={() => onMilestoneClick?.(entry)}
              >
                <span
                  className={`block text-[11px] font-semibold tabular-nums ${theme.textMuted}`}
                  data-archive-milestone-date-label
                >
                  {entry.date}
                </span>
                <span
                  className={`block text-sm font-semibold mt-0.5 ${
                    appSettings.darkMode ? 'text-white' : 'text-gray-900'
                  }`}
                  data-archive-milestone-display-label
                >
                  {entry.displayLabel}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
