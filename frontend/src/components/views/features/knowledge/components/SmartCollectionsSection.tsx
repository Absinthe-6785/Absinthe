import { X } from 'lucide-react';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { SmartCollection } from '../collections/smartCollectionModels';
import {
  SMART_COLLECTION_GROUPS,
  getSmartCollectionIcon,
} from '../collections/smartCollectionGroups';
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

function CollectionRow({
  c,
  collection,
  active,
  count,
  onActivate,
  isPinned,
  onTogglePin,
}: {
  c: NoteChromeColors;
  collection: SmartCollection;
  active: boolean;
  count: number;
  onActivate: () => void;
  isPinned?: boolean;
  onTogglePin?: (e: React.MouseEvent) => void;
}) {
  const Icon = getSmartCollectionIcon(collection.id);
  return (
    <div
      className={`bfi ${active ? 'active' : ''}`}
      onClick={onActivate}
      style={{ gap: 4, fontSize: 11 }}
      title={collection.description}
    >
      <Icon size={10} color={active ? c.accent : c.textMuted} style={{ flexShrink: 0 }} />
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {collection.name}
      </span>
      <span style={{ fontSize: 9, color: c.textMuted }}>{count}</span>
      {onTogglePin && (
        <WorkspacePinToggle
          colors={c}
          pinned={isPinned ?? false}
          onToggle={onTogglePin}
        />
      )}
    </div>
  );
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
  const byId = new Map(collections.map(col => [col.id, col]));

  return (
    <div style={{ borderTop: `1px solid ${c.sideBdr}`, marginTop: 4 }}>
      <div className="bseclbl" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>스마트 컬렉션</span>
        {activeCollectionId && (
          <button
            type="button"
            onClick={onClearActive}
            className="btbtn"
            style={{ padding: '0 2px', fontSize: 9, color: c.textMuted }}
            title="컬렉션 선택 해제"
          >
            <X size={10} />
          </button>
        )}
      </div>

      {SMART_COLLECTION_GROUPS.map(group => {
        const GroupIcon = group.icon;
        const groupCollections = group.collectionIds
          .map(id => byId.get(id))
          .filter((col): col is SmartCollection => col !== undefined);
        if (groupCollections.length === 0) return null;
        return (
          <div key={group.id} style={{ marginBottom: 6 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 8px 2px',
                fontSize: 9,
                fontWeight: 700,
                color: c.textMuted,
                letterSpacing: 0.3,
              }}
            >
              <GroupIcon size={9} color={c.textFaint} />
              {group.label}
            </div>
            {groupCollections.map(collection => (
              <CollectionRow
                key={collection.id}
                c={c}
                collection={collection}
                active={activeCollectionId === collection.id}
                count={counts[collection.id] ?? 0}
                onActivate={() => onActivate(collection)}
                isPinned={isPinned?.(collection.id)}
                onTogglePin={onTogglePin
                  ? e => { e.stopPropagation(); onTogglePin(collection); }
                  : undefined}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}
