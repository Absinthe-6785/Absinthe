import { useState } from 'react';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { RuleCollection } from '../collections/ruleCollectionModels';
import { WorkspacePinToggle } from './WorkspacePinToggle';

export interface RuleCollectionsSectionProps {
  colors: NoteChromeColors;
  collections: readonly RuleCollection[];
  activeCollectionId: string | null;
  counts: Readonly<Record<string, number>>;
  canCreateFromCurrent: boolean;
  currentQuery: string;
  onActivate: (collection: RuleCollection) => void;
  onClearActive: () => void;
  onCreate: (name: string, query: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  isPinned?: (id: string) => boolean;
  onTogglePin?: (collection: RuleCollection) => void;
}

export function RuleCollectionsSection({
  colors: c,
  collections,
  activeCollectionId,
  counts,
  canCreateFromCurrent,
  currentQuery,
  onActivate,
  onClearActive,
  onCreate,
  onRename,
  onDelete,
  isPinned,
  onTogglePin,
}: RuleCollectionsSectionProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newQuery, setNewQuery] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const openCreateForm = (prefillQuery = '') => {
    setNewQuery(prefillQuery);
    setShowCreateForm(true);
  };

  const submitCreate = () => {
    const trimmedName = newName.trim();
    const trimmedQuery = newQuery.trim();
    if (!trimmedName || !trimmedQuery) return;
    onCreate(trimmedName, trimmedQuery);
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

  return (
    <div style={{ borderTop: `1px solid ${c.sideBdr}`, marginTop: 4 }}>
      <div className="bseclbl" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>Collections</span>
        {activeCollectionId && (
          <button
            type="button"
            onClick={onClearActive}
            className="btbtn"
            style={{ padding: '0 2px', fontSize: 9, color: c.textMuted }}
            title="Clear active collection"
          >
            <X size={10} />
          </button>
        )}
      </div>

      {collections.map(collection => (
        renamingId === collection.id ? (
          <div key={collection.id} style={{ padding: '4px 8px', display: 'flex', gap: 4 }}>
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
            key={collection.id}
            className={`bfi ${activeCollectionId === collection.id ? 'active' : ''}`}
            onClick={() => onActivate(collection)}
            style={{ gap: 4, fontSize: 11 }}
            title={collection.query}
          >
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {collection.name}
            </span>
            <span style={{ fontSize: 9, color: c.textMuted }}>{counts[collection.id] ?? 0}</span>
            {onTogglePin && (
              <WorkspacePinToggle
                colors={c}
                pinned={isPinned?.(collection.id) ?? false}
                onToggle={e => { e.stopPropagation(); onTogglePin(collection); }}
              />
            )}
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                setRenamingId(collection.id);
                setRenameValue(collection.name);
              }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.textMuted, padding: 0 }}
              title="Rename collection"
            >
              <Pencil size={9} />
            </button>
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                onDelete(collection.id);
              }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.textMuted, padding: 0 }}
              title="Delete collection"
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
            placeholder="Collection name"
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
            placeholder="Rule (e.g. tag:japanese status:active)"
            value={newQuery}
            onChange={e => setNewQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') submitCreate();
              if (e.key === 'Escape') setShowCreateForm(false);
            }}
          />
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
            <span>New collection</span>
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
