import { useState } from 'react';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import { columnLabelForKey, resolveAllColumnKeys } from '../databaseViews/databaseViewConfig';
import type { DatabaseView, DatabaseViewSort } from '../databaseViews/databaseViewModels';
import { isBuiltinColumnKey } from '../databaseViews/databaseViewModels';
import { withDatabaseViewDefaults } from '../databaseViews/prepareDatabaseViewRows';

export interface DatabaseViewControlsProps {
  colors: NoteChromeColors;
  view: DatabaseView;
  onAddColumn: (key: string) => void;
  onRemoveColumn: (key: string) => void;
  onToggleColumnVisibility: (key: string, visible: boolean) => void;
  onSortChange: (sort: DatabaseViewSort) => void;
}

export function DatabaseViewControls({
  colors: c,
  view,
  onAddColumn,
  onRemoveColumn,
  onToggleColumnVisibility,
  onSortChange,
}: DatabaseViewControlsProps) {
  const [newColumnKey, setNewColumnKey] = useState('');
  const configured = withDatabaseViewDefaults(view);
  const columnKeys = resolveAllColumnKeys(configured.columns);
  const visibility = new Map(
    (configured.columns ?? []).map(entry => [entry.key.toLowerCase(), entry.visible]),
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
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ color: c.textMuted, fontWeight: 700 }}>Sort</span>
        <select
          className="bwi"
          style={{ fontSize: 10, padding: '2px 4px' }}
          value={configured.sort?.key ?? 'updatedAt'}
          onChange={e => onSortChange({
            key: e.target.value,
            direction: configured.sort?.direction ?? 'desc',
          })}
        >
          {columnKeys.map(key => (
            <option key={key} value={key}>{columnLabelForKey(key)}</option>
          ))}
        </select>
        <select
          className="bwi"
          style={{ fontSize: 10, padding: '2px 4px' }}
          value={configured.sort?.direction ?? 'desc'}
          onChange={e => onSortChange({
            key: configured.sort?.key ?? 'updatedAt',
            direction: e.target.value as 'asc' | 'desc',
          })}
        >
          <option value="desc">Descending</option>
          <option value="asc">Ascending</option>
        </select>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ color: c.textMuted, fontWeight: 700 }}>Columns</span>
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
          placeholder="Property key (e.g. status)"
          value={newColumnKey}
          onChange={e => setNewColumnKey(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') submitAddColumn();
          }}
        />
        <button className="bwbg" style={{ padding: '2px 6px', fontSize: 10 }} onClick={submitAddColumn}>
          Add
        </button>
      </div>
    </div>
  );
}
