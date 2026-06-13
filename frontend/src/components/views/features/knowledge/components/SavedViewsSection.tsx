import { useState } from 'react';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { SavedView } from '../views/savedViewModels';
import { WorkspacePinToggle } from './WorkspacePinToggle';

export interface SavedViewsSectionProps {
  colors: NoteChromeColors;
  views: readonly SavedView[];
  activeViewId: string | null;
  canSaveCurrent: boolean;
  onActivate: (view: SavedView) => void;
  onClearActive: () => void;
  onCreate: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  isPinned?: (id: string) => boolean;
  onTogglePin?: (view: SavedView) => void;
}

export function SavedViewsSection({
  colors: c,
  views,
  activeViewId,
  canSaveCurrent,
  onActivate,
  onClearActive,
  onCreate,
  onRename,
  onDelete,
  isPinned,
  onTogglePin,
}: SavedViewsSectionProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const submitCreate = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    onCreate(trimmed);
    setNewName('');
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

  if (views.length === 0 && !canSaveCurrent && !showCreateForm) return null;

  return (
    <div style={{ borderTop: `1px solid ${c.sideBdr}`, marginTop: 4 }}>
      <div className="bseclbl" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>저장된 보기</span>
        {activeViewId && (
          <button
            type="button"
            onClick={onClearActive}
            className="btbtn"
            style={{ padding: '0 2px', fontSize: 9, color: c.textMuted }}
            title="보기 선택 해제"
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
            <button className="bwbg" style={{ padding: '2px 6px', fontSize: 10 }} onClick={submitRename}>저장</button>
          </div>
        ) : (
          <div
            key={view.id}
            className={`bfi ${activeViewId === view.id ? 'active' : ''}`}
            onClick={() => onActivate(view)}
            style={{ gap: 4, fontSize: 11 }}
            title={view.query}
          >
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {view.name}
            </span>
            {onTogglePin && (
              <WorkspacePinToggle
                colors={c}
                pinned={isPinned?.(view.id) ?? false}
                onToggle={e => { e.stopPropagation(); onTogglePin(view); }}
              />
            )}
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                setRenamingId(view.id);
                setRenameValue(view.name);
              }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.textMuted, padding: 0 }}
              title="보기 이름 변경"
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
              title="보기 삭제"
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
            placeholder="보기 이름"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') submitCreate();
              if (e.key === 'Escape') setShowCreateForm(false);
            }}
            autoFocus
          />
          <div style={{ display: 'flex', gap: 3 }}>
            <button className="bwbg" style={{ flex: 1, padding: '3px', fontSize: 11 }} onClick={submitCreate}>저장</button>
            <button
              onClick={() => setShowCreateForm(false)}
              style={{ flex: 1, background: c.cardHov, border: 'none', borderRadius: 5, color: c.textMuted, fontSize: 11, cursor: 'pointer', padding: '3px' }}
            >
              취소
            </button>
          </div>
        </div>
      ) : (
        canSaveCurrent && (
          <div
            className="bfi"
            onClick={() => setShowCreateForm(true)}
            style={{ color: c.textMuted, fontSize: 10 }}
          >
            <Plus size={10} color={c.textMuted} />
            <span>현재 검색 저장</span>
          </div>
        )
      )}
    </div>
  );
}
