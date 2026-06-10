import type { NoteChromeColors } from '../../../noteEditorTheme';
import { resolveAllColumnKeys } from '../../databaseViews/databaseViewConfig';
import {
  getBoardConfig,
  getCalendarConfig,
  getGalleryConfig,
  getTableConfig,
  getTimelineConfig,
} from '../../databaseViews/databasePresentationConfig';
import type {
  DatabaseView,
  DatabaseViewPresentation,
  DatabaseViewSort,
} from '../../databaseViews/databaseViewModels';
import type { DatabaseViewSortRule } from '../../databaseViews/databasePresentationModels';
import { withDatabaseViewDefaults } from '../../databaseViews/prepareDatabaseViewRows';
import type { FormulaInput } from '../../formulas/formulaModels';
import type { RollupFunctionPhase1 } from '../../rollups/rollupModels';
import { BoardViewControls } from './BoardViewControls';
import { CalendarViewControls } from './CalendarViewControls';
import { GalleryViewControls } from './GalleryViewControls';
import { SharedDatabaseControls } from './SharedDatabaseControls';
import { TableViewControls } from './TableViewControls';
import { TimelineViewControls } from './TimelineViewControls';
import { databaseControlsContainerStyle } from './controlStyles';

export interface DatabaseViewControlsProps {
  colors: NoteChromeColors;
  view: DatabaseView;
  onPresentationChange: (presentation: DatabaseViewPresentation) => void;
  onGroupByChange: (groupBy: string) => void;
  onDatePropertyChange: (dateProperty: string) => void;
  onTimelineStartChange: (startDateProperty: string) => void;
  onTimelineEndChange: (endDateProperty: string) => void;
  onGalleryCoverChange: (coverProperty: string) => void;
  onGalleryCardFieldsChange: (cardFields: readonly string[]) => void;
  onAddColumn: (key: string) => void;
  onRemoveColumn: (key: string) => void;
  onToggleColumnVisibility: (key: string, visible: boolean) => void;
  onSortChange: (sort: DatabaseViewSort) => void;
  onSortRulesChange: (sortRules: readonly DatabaseViewSortRule[]) => void;
  onAddSortRule: (rule: DatabaseViewSortRule) => void;
  onRemoveSortRule: (index: number) => void;
  onMoveSortRule: (fromIndex: number, toIndex: number) => void;
  onAddRollupColumn: (column: {
    key: string;
    visible: boolean;
    rollup: {
      relationKey: string;
      direction: 'incoming';
      function: RollupFunctionPhase1;
      targetField?: string;
    };
  }) => void;
  onRemoveRollupColumn: (key: string) => void;
  onToggleRollupColumnVisibility: (key: string, visible: boolean) => void;
  onAddFormulaColumn: (column: {
    key: string;
    visible: boolean;
    formula: {
      id: string;
      expression: string;
      inputs: Record<string, FormulaInput>;
    };
    label?: string;
  }) => void;
  onRemoveFormulaColumn: (key: string) => void;
  onToggleFormulaColumnVisibility: (key: string, visible: boolean) => void;
}

/** Routes presentation-specific database controls behind a shared shell */
export function DatabaseViewControls({
  colors: c,
  view,
  onPresentationChange,
  onGroupByChange,
  onDatePropertyChange,
  onTimelineStartChange,
  onTimelineEndChange,
  onGalleryCoverChange,
  onGalleryCardFieldsChange,
  onAddColumn,
  onRemoveColumn,
  onToggleColumnVisibility,
  onSortChange: _onSortChange,
  onSortRulesChange,
  onAddSortRule,
  onRemoveSortRule,
  onMoveSortRule,
  onAddRollupColumn,
  onRemoveRollupColumn,
  onToggleRollupColumnVisibility,
  onAddFormulaColumn,
  onRemoveFormulaColumn,
  onToggleFormulaColumnVisibility,
}: DatabaseViewControlsProps) {
  const configured = withDatabaseViewDefaults(view);
  const tableConfig = getTableConfig(configured);
  const boardConfig = getBoardConfig(configured);
  const calendarConfig = getCalendarConfig(configured);
  const timelineConfig = getTimelineConfig(configured);
  const galleryConfig = getGalleryConfig(configured);
  const columnKeys = resolveAllColumnKeys(tableConfig.columns);

  return (
    <div style={databaseControlsContainerStyle(c)}>
      <SharedDatabaseControls
        colors={c}
        presentation={configured.presentation}
        onPresentationChange={onPresentationChange}
      />

      {configured.presentation === 'board' ? (
        <BoardViewControls
          colors={c}
          boardConfig={boardConfig}
          onGroupByChange={onGroupByChange}
        />
      ) : configured.presentation === 'calendar' ? (
        <CalendarViewControls
          calendarConfig={calendarConfig}
          onDatePropertyChange={onDatePropertyChange}
        />
      ) : configured.presentation === 'timeline' ? (
        <TimelineViewControls
          timelineConfig={timelineConfig}
          onTimelineStartChange={onTimelineStartChange}
          onTimelineEndChange={onTimelineEndChange}
        />
      ) : configured.presentation === 'gallery' ? (
        <GalleryViewControls
          colors={c}
          galleryConfig={galleryConfig}
          columnKeys={columnKeys}
          onGalleryCoverChange={onGalleryCoverChange}
          onGalleryCardFieldsChange={onGalleryCardFieldsChange}
        />
      ) : (
        <TableViewControls
          colors={c}
          tableConfig={tableConfig}
          onAddColumn={onAddColumn}
          onRemoveColumn={onRemoveColumn}
          onToggleColumnVisibility={onToggleColumnVisibility}
          onSortChange={_onSortChange}
          onSortRulesChange={onSortRulesChange}
          onAddSortRule={onAddSortRule}
          onRemoveSortRule={onRemoveSortRule}
          onMoveSortRule={onMoveSortRule}
          onAddRollupColumn={onAddRollupColumn}
          onRemoveRollupColumn={onRemoveRollupColumn}
          onToggleRollupColumnVisibility={onToggleRollupColumnVisibility}
          onAddFormulaColumn={onAddFormulaColumn}
          onRemoveFormulaColumn={onRemoveFormulaColumn}
          onToggleFormulaColumnVisibility={onToggleFormulaColumnVisibility}
        />
      )}
    </div>
  );
}
