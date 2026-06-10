import { useCallback, useMemo, useState } from 'react';
import type { NoteBase } from '../../../noteUtils';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { KnowledgeIndexService } from '../KnowledgeIndexService';
import {
  columnLabelForKey,
  resolveAllColumnKeys,
  resolveVisibleColumns,
  resolveVisibleFormulaColumns,
  resolveVisibleRollupColumns,
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
  addDatabaseViewFormulaColumn,
  addDatabaseViewRollupColumn,
  removeDatabaseViewColumn,
  removeDatabaseViewFormulaColumn,
  removeDatabaseViewRollupColumn,
  setDatabaseViewColumnVisibility,
  setDatabaseViewDateProperty,
  setDatabaseViewFormulaColumnVisibility,
  setDatabaseViewGroupBy,
  setDatabaseViewPresentation,
  setDatabaseViewRollupColumnVisibility,
  setDatabaseViewSort,
} from '../databaseViews/databaseViewOperations';
import { prepareDatabaseViewPresentation } from '../databaseViews/prepareDatabaseViewPresentation';
import { withDatabaseViewDefaults } from '../databaseViews/prepareDatabaseViewRows';
import { DatabaseBoardView } from './DatabaseBoardView';
import { DatabaseCalendarView } from './DatabaseCalendarView';
import { DatabasePresentationSwitcher } from './DatabasePresentationSwitcher';
import { DatabasePropertyKeyField } from './DatabasePropertyKeyField';
import { DatabaseTableView } from './DatabaseTableView';
import { formulaColumnLabel, type FormulaInput } from '../formulas/formulaModels';
import { ROLLUP_FUNCTIONS_PHASE1, rollupColumnLabel, type RollupFunctionPhase1 } from '../rollups/rollupModels';

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
  onAddRollupColumn,
  onRemoveRollupColumn,
  onToggleRollupColumnVisibility,
  onAddFormulaColumn,
  onRemoveFormulaColumn,
  onToggleFormulaColumnVisibility,
}: DatabaseViewControlsProps) {
  const [newColumnKey, setNewColumnKey] = useState('');
  const [rollupKey, setRollupKey] = useState('');
  const [rollupRelationKey, setRollupRelationKey] = useState('course');
  const [rollupFunction, setRollupFunction] = useState<RollupFunctionPhase1>('count');
  const [rollupTargetField, setRollupTargetField] = useState('');
  const [formulaKey, setFormulaKey] = useState('');
  const [formulaExpression, setFormulaExpression] = useState('');
  const [formulaInputName, setFormulaInputName] = useState('');
  const [formulaInputType, setFormulaInputType] = useState<'field' | 'rollup' | 'formula' | 'metadata'>('field');
  const [formulaFieldKey, setFormulaFieldKey] = useState('');
  const [formulaRefKey, setFormulaRefKey] = useState('');
  const [formulaMetadataKey, setFormulaMetadataKey] = useState<'updatedAt' | 'createdAt' | 'title'>('updatedAt');
  const [formulaRollupRelationKey, setFormulaRollupRelationKey] = useState('course');
  const [formulaRollupFunction, setFormulaRollupFunction] = useState<RollupFunctionPhase1>('count');
  const [formulaRollupTargetField, setFormulaRollupTargetField] = useState('');
  const [formulaInputs, setFormulaInputs] = useState<Record<string, FormulaInput>>({});
  const configured = withDatabaseViewDefaults(view);
  const tableConfig = getTableConfig(configured);
  const boardConfig = getBoardConfig(configured);
  const calendarConfig = getCalendarConfig(configured);
  const columnKeys = resolveAllColumnKeys(tableConfig.columns);
  const rollupColumns = tableConfig.rollupColumns ?? [];
  const formulaColumns = tableConfig.formulaColumns ?? [];
  const visibility = new Map(
    tableConfig.columns.map(entry => [entry.key.toLowerCase(), entry.visible]),
  );

  const submitAddColumn = () => {
    const trimmed = newColumnKey.trim();
    if (!trimmed) return;
    onAddColumn(trimmed);
    setNewColumnKey('');
  };

  const submitAddRollup = () => {
    const key = rollupKey.trim();
    const relationKey = rollupRelationKey.trim();
    if (!key || !relationKey) return;
    onAddRollupColumn({
      key,
      visible: true,
      rollup: {
        relationKey,
        direction: 'incoming',
        function: rollupFunction,
        ...(rollupTargetField.trim() ? { targetField: rollupTargetField.trim() } : {}),
      },
    });
    setRollupKey('');
  };

  const buildPendingFormulaInput = (): FormulaInput | null => {
    const name = formulaInputName.trim();
    if (!name) return null;

    switch (formulaInputType) {
      case 'field': {
        const key = formulaFieldKey.trim();
        if (!key) return null;
        return { type: 'field', key };
      }
      case 'rollup': {
        const relationKey = formulaRollupRelationKey.trim();
        if (!relationKey) return null;
        return {
          type: 'rollup',
          definition: {
            relationKey,
            direction: 'incoming',
            function: formulaRollupFunction,
            ...(formulaRollupTargetField.trim()
              ? { targetField: formulaRollupTargetField.trim() }
              : {}),
          },
        };
      }
      case 'formula': {
        const refKey = formulaRefKey.trim();
        if (!refKey) return null;
        return { type: 'formula', formulaKey: refKey };
      }
      case 'metadata':
        return { type: 'metadata', key: formulaMetadataKey };
      default:
        return null;
    }
  };

  const submitAddFormulaInput = () => {
    const name = formulaInputName.trim();
    const input = buildPendingFormulaInput();
    if (!name || !input) return;
    setFormulaInputs(current => ({ ...current, [name]: input }));
    setFormulaInputName('');
    setFormulaFieldKey('');
    setFormulaRefKey('');
  };

  const submitAddFormula = () => {
    const key = formulaKey.trim();
    const expression = formulaExpression.trim();
    if (!key || !expression || Object.keys(formulaInputs).length === 0) return;
    onAddFormulaColumn({
      key,
      visible: true,
      formula: {
        id: key,
        expression,
        inputs: formulaInputs,
      },
    });
    setFormulaKey('');
    setFormulaExpression('');
    setFormulaInputs({});
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

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
            <span style={{ fontWeight: 700 }}>Rollup Columns</span>
            {rollupColumns.map(column => (
              <div key={column.key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ flex: 1, color: column.visible ? c.accent : c.textMuted }}>
                  {rollupColumnLabel(column)}
                </span>
                <button
                  type="button"
                  className="btbtn"
                  style={{ padding: '1px 4px', fontSize: 9 }}
                  onClick={() => onToggleRollupColumnVisibility(column.key, !column.visible)}
                >
                  {column.visible ? 'Hide' : 'Show'}
                </button>
                <button
                  type="button"
                  className="btbtn"
                  style={{ padding: '1px 4px', fontSize: 9, color: c.danger }}
                  onClick={() => onRemoveRollupColumn(column.key)}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <input
              className="bwi"
              style={{ fontSize: 10 }}
              placeholder="Rollup column key"
              value={rollupKey}
              onChange={e => setRollupKey(e.target.value)}
            />
            <input
              className="bwi"
              style={{ fontSize: 10 }}
              placeholder="Relation key"
              value={rollupRelationKey}
              onChange={e => setRollupRelationKey(e.target.value)}
            />
            <select
              className="bwi"
              style={{ fontSize: 10 }}
              value={rollupFunction}
              onChange={e => setRollupFunction(e.target.value as RollupFunctionPhase1)}
            >
              {ROLLUP_FUNCTIONS_PHASE1.map(fn => (
                <option key={fn} value={fn}>{fn}</option>
              ))}
            </select>
            {(rollupFunction === 'sum' || rollupFunction === 'latest') && (
              <input
                className="bwi"
                style={{ fontSize: 10 }}
                placeholder={rollupFunction === 'latest' ? 'Target field (e.g. updatedAt)' : 'Numeric field'}
                value={rollupTargetField}
                onChange={e => setRollupTargetField(e.target.value)}
              />
            )}
            <button className="bwbg" style={{ padding: '2px 6px', fontSize: 10 }} onClick={submitAddRollup}>
              Add rollup
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
            <span style={{ fontWeight: 700 }}>Formula Columns</span>
            {formulaColumns.map(column => (
              <div key={column.key} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ flex: 1, color: column.visible ? c.accent : c.textMuted }}>
                    {formulaColumnLabel(column)}
                  </span>
                  <button
                    type="button"
                    className="btbtn"
                    style={{ padding: '1px 4px', fontSize: 9 }}
                    onClick={() => onToggleFormulaColumnVisibility(column.key, !column.visible)}
                  >
                    {column.visible ? 'Hide' : 'Show'}
                  </button>
                  <button
                    type="button"
                    className="btbtn"
                    style={{ padding: '1px 4px', fontSize: 9, color: c.danger }}
                    onClick={() => onRemoveFormulaColumn(column.key)}
                  >
                    Remove
                  </button>
                </div>
                <span style={{ fontSize: 9, color: c.textFaint, fontFamily: 'monospace' }}>
                  {column.formula.expression}
                </span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <input
              className="bwi"
              style={{ fontSize: 10 }}
              placeholder="Formula column key"
              value={formulaKey}
              onChange={e => setFormulaKey(e.target.value)}
            />
            <input
              className="bwi"
              style={{ fontSize: 10, fontFamily: 'monospace' }}
              placeholder="Expression, e.g. (completed / total) * 100"
              value={formulaExpression}
              onChange={e => setFormulaExpression(e.target.value)}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontWeight: 700 }}>Input bindings</span>
              {Object.entries(formulaInputs).map(([name, input]) => (
                <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ flex: 1, fontFamily: 'monospace', color: c.text }}>
                    {name} → {input.type}
                  </span>
                  <button
                    type="button"
                    className="btbtn"
                    style={{ padding: '1px 4px', fontSize: 9, color: c.danger }}
                    onClick={() => setFormulaInputs(current => {
                      const next = { ...current };
                      delete next[name];
                      return next;
                    })}
                  >
                    Remove
                  </button>
                </div>
              ))}
              <input
                className="bwi"
                style={{ fontSize: 10 }}
                placeholder="Input name (matches expression identifier)"
                value={formulaInputName}
                onChange={e => setFormulaInputName(e.target.value)}
              />
              <select
                className="bwi"
                style={{ fontSize: 10 }}
                value={formulaInputType}
                onChange={e => setFormulaInputType(e.target.value as typeof formulaInputType)}
              >
                <option value="field">Property field</option>
                <option value="rollup">Rollup</option>
                <option value="formula">Formula reference</option>
                <option value="metadata">Metadata</option>
              </select>
              {formulaInputType === 'field' && (
                <input
                  className="bwi"
                  style={{ fontSize: 10 }}
                  placeholder="Property key"
                  value={formulaFieldKey}
                  onChange={e => setFormulaFieldKey(e.target.value)}
                />
              )}
              {formulaInputType === 'rollup' && (
                <>
                  <input
                    className="bwi"
                    style={{ fontSize: 10 }}
                    placeholder="Relation key"
                    value={formulaRollupRelationKey}
                    onChange={e => setFormulaRollupRelationKey(e.target.value)}
                  />
                  <select
                    className="bwi"
                    style={{ fontSize: 10 }}
                    value={formulaRollupFunction}
                    onChange={e => setFormulaRollupFunction(e.target.value as RollupFunctionPhase1)}
                  >
                    {ROLLUP_FUNCTIONS_PHASE1.map(fn => (
                      <option key={fn} value={fn}>{fn}</option>
                    ))}
                  </select>
                  {(formulaRollupFunction === 'sum' || formulaRollupFunction === 'latest') && (
                    <input
                      className="bwi"
                      style={{ fontSize: 10 }}
                      placeholder="Target field"
                      value={formulaRollupTargetField}
                      onChange={e => setFormulaRollupTargetField(e.target.value)}
                    />
                  )}
                </>
              )}
              {formulaInputType === 'formula' && (
                <input
                  className="bwi"
                  style={{ fontSize: 10 }}
                  placeholder="Formula column key"
                  value={formulaRefKey}
                  onChange={e => setFormulaRefKey(e.target.value)}
                  list="database-formula-ref-suggestions"
                />
              )}
              {formulaInputType === 'metadata' && (
                <select
                  className="bwi"
                  style={{ fontSize: 10 }}
                  value={formulaMetadataKey}
                  onChange={e => setFormulaMetadataKey(e.target.value as typeof formulaMetadataKey)}
                >
                  <option value="updatedAt">updatedAt</option>
                  <option value="createdAt">createdAt</option>
                  <option value="title">title</option>
                </select>
              )}
              <button className="btbtn" style={{ padding: '2px 6px', fontSize: 10 }} onClick={submitAddFormulaInput}>
                Add input binding
              </button>
            </div>
            <datalist id="database-formula-ref-suggestions">
              {formulaColumns.map(column => (
                <option key={column.key} value={column.key} />
              ))}
            </datalist>
            <button className="bwbg" style={{ padding: '2px 6px', fontSize: 10 }} onClick={submitAddFormula}>
              Add formula
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
  const visibleRollupColumns = useMemo(
    () => resolveVisibleRollupColumns(tableConfig.rollupColumns),
    [tableConfig.rollupColumns],
  );
  const visibleFormulaColumns = useMemo(
    () => resolveVisibleFormulaColumns(tableConfig.formulaColumns),
    [tableConfig.formulaColumns],
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
        onAddRollupColumn={column => patch(v => addDatabaseViewRollupColumn(v, column))}
        onRemoveRollupColumn={key => patch(v => removeDatabaseViewRollupColumn(v, key))}
        onToggleRollupColumnVisibility={(key, visible) => patch(v => setDatabaseViewRollupColumnVisibility(v, key, visible))}
        onAddFormulaColumn={column => patch(v => addDatabaseViewFormulaColumn(v, column))}
        onRemoveFormulaColumn={key => patch(v => removeDatabaseViewFormulaColumn(v, key))}
        onToggleFormulaColumnVisibility={(key, visible) => patch(v => setDatabaseViewFormulaColumnVisibility(v, key, visible))}
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
          rollupColumns={visibleRollupColumns}
          formulaColumns={visibleFormulaColumns}
          sort={tableConfig.sort}
          service={service}
          activeNoteId={activeNoteId}
          onSelectNote={onSelectNote}
        />
      )}
    </>
  );
}
