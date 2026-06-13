import type { AppSettings, Theme } from '../../../../../types';
import type { ArchiveAreaPill } from '../../knowledge/archive';

export interface ArchiveAreaPillsProps {
  areaPills: readonly ArchiveAreaPill[];
  theme: Theme;
  appSettings: AppSettings;
  onAreaClick?: (pill: ArchiveAreaPill) => void;
}

export function ArchiveAreaPills({
  areaPills,
  theme,
  appSettings,
  onAreaClick,
}: ArchiveAreaPillsProps) {
  const isEmpty = areaPills.length === 0;
  const darkMode = appSettings.darkMode;

  return (
    <section
      className={`rounded-[24px] lg:rounded-[32px] shadow-sm p-5 lg:p-6 flex flex-col transition-colors ${theme.card}`}
      data-archive-area-pills
      data-archive-area-pills-empty={isEmpty ? 'true' : 'false'}
      aria-label="영역"
    >
      <h2 className="font-heading text-base font-bold mb-4">
        영역
      </h2>

      {isEmpty ? (
        <p className={`text-sm ${theme.textMuted}`} data-archive-area-pills-empty-message>
          기록된 영역이 없습니다.
        </p>
      ) : (
        <div
          className="flex flex-wrap gap-2"
          data-archive-area-pills-list
        >
          {areaPills.map(pill => (
            <button
              key={pill.areaNoteId}
              type="button"
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 border ${
                darkMode
                  ? 'border-white/10 bg-surface-alt hover:bg-white/5 text-white'
                  : 'border-border bg-surface-alt hover:bg-black/[0.03] text-gray-900'
              }`}
              data-archive-area-pill
              data-archive-area-id={pill.areaNoteId}
              data-archive-area-title={pill.title}
              data-archive-area-mark-count={pill.markCount}
              {...(pill.lastMarkDate ? { 'data-archive-area-last-mark-date': pill.lastMarkDate } : {})}
              aria-label={pill.title}
              onClick={() => onAreaClick?.(pill)}
            >
              <span className={`text-[10px] ${theme.textMuted}`} aria-hidden="true">○</span>
              <span data-archive-area-pill-label>{pill.title}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
