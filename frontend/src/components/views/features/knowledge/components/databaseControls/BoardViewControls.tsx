import type { NoteChromeColors } from '../../../noteEditorTheme';
import { BOARD_GROUP_BY_FIELD } from '../../databaseViews/databasePresentationMeta';
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
  return (
    <DatabasePropertyKeyField
      preset={BOARD_GROUP_BY_FIELD}
      value={boardConfig.groupBy}
      onChange={onGroupByChange}
      listId="database-board-groupby-suggestions"
    />
  );
}
