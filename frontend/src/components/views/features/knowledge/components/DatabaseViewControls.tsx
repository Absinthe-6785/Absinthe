import { useCallback, useMemo, useState } from 'react';
import type { NoteBase } from '../../../noteUtils';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { KnowledgeIndexService } from '../KnowledgeIndexService';
import {
  columnLabelForKey,
  resolveAllColumnKeys,
  resolveVisibleColumns,
} from '../databaseViews/databaseViewConfig';
import {
  BOARD_GROUP_BY_FIELD,
  CALENDAR_DATE_PROPERTY_FIELD,
  TABLE_ADD_COLUMN_FIELD,
} from '../databaseViews/databasePresentationMeta';
import {
  getBoardConfig,
  getCalendarConfig,
  getTableConfig,
} from '../databaseViews/databasePresentationConfig';
import type {
  DatabaseView,
  DatabaseViewPresentation,
  DatabaseViewSort,
} from '../databaseViews/databaseViewModels';
import { isBuiltinColumnKey } from '../databaseViews/databaseViewModels';
import {
  addDatabaseViewColumn,
  removeDatabaseViewColumn,
  setDatabaseViewColumnVisibility,
  setDatabaseViewDateProperty,
  setDatabaseViewGroupBy,
  setDatabaseViewPresentation,
  setDatabaseViewSort,
} from '../databaseViews/databaseViewOperations';
import { prepareDatabaseViewPresentation } from '../databaseViews/prepareDatabaseViewPresentation';
import { withDatabaseViewDefaults } from '../databaseViews/prepareDatabaseViewRows';
import { DatabaseBoardView } from './DatabaseBoardView';
import { DatabaseCalendarView } from './DatabaseCalendarView';
import { DatabasePresentationSwitcher } from './DatabasePresentationSwitcher';
import { DatabasePropertyKeyField } from './DatabasePropertyKeyField';
import { DatabaseTableView } from './DatabaseTableView';

export interface DatabaseViewControlsProps {
  colors: NoteChromeColors;
  view: DatabaseView;
  onPresentationChange: (presentation: DatabaseViewPresentation) => void;
  onGroupByChange: (groupBy: string) => void;
  onDatePropertyChange: (dateProperty: string) => void;
  onAddColumn: (key: string) => void;
  onRemoveColumn: (key: string) => void;
  onToggleColumnVisibility: (key: string, visible: boolean) => void;
  onSortChange: (sort: DatabaseViewSort) => void;
}

export function DatabaseViewControls({
  colors: c,
  view,
  onPresentationChange,
  onGroupByChange,
  onDatePropertyChange,
  onAddColumn,
  onRemoveColumn,
  onToggleColumnVisibility,
  onSortChange,
}: DatabaseViewControlsProps) {
  const [newColumnKey, setNewColumnKey] = useState('');
  const configured = withDatabaseViewDefaults(view);
  const tableConfig = getTableConfig(configured);
  const boardConfig = getBoardConfig(configured);
  const calendarConfig = getCalendarConfig(configured);
  const columnKeys = resolveAllColumnKeys(tableConfig.columns);
  const visibility = new Map(
    tableConfig.columns.map(entry => [entry.key.toLowerCase(), entry.visible]),
  );

  const submitAddColumn = () => {
    const trimmed = newColumnKey.trim();
    if (!trimmed) return;
    onAddColumn(trimmed);
    setNewColumnKey('');
  };

  return (
    <div style={{
      padding: '6px 8px',
      borderBottom: `1px solid ${c.sideBdr}`,
      background: c.toolbar,
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      fontSize: 10,
      color: c.textMuted,
    }}>
      <DatabasePresentationSwitcher
        value={configured.presentation}
        onChange={onPresentationChange}
        style={{ color: c.textMuted }}
      />

      {configured.presentation === 'board' ? (
        <DatabasePropertyKeyField
          preset={BOARD_GROUP_BY_FIELD}
          value={boardConfig.groupBy}
          onChange={onGroupByChange}
          listId="database-board-groupby-suggestions"
        />
      ) : configured.presentation === 'calendar' ? (
        <DatabasePropertyKeyField
          preset={CALENDAR_DATE_PROPERTY_FIELD}
          value={calendarConfig.dateProperty}
          onChange={onDatePropertyChange}
          listId="database-calendar-date-suggestions"
        />
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700 }}>Sort</span>
            <select
              className="bwi"
              style={{ fontSize: 10, padding: '2px 4px' }}
              value={tableConfig.sort.key}
              onChange={e => onSortChange({
                key: e.target.value,
                direction: tableConfig.sort.direction,
              })}
            >
              {columnKeys.map(key => (
                <option key={key} value={key}>{columnLabelForKey(key)}</option>
              ))}
            </select>
            <select
              className="bwi"
              style={{ fontSize: 10, padding: '2px 4px' }}
              value={tableConfig.sort.direction}
              onChange={e => onSortChange({
                key: tableConfig.sort.key,
                direction: e.target.value as 'asc' | 'desc',
              })}
            >
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontWeight: 700 }}>Columns</span>
            {columnKeys.map(key => {
              const visible = visibility.get(key.toLowerCase()) !== false;
              return (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ flex: 1, color: visible ? c.text : c.textMuted }}>{columnLabelForKey(key)}</span>
                  <button
                    type="button"
                    className="btbtn"
                    style={{ padding: '1px 4px', fontSize: 9 }}
                    onClick={() => onToggleColumnVisibility(key, !visible)}
                  >
                    {visible ? 'Hide' : 'Show'}
                  </button>
                  {!isBuiltinColumnKey(key) && (
                    <button
                      type="button"
                      className="btbtn"
                      style={{ padding: '1px 4px', fontSize: 9, color: c.danger }}
                      onClick={() => onRemoveColumn(key)}
                    >
                      Remove
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: 4 }}>
            <input
              className="bwi"
              style={{ flex: 1, fontSize: 10 }}
              placeholder={TABLE_ADD_COLUMN_FIELD.placeholder}
              value={newColumnKey}
              list="database-table-column-suggestions"
              onChange={e => setNewColumnKey(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') submitAddColumn();
              }}
            />
            <datalist id="database-table-column-suggestions">
              {columnKeys.map(key => (
                <option key={key} value={key} />
              ))}
            </datalist>
            <button className="bwbg" style={{ padding: '2px 6px', fontSize: 10 }} onClick={submitAddColumn}>
              Add
            </button>
          </div>
        </>
      )}
    </div>
  );
}

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
  const configured = useMemo(() => withDatabaseViewDefaults(view), [view]);
  const presentationData = useMemo(
    () => prepareDatabaseViewPresentation(view, notes, service),
    [view, notes, service],
  );
  const tableConfig = useMemo(() => getTableConfig(configured), [configured]);
  const boardConfig = useMemo(() => getBoardConfig(configured), [configured]);
  const visibleColumns = useMemo(
    () => resolveVisibleColumns(tableConfig.columns),
    [tableConfig.columns],
  );

  const patch = useCallback(
    (updater: (current: DatabaseView) => DatabaseView) => onViewChange(updater),
    [onViewChange],
  );

  return (
    <>
      <DatabaseViewControls
        colors={c}
        view={view}
        onPresentationChange={presentation => patch(v => setDatabaseViewPresentation(v, presentation))}
        onGroupByChange={groupBy => patch(v => setDatabaseViewGroupBy(v, groupBy))}
        onDatePropertyChange={dateProperty => patch(v => setDatabaseViewDateProperty(v, dateProperty))}
        onAddColumn={key => patch(v => addDatabaseViewColumn(v, key))}
        onRemoveColumn={key => patch(v => removeDatabaseViewColumn(v, key))}
        onToggleColumnVisibility={(key, visible) => patch(v => setDatabaseViewColumnVisibility(v, key, visible))}
        onSortChange={sort => patch(v => setDatabaseViewSort(v, sort))}
      />
      {presentationData.type === 'board' ? (
        <DatabaseBoardView
          colors={c}
          lanes={presentationData.lanes}
          service={service}
          activeNoteId={activeNoteId}
          cardFields={boardConfig.cardFields}
          onSelectNote={onSelectNote}
        />
      ) : presentationData.type === 'calendar' ? (
        <DatabaseCalendarView
          colors={c}
          buckets={presentationData.buckets}
          service={service}
          activeNoteId={activeNoteId}
          onSelectNote={onSelectNote}
        />
      ) : (
        <DatabaseTableView
          colors={c}
          notes={presentationData.notes}
          columns={visibleColumns}
          sort={tableConfig.sort}
          service={service}
          activeNoteId={activeNoteId}
          onSelectNote={onSelectNote}
        />
      )}
    </>
  );
}
