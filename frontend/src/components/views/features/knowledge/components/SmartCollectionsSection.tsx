import { X } from 'lucide-react';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { SmartCollection } from '../collections/smartCollectionModels';
import { WorkspacePinToggle } from './WorkspacePinToggle';

export interface SmartCollectionsSectionProps {
  colors: NoteChromeColors;
  collections: readonly SmartCollection[];
  activeCollectionId: string | null;
  counts: Readonly<Record<string, number>>;
  onActivate: (collection: SmartCollection) => void;
  onClearActive: () => void;
  isPinned?: (id: string) => boolean;
  onTogglePin?: (collection: SmartCollection) => void;
}

export function SmartCollectionsSection({
  colors: c,
  collections,
  activeCollectionId,
  counts,
  onActivate,
  onClearActive,
  isPinned,
  onTogglePin,
}: SmartCollectionsSectionProps) {
  return (
    <div style={{ borderTop: `1px solid ${c.sideBdr}`, marginTop: 4 }}>
      <div className="bseclbl" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>Smart Collections</span>
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
        <div
          key={collection.id}
          className={`bfi ${activeCollectionId === collection.id ? 'active' : ''}`}
          onClick={() => onActivate(collection)}
          style={{ gap: 4, fontSize: 11 }}
          title={collection.description}
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
        </div>
      ))}
    </div>
  );
}
