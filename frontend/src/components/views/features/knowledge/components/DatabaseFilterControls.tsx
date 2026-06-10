import { useMemo } from 'react';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { FormulaColumnDefinition } from '../formulas/formulaModels';
import {
  compileVisualFilters,
  getVisualFilterConditions,
  type FilterComparisonOperator,
  type FilterCondition,
  type FilterFieldKind,
  type VisualFilterModel,
} from '../query/visualFilterModels';
import { parseQuery } from '../query/parseQuery';
import { resolveDatabaseViewEffectiveQuery } from '../databaseViews/resolveDatabaseViewQuery';
import type { DatabaseView } from '../databaseViews/databaseViewModels';

const FIELD_KINDS: readonly { value: FilterFieldKind; label: string }[] = [
  { value: 'property', label: 'Property' },
  { value: 'tag', label: 'Tag' },
  { value: 'formula', label: 'Formula' },
  { value: 'metadata', label: 'Metadata' },
  { value: 'relation', label: 'Relation' },
  { value: 'hasRelation', label: 'Has relation' },
  { value: 'linkedTo', label: 'Linked to' },
];

const OPERATORS: readonly FilterComparisonOperator[] = ['=', '!=', '>', '<', '>=', '<='];

const METADATA_KEYS = ['updatedAt', 'createdAt', 'title'] as const;

function defaultCondition(kind: FilterFieldKind = 'property'): FilterCondition {
  switch (kind) {
    case 'tag':
      return { kind, value: '' };
    case 'hasRelation':
      return { kind, field: 'course', value: 'true' };
    case 'linkedTo':
      return { kind, value: '' };
    case 'formula':
      return { kind, field: 'completionRate', operator: '>', value: 0 };
    case 'metadata':
      return { kind, field: 'updatedAt', operator: '>', value: '' };
    case 'relation':
      return { kind, field: 'course', operator: '=', value: '' };
    default:
      return { kind: 'property', field: 'status', operator: '=', value: '' };
  }
}

function operatorsForKind(kind: FilterFieldKind): readonly FilterComparisonOperator[] {
  if (kind === 'tag' || kind === 'hasRelation' || kind === 'linkedTo') {
    return ['='];
  }
  return OPERATORS;
}

function showOperator(kind: FilterFieldKind): boolean {
  return kind !== 'tag' && kind !== 'hasRelation' && kind !== 'linkedTo';
}

function showFieldKey(kind: FilterFieldKind): boolean {
  return kind !== 'tag' && kind !== 'linkedTo';
}

function showValueInput(kind: FilterFieldKind): boolean {
  return kind !== 'hasRelation';
}

export interface DatabaseFilterControlsProps {
  colors: NoteChromeColors;
  view: DatabaseView;
  visualFilters: VisualFilterModel | null | undefined;
  sessionFilter: VisualFilterModel | null;
  formulaColumns?: readonly FormulaColumnDefinition[];
  onQueryChange: (query: string) => void;
  onAddFilter: (condition: FilterCondition) => void;
  onUpdateFilter: (index: number, condition: FilterCondition) => void;
  onRemoveFilter: (index: number) => void;
  onMoveFilter: (fromIndex: number, toIndex: number) => void;
  onAddSessionFilter: (condition: FilterCondition) => void;
  onUpdateSessionFilter: (index: number, condition: FilterCondition) => void;
  onRemoveSessionFilter: (index: number) => void;
  onMoveSessionFilter: (fromIndex: number, toIndex: number) => void;
  onClearSessionFilters: () => void;
}

function FilterRuleList({
  colors: c,
  title,
  conditions,
  formulaColumns,
  onAdd,
  onUpdate,
  onRemove,
  onMove,
}: {
  colors: NoteChromeColors;
  title: string;
  conditions: readonly FilterCondition[];
  formulaColumns: readonly FormulaColumnDefinition[];
  onAdd: (condition: FilterCondition) => void;
  onUpdate: (index: number, condition: FilterCondition) => void;
  onRemove: (index: number) => void;
  onMove: (fromIndex: number, toIndex: number) => void;
}) {
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ fontSize: 10, color: c.muted, marginBottom: 4 }}>{title}</div>
      {conditions.map((condition, index) => (
        <div
          key={`${title}-${index}-${condition.kind}`}
          style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}
        >
          <span style={{ fontSize: 10, color: c.muted, minWidth: 14 }}>{index + 1}.</span>
          <select
            className="bwi"
            style={{ fontSize: 10, minWidth: 88 }}
            value={condition.kind}
            onChange={e => onUpdate(index, defaultCondition(e.target.value as FilterFieldKind))}
          >
            {FIELD_KINDS.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          {showFieldKey(condition.kind) && (
            condition.kind === 'metadata' ? (
              <select
                className="bwi"
                style={{ fontSize: 10, minWidth: 88 }}
                value={condition.field ?? 'updatedAt'}
                onChange={e => onUpdate(index, { ...condition, field: e.target.value })}
              >
                {METADATA_KEYS.map(key => (
                  <option key={key} value={key}>{key}</option>
                ))}
              </select>
            ) : condition.kind === 'formula' ? (
              <select
                className="bwi"
                style={{ fontSize: 10, minWidth: 88 }}
                value={condition.field ?? ''}
                onChange={e => onUpdate(index, { ...condition, field: e.target.value })}
              >
                <option value="">Formula key</option>
                {formulaColumns.map(column => (
                  <option key={column.key} value={column.key}>{column.key}</option>
                ))}
              </select>
            ) : (
              <input
                className="bwi"
                style={{ fontSize: 10, minWidth: 88 }}
                placeholder={condition.kind === 'relation' || condition.kind === 'hasRelation' ? 'Relation key' : 'Field'}
                value={condition.field ?? ''}
                onChange={e => onUpdate(index, { ...condition, field: e.target.value })}
              />
            )
          )}
          {showOperator(condition.kind) && (
            <select
              className="bwi"
              style={{ fontSize: 10, minWidth: 52 }}
              value={condition.operator ?? '='}
              onChange={e => onUpdate(index, {
                ...condition,
                operator: e.target.value as FilterComparisonOperator,
              })}
            >
              {operatorsForKind(condition.kind).map(op => (
                <option key={op} value={op}>{op}</option>
              ))}
            </select>
          )}
          {showValueInput(condition.kind) && (
            <input
              className="bwi"
              style={{ fontSize: 10, flex: 1, minWidth: 72 }}
              placeholder="Value"
              value={String(condition.value ?? '')}
              onChange={e => onUpdate(index, {
                ...condition,
                value: condition.kind === 'formula'
                  ? Number(e.target.value)
                  : e.target.value,
              })}
            />
          )}
          <button
            className="bwbg"
            style={{ padding: '2px 4px', fontSize: 10 }}
            disabled={index === 0}
            onClick={() => onMove(index, index - 1)}
            title="Move up"
          >
            ↑
          </button>
          <button
            className="bwbg"
            style={{ padding: '2px 4px', fontSize: 10 }}
            disabled={index >= conditions.length - 1}
            onClick={() => onMove(index, index + 1)}
            title="Move down"
          >
            ↓
          </button>
          <button
            className="bwbg"
            style={{ padding: '2px 4px', fontSize: 10 }}
            onClick={() => onRemove(index)}
            title="Remove filter"
          >
            ×
          </button>
        </div>
      ))}
      <button
        className="btbtn"
        style={{ padding: '2px 6px', fontSize: 10, marginTop: 2 }}
        onClick={() => onAdd(defaultCondition())}
      >
        Add filter
      </button>
    </div>
  );
}

export function DatabaseFilterControls({
  colors: c,
  view,
  visualFilters,
  sessionFilter,
  formulaColumns = [],
  onQueryChange,
  onAddFilter,
  onUpdateFilter,
  onRemoveFilter,
  onMoveFilter,
  onAddSessionFilter,
  onUpdateSessionFilter,
  onRemoveSessionFilter,
  onMoveSessionFilter,
  onClearSessionFilters,
}: DatabaseFilterControlsProps) {
  const persistedConditions = getVisualFilterConditions(visualFilters);
  const sessionConditions = getVisualFilterConditions(sessionFilter);

  const effectiveQuery = useMemo(
    () => resolveDatabaseViewEffectiveQuery(view, { sessionFilter }),
    [view, sessionFilter],
  );

  const compiledPersisted = useMemo(
    () => (visualFilters ? compileVisualFilters(visualFilters) : ''),
    [visualFilters],
  );

  const queryError = useMemo(() => {
    if (!effectiveQuery.trim()) return null;
    return parseQuery(effectiveQuery).error ?? null;
  }, [effectiveQuery]);

  return (
    <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${c.sideBdr}` }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: c.fg, marginBottom: 4 }}>
        Filters
      </div>
      <div style={{ fontSize: 10, color: c.muted, marginBottom: 4 }}>
        Base query (manual)
      </div>
      <input
        className="bwi"
        style={{ fontSize: 10, width: '100%' }}
        placeholder="tag:japanese"
        value={view.query}
        onChange={e => onQueryChange(e.target.value)}
      />
      <FilterRuleList
        colors={c}
        title="Saved visual filters"
        conditions={persistedConditions}
        formulaColumns={formulaColumns}
        onAdd={onAddFilter}
        onUpdate={onUpdateFilter}
        onRemove={onRemoveFilter}
        onMove={onMoveFilter}
      />
      <FilterRuleList
        colors={c}
        title="Session refine (not saved)"
        conditions={sessionConditions}
        formulaColumns={formulaColumns}
        onAdd={onAddSessionFilter}
        onUpdate={onUpdateSessionFilter}
        onRemove={onRemoveSessionFilter}
        onMove={onMoveSessionFilter}
      />
      {sessionConditions.length > 0 && (
        <button
          className="bwbg"
          style={{ padding: '2px 6px', fontSize: 10, marginTop: 4 }}
          onClick={onClearSessionFilters}
        >
          Clear session filters
        </button>
      )}
      <div style={{ fontSize: 10, color: c.muted, marginTop: 8 }}>
        Effective query
      </div>
      <div style={{
        fontSize: 10,
        fontFamily: 'monospace',
        color: queryError ? '#c0392b' : c.fg,
        wordBreak: 'break-word',
      }}
      >
        {effectiveQuery || '(none)'}
      </div>
      {compiledPersisted && (
        <div style={{ fontSize: 10, color: c.muted, marginTop: 4 }}>
          Saved filters compile to: {compiledPersisted}
        </div>
      )}
      {queryError && (
        <div style={{ fontSize: 10, color: '#c0392b', marginTop: 4 }}>
          {queryError}
        </div>
      )}
    </div>
  );
}
