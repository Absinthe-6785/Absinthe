import type { Theme } from '../../../../types';
import { archiveViewModeLabel, type ArchiveViewMode } from './archiveNavigationModels';

export interface ArchivePlaceholderViewProps {
  mode: Exclude<ArchiveViewMode, 'home'>;
  theme: Theme;
}

export function ArchivePlaceholderView({ mode, theme }: ArchivePlaceholderViewProps) {
  return (
    <div
      className="flex flex-col gap-3 px-2 lg:px-4 py-2"
      data-archive-placeholder={mode}
    >
      <h2 className="font-heading text-xl font-bold">
        {archiveViewModeLabel(mode)}
      </h2>
      <p className={`text-sm ${theme.textMuted}`}>
        {archiveViewModeLabel(mode)} view is not available yet.
      </p>
    </div>
  );
}
