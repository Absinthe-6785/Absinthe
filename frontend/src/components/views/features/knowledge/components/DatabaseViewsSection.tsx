import { useState } from 'react';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { DatabaseView, DatabaseViewPresentation } from '../databaseViews/databaseViewModels';

export interface DatabaseViewsSectionProps {
  colors: NoteChromeColors;
  views: readonly DatabaseView[];
  activeViewId: string | null;
  counts: Readonly<Record<string, number>>;
  canCreateFromCurrent: boolean;
  currentQuery: string;
  onActivate: (view: DatabaseView) => void;
  onClearActive: () => void;
  onCreate: (name: string, query: string, presentation?: DatabaseViewPresentation, groupBy?: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

export function DatabaseViewsSection({
  colors: c,
  views,
  activeViewId,
  counts,
  canCreateFromCurrent,
  currentQuery,
  onActivate,
  onClearActive,
  onCreate,
  onRename,
  onDelete,
}: DatabaseViewsSectionProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newQuery, setNewQuery] = useState('');
  const [newPresentation, setNewPresentation] = useState<DatabaseViewPresentation>('table');
  const [newGroupBy, setNewGroupBy] = useState('status');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const openCreateForm = (prefillQuery = '') => {
    setNewQuery(prefillQuery);
    setNewPresentation('table');
    setNewGroupBy('status');
    setShowCreateForm(true);
  };

  const submitCreate = () => {
    const trimmedName = newName.trim();
    const trimmedQuery = newQuery.trim();
    if (!trimmedName || !trimmedQuery) return;
    onCreate(
      trimmedName,
      trimmedQuery,
      newPresentation,
      newPresentation === 'board' ? newGroupBy : undefined,
    );
    setNewName('');
    setNewQuery('');
    setShowCreateForm(false);
  };

  const submitRename = () => {
    if (!renamingId) return;
    const trimmed = renameValue.trim();
    if (!trimmed) return;
    onRename(renamingId, trimmed);
    setRenamingId(null);
    setRenameValue('');
  };

  const presentationLabel = (view: DatabaseView) => {
    if (view.presentation === 'board') return 'board';
    return 'table';
  };

  return (
    <div style={{ borderTop: `1px solid ${c.sideBdr}`, marginTop: 4 }}>
      <div className="bseclbl" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>Database Views</span>
        {activeViewId && (
          <button
            type="button"
            onClick={onClearActive}
            className="btbtn"
            style={{ padding: '0 2px', fontSize: 9, color: c.textMuted }}
            title="Clear active database view"
          >
            <X size={10} />
          </button>
        )}
      </div>

      {views.map(view => (
        renamingId === view.id ? (
          <div key={view.id} style={{ padding: '4px 8px', display: 'flex', gap: 4 }}>
            <input
              className="bwi"
              style={{ flex: 1, fontSize: 11 }}
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') submitRename();
                if (e.key === 'Escape') setRenamingId(null);
              }}
              autoFocus
            />
            <button className="bwbg" style={{ padding: '2px 6px', fontSize: 10 }} onClick={submitRename}>Save</button>
          </div>
        ) : (
          <div
            key={view.id}
            className={`bfi ${activeViewId === view.id ? 'active' : ''}`}
            onClick={() => onActivate(view)}
            style={{ gap: 4, fontSize: 11 }}
            title={`${view.query} · ${presentationLabel(view)}`}
          >
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {view.name}
            </span>
            <span style={{ fontSize: 9, color: c.textMuted }}>{counts[view.id] ?? 0}</span>
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                setRenamingId(view.id);
                setRenameValue(view.name);
              }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.textMuted, padding: 0 }}
              title="Rename database view"
            >
              <Pencil size={9} />
            </button>
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                onDelete(view.id);
              }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.textMuted, padding: 0 }}
              title="Delete database view"
            >
              <Trash2 size={9} />
            </button>
          </div>
        )
      ))}

      {showCreateForm ? (
        <div style={{ padding: '4px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <input
            className="bwi"
            style={{ width: '100%', fontSize: 11 }}
            placeholder="Database name"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') submitCreate();
              if (e.key === 'Escape') setShowCreateForm(false);
            }}
            autoFocus
          />
          <input
            className="bwi"
            style={{ width: '100%', fontSize: 11 }}
            placeholder="Query (e.g. tag:japanese)"
            value={newQuery}
            onChange={e => setNewQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') submitCreate();
              if (e.key === 'Escape') setShowCreateForm(false);
            }}
          />
          <select
            className="bwi"
            style={{ width: '100%', fontSize: 11 }}
            value={newPresentation}
            onChange={e => setNewPresentation(e.target.value as DatabaseViewPresentation)}
          >
            <option value="table">Table</option>
            <option value="board">Board</option>
          </select>
          {newPresentation === 'board' && (
            <input
              className="bwi"
              style={{ width: '100%', fontSize: 11 }}
              placeholder="Group by property (e.g. status)"
              value={newGroupBy}
              onChange={e => setNewGroupBy(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') submitCreate();
                if (e.key === 'Escape') setShowCreateForm(false);
              }}
            />
          )}
          <div style={{ display: 'flex', gap: 3 }}>
            <button className="bwbg" style={{ flex: 1, padding: '3px', fontSize: 11 }} onClick={submitCreate}>Save</button>
            <button
              onClick={() => setShowCreateForm(false)}
              style={{ flex: 1, background: c.cardHov, border: 'none', borderRadius: 5, color: c.textMuted, fontSize: 11, cursor: 'pointer', padding: '3px' }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div
            className="bfi"
            onClick={() => openCreateForm()}
            style={{ color: c.textMuted, fontSize: 10 }}
          >
            <Plus size={10} color={c.textMuted} />
            <span>New database</span>
          </div>
          {canCreateFromCurrent && (
            <div
              className="bfi"
              onClick={() => openCreateForm(currentQuery)}
              style={{ color: c.textMuted, fontSize: 10 }}
            >
              <Plus size={10} color={c.textMuted} />
              <span>Save current query</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
