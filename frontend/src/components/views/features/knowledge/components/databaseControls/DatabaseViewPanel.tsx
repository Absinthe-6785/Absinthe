import { useCallback, useMemo, useState } from 'react';
import type { NoteBase } from '../../../noteUtils';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { KnowledgeIndexService } from '../../KnowledgeIndexService';
import {
  addDatabaseViewColumn,
  addDatabaseViewFilterCondition,
  addDatabaseViewFormulaColumn,
  addDatabaseViewRollupColumn,
  addDatabaseViewSortRule,
  moveDatabaseViewFilterCondition,
  moveDatabaseViewSortRule,
  removeDatabaseViewColumn,
  removeDatabaseViewFilterCondition,
  removeDatabaseViewFormulaColumn,
  removeDatabaseViewRollupColumn,
  removeDatabaseViewSortRule,
  setDatabaseViewColumnVisibility,
  setDatabaseViewDateProperty,
  setDatabaseViewFormulaColumnVisibility,
  setDatabaseViewGroupBy,
  setDatabaseViewPresentation,
  setDatabaseViewQuery,
  setDatabaseViewRollupColumnVisibility,
  setDatabaseViewSort,
  setDatabaseViewSortRules,
  setDatabaseViewTimelineEndProperty,
  setDatabaseViewTimelineStartProperty,
  setDatabaseViewGalleryCoverProperty,
  setDatabaseViewGalleryCardFields,
  updateDatabaseViewFilterCondition,
} from '../../databaseViews/databaseViewOperations';
import { getTableConfig } from '../../databaseViews/databasePresentationConfig';
import { prepareDatabaseViewPresentation } from '../../databaseViews/prepareDatabaseViewPresentation';
import { withDatabaseViewDefaults } from '../../databaseViews/prepareDatabaseViewRows';
import type { DatabaseView } from '../../databaseViews/databaseViewModels';
import {
  getVisualFilterConditions,
  visualFilterFromConditions,
  type FilterCondition,
  type VisualFilterModel,
} from '../../query/visualFilterModels';
import { DatabaseFilterControls } from '../DatabaseFilterControls';
import { DatabasePresentationRenderer } from './DatabasePresentationRenderer';
import { DatabaseViewControls } from './DatabaseViewControls';

export interface DatabaseViewPanelProps {
  colors: NoteChromeColors;
  view: DatabaseView;
  notes: readonly NoteBase[];
  service: KnowledgeIndexService;
  activeNoteId: string | null;
  onSelectNote: (noteId: string) => void;
  onViewChange: (updater: (view: DatabaseView) => DatabaseView) => void;
}

/** Unified database panel — controls + presentation renderer */
export function DatabaseViewPanel({
  colors: c,
  view,
  notes,
  service,
  activeNoteId,
  onSelectNote,
  onViewChange,
}: DatabaseViewPanelProps) {
  const [sessionFilter, setSessionFilter] = useState<VisualFilterModel | null>(null);
  const configured = useMemo(() => withDatabaseViewDefaults(view), [view]);
  const filterOptions = useMemo(
    () => ({ sessionFilter }),
    [sessionFilter],
  );
  const presentationData = useMemo(
    () => prepareDatabaseViewPresentation(view, notes, service, filterOptions),
    [view, notes, service, filterOptions],
  );
  const tableConfig = useMemo(() => getTableConfig(configured), [configured]);

  const patch = useCallback(
    (updater: (current: DatabaseView) => DatabaseView) => onViewChange(updater),
    [onViewChange],
  );

  const updateSessionConditions = useCallback((conditions: readonly FilterCondition[]) => {
    setSessionFilter(visualFilterFromConditions(conditions));
  }, []);

  return (
    <>
      <DatabaseViewControls
        colors={c}
        view={view}
        onPresentationChange={presentation => patch(v => setDatabaseViewPresentation(v, presentation))}
        onGroupByChange={groupBy => patch(v => setDatabaseViewGroupBy(v, groupBy))}
        onDatePropertyChange={dateProperty => patch(v => setDatabaseViewDateProperty(v, dateProperty))}
        onTimelineStartChange={startDateProperty => patch(v => setDatabaseViewTimelineStartProperty(v, startDateProperty))}
        onTimelineEndChange={endDateProperty => patch(v => setDatabaseViewTimelineEndProperty(v, endDateProperty))}
        onGalleryCoverChange={coverProperty => patch(v => setDatabaseViewGalleryCoverProperty(v, coverProperty))}
        onGalleryCardFieldsChange={cardFields => patch(v => setDatabaseViewGalleryCardFields(v, cardFields))}
        onAddColumn={key => patch(v => addDatabaseViewColumn(v, key))}
        onRemoveColumn={key => patch(v => removeDatabaseViewColumn(v, key))}
        onToggleColumnVisibility={(key, visible) => patch(v => setDatabaseViewColumnVisibility(v, key, visible))}
        onSortChange={sort => patch(v => setDatabaseViewSort(v, sort))}
        onSortRulesChange={sortRules => patch(v => setDatabaseViewSortRules(v, sortRules))}
        onAddSortRule={rule => patch(v => addDatabaseViewSortRule(v, rule))}
        onRemoveSortRule={index => patch(v => removeDatabaseViewSortRule(v, index))}
        onMoveSortRule={(fromIndex, toIndex) => patch(v => moveDatabaseViewSortRule(v, fromIndex, toIndex))}
        onAddRollupColumn={column => patch(v => addDatabaseViewRollupColumn(v, column))}
        onRemoveRollupColumn={key => patch(v => removeDatabaseViewRollupColumn(v, key))}
        onToggleRollupColumnVisibility={(key, visible) => patch(v => setDatabaseViewRollupColumnVisibility(v, key, visible))}
        onAddFormulaColumn={column => patch(v => addDatabaseViewFormulaColumn(v, column))}
        onRemoveFormulaColumn={key => patch(v => removeDatabaseViewFormulaColumn(v, key))}
        onToggleFormulaColumnVisibility={(key, visible) => patch(v => setDatabaseViewFormulaColumnVisibility(v, key, visible))}
      />
      <div style={{ padding: '0 8px 8px', borderBottom: `1px solid ${c.sideBdr}` }}>
        <DatabaseFilterControls
          colors={c}
          view={view}
          visualFilters={tableConfig.visualFilters}
          sessionFilter={sessionFilter}
          formulaColumns={tableConfig.formulaColumns}
          onQueryChange={query => patch(v => setDatabaseViewQuery(v, query))}
          onAddFilter={condition => patch(v => addDatabaseViewFilterCondition(v, condition))}
          onUpdateFilter={(index, condition) => patch(v => updateDatabaseViewFilterCondition(v, index, condition))}
          onRemoveFilter={index => patch(v => removeDatabaseViewFilterCondition(v, index))}
          onMoveFilter={(fromIndex, toIndex) => patch(v => moveDatabaseViewFilterCondition(v, fromIndex, toIndex))}
          onAddSessionFilter={condition => {
            updateSessionConditions([...getVisualFilterConditions(sessionFilter), condition]);
          }}
          onUpdateSessionFilter={(index, condition) => {
            const current = [...getVisualFilterConditions(sessionFilter)];
            if (index < 0 || index >= current.length) return;
            current[index] = condition;
            updateSessionConditions(current);
          }}
          onRemoveSessionFilter={index => {
            updateSessionConditions(
              getVisualFilterConditions(sessionFilter).filter((_, i) => i !== index),
            );
          }}
          onMoveSessionFilter={(fromIndex, toIndex) => {
            const current = [...getVisualFilterConditions(sessionFilter)];
            if (
              fromIndex < 0
              || fromIndex >= current.length
              || toIndex < 0
              || toIndex >= current.length
            ) {
              return;
            }
            const [item] = current.splice(fromIndex, 1);
            current.splice(toIndex, 0, item);
            updateSessionConditions(current);
          }}
          onClearSessionFilters={() => setSessionFilter(null)}
        />
      </div>
      <DatabasePresentationRenderer
        colors={c}
        view={view}
        presentationData={presentationData}
        service={service}
        activeNoteId={activeNoteId}
        onSelectNote={onSelectNote}
      />
    </>
  );
}
