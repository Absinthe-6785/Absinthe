import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { DatabaseViewPresentation } from '../../databaseViews/databaseViewModels';
import { DatabasePresentationSwitcher } from '../DatabasePresentationSwitcher';

export interface SharedDatabaseControlsProps {
  colors: NoteChromeColors;
  presentation: DatabaseViewPresentation;
  onPresentationChange: (presentation: DatabaseViewPresentation) => void;
}

export function SharedDatabaseControls({
  colors: c,
  presentation,
  onPresentationChange,
}: SharedDatabaseControlsProps) {
  return (
    <DatabasePresentationSwitcher
      value={presentation}
      onChange={onPresentationChange}
      style={{ color: c.textMuted }}
    />
  );
}
