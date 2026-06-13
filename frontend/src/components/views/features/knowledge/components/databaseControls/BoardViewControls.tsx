import { useTranslation } from '../../../../../../lib/i18n';
import type { NoteChromeColors } from '../../../../noteEditorTheme';
import { getDatabasePropertyFieldPreset } from '../../databaseViews/databasePresentationMeta';
import type { DatabaseBoardConfig } from '../../databaseViews/databasePresentationModels';
import { DatabasePropertyKeyField } from '../DatabasePropertyKeyField';

export interface BoardViewControlsProps {
  colors: NoteChromeColors;
  boardConfig: DatabaseBoardConfig;
  onGroupByChange: (groupBy: string) => void;
}

export function BoardViewControls({
  boardConfig,
  onGroupByChange,
}: BoardViewControlsProps) {
  const { lang } = useTranslation();
  return (
    <DatabasePropertyKeyField
      preset={getDatabasePropertyFieldPreset('boardGroupBy', lang)}
      value={boardConfig.groupBy}
      onChange={onGroupByChange}
      listId="database-board-groupby-suggestions"
    />
  );
}
