import { useState } from 'react';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import {
  columnLabelForKey,
  resolveAllColumnKeys,
} from '../../databaseViews/databaseViewConfig';
import { resolveAllSortableKeys, resolveDatabaseViewSortRules } from '../../databaseViews/sortDatabaseViewRows';
import { TABLE_ADD_COLUMN_FIELD } from '../../databaseViews/databasePresentationMeta';
import type { DatabaseTableConfig } from '../../databaseViews/databasePresentationModels';
import type { DatabaseViewSort } from '../../databaseViews/databaseViewModels';
import type { DatabaseViewSortRule } from '../../databaseViews/databasePresentationModels';
import { isBuiltinColumnKey } from '../../databaseViews/databaseViewModels';
import { formulaColumnLabel, type FormulaInput } from '../../formulas/formulaModels';
import { ROLLUP_FUNCTIONS_PHASE1, rollupColumnLabel, type RollupFunctionPhase1 } from '../../rollups/rollupModels';

export interface TableViewControlsProps {
  colors: NoteChromeColors;
  tableConfig: DatabaseTableConfig;
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

export function TableViewControls({
  colors: c,
  tableConfig,
  onAddColumn,
  onRemoveColumn,
  onToggleColumnVisibility,
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
}: TableViewControlsProps) {
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

  const columnKeys = resolveAllColumnKeys(tableConfig.columns);
  const rollupColumns = tableConfig.rollupColumns ?? [];
  const formulaColumns = tableConfig.formulaColumns ?? [];
  const sortRules = resolveDatabaseViewSortRules(tableConfig);
  const sortableKeys = resolveAllSortableKeys(tableConfig);
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
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 700 }}>Sort rules</span>
          <button
            type="button"
            className="btbtn"
            style={{ padding: '1px 6px', fontSize: 9 }}
            onClick={() => onAddSortRule({
              key: sortableKeys[0] ?? 'updatedAt',
              direction: 'desc',
            })}
          >
            Add rule
          </button>
        </div>
        {sortRules.map((rule, index) => (
          <div key={`${rule.key}-${index}`} style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 9, color: c.textFaint, minWidth: 42 }}>Rule {index + 1}</span>
            <select
              className="bwi"
              style={{ flex: 1, minWidth: 80, fontSize: 10, padding: '2px 4px' }}
              value={rule.key}
              onChange={e => {
                const next = sortRules.map((entry, i) => (
                  i === index ? { ...entry, key: e.target.value } : entry
                ));
                onSortRulesChange(next);
              }}
            >
              {sortableKeys.map(key => (
                <option key={key} value={key}>{columnLabelForKey(key)}</option>
              ))}
            </select>
            <select
              className="bwi"
              style={{ fontSize: 10, padding: '2px 4px' }}
              value={rule.direction}
              onChange={e => {
                const next = sortRules.map((entry, i) => (
                  i === index
                    ? { ...entry, direction: e.target.value as 'asc' | 'desc' }
                    : entry
                ));
                onSortRulesChange(next);
              }}
            >
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
            <button
              type="button"
              className="btbtn"
              style={{ padding: '1px 4px', fontSize: 9 }}
              disabled={index === 0}
              onClick={() => onMoveSortRule(index, index - 1)}
              title="Move up"
            >
              Up
            </button>
            <button
              type="button"
              className="btbtn"
              style={{ padding: '1px 4px', fontSize: 9 }}
              disabled={index === sortRules.length - 1}
              onClick={() => onMoveSortRule(index, index + 1)}
              title="Move down"
            >
              Down
            </button>
            <button
              type="button"
              className="btbtn"
              style={{ padding: '1px 4px', fontSize: 9, color: c.danger }}
              disabled={sortRules.length <= 1}
              onClick={() => onRemoveSortRule(index)}
              title="Remove rule"
            >
              Remove
            </button>
          </div>
        ))}
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
  );
}
