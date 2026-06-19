import { useState } from 'react';
import { ChevronDown, ChevronRight, X } from 'lucide-react';
import { useTranslation } from '../../../../../lib/i18n';
import { useViewportLayout } from '../../../../../hooks/useViewportLayout';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { SmartCollection, SmartCollectionId } from '../collections/smartCollectionModels';
import {
  SMART_COLLECTION_GROUPS,
  getSmartCollectionIcon,
} from '../collections/smartCollectionGroups';
import {
  resolveSmartCollectionGroupLabel,
  resolveSmartCollectionName,
} from '../collections/smartCollectionLabels';
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
  displayName,
  active,
  count,
  onActivate,
  isPinned,
  onTogglePin,
  subdued,
  isMobile,
}: {
  c: NoteChromeColors;
  collection: SmartCollection;
  displayName: string;
  active: boolean;
  count: number;
  onActivate: () => void;
  isPinned?: boolean;
  onTogglePin?: (e: React.MouseEvent) => void;
  subdued?: boolean;
  isMobile?: boolean;
}) {
  const Icon = getSmartCollectionIcon(collection.id);
  return (
    <div
      className={`bfi ${active ? 'active' : ''}`}
      onClick={onActivate}
      data-k108-smart-collection-row
      data-k108-sc-id={collection.id}
      style={{
        gap: 4,
        fontSize: subdued ? 10 : 11,
        opacity: subdued ? 0.85 : 1,
        paddingLeft: subdued ? 14 : undefined,
        minHeight: isMobile ? 44 : undefined,
        padding: isMobile ? '10px 8px' : undefined,
      }}
      title={collection.description}
    >
      <Icon size={10} color={active ? c.accent : c.textMuted} style={{ flexShrink: 0 }} />
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {displayName}
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

function GroupSection({
  c,
  groupId,
  groupLabel,
  GroupIcon,
  primaryCollections,
  secondaryCollections,
  activeCollectionId,
  counts,
  onActivate,
  isPinned,
  onTogglePin,
  isMobile,
}: {
  c: NoteChromeColors;
  groupId: string;
  groupLabel: string;
  GroupIcon: typeof ChevronDown;
  primaryCollections: SmartCollection[];
  secondaryCollections: SmartCollection[];
  activeCollectionId: string | null;
  counts: Readonly<Record<string, number>>;
  onActivate: (collection: SmartCollection) => void;
  isPinned?: (id: string) => boolean;
  onTogglePin?: (collection: SmartCollection) => void;
  isMobile?: boolean;
}) {
  const { t } = useTranslation();
  const hasSecondaryActive = secondaryCollections.some(col => col.id === activeCollectionId);
  const [showSecondary, setShowSecondary] = useState(hasSecondaryActive);

  return (
    <div style={{ marginBottom: 6 }}>
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
        {groupLabel}
      </div>
      {primaryCollections.map(collection => (
        <CollectionRow
          key={collection.id}
          c={c}
          collection={collection}
          displayName={resolveSmartCollectionName(collection, t)}
          active={activeCollectionId === collection.id}
          count={counts[collection.id] ?? 0}
          onActivate={() => onActivate(collection)}
          isPinned={isPinned?.(collection.id)}
                onTogglePin={onTogglePin
                  ? e => { e.stopPropagation(); onTogglePin(collection); }
                  : undefined}
                isMobile={isMobile}
              />
      ))}
      {secondaryCollections.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setShowSecondary(prev => !prev)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 3,
              width: '100%',
              padding: '2px 8px 2px 14px',
              fontSize: 9,
              color: c.textFaint,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {showSecondary ? <ChevronDown size={9} /> : <ChevronRight size={9} />}
            {t('knShowMoreCount').replace('{count}', String(secondaryCollections.length))}
          </button>
          {showSecondary && secondaryCollections.map(collection => (
            <CollectionRow
              key={collection.id}
              c={c}
              collection={collection}
              displayName={resolveSmartCollectionName(collection, t)}
              active={activeCollectionId === collection.id}
              count={counts[collection.id] ?? 0}
              onActivate={() => onActivate(collection)}
              isPinned={isPinned?.(collection.id)}
              onTogglePin={onTogglePin
                ? e => { e.stopPropagation(); onTogglePin(collection); }
                : undefined}
              subdued
              isMobile={isMobile}
            />
          ))}
        </>
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
  const { t } = useTranslation();
  const { isMobile } = useViewportLayout();
  const byId = new Map(collections.map(col => [col.id, col]));

  return (
    <div style={{ borderTop: `1px solid ${c.sideBdr}`, marginTop: 4 }} data-k108-smart-collections>
      <div className="bseclbl" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>{t('knSmartCollections')}</span>
        {activeCollectionId && (
          <button
            type="button"
            onClick={onClearActive}
            className="btbtn"
            style={{ padding: '0 2px', fontSize: 9, color: c.textMuted }}
            title={t('knClearCollectionActive')}
          >
            <X size={10} />
          </button>
        )}
      </div>

      {SMART_COLLECTION_GROUPS.map(group => {
        const resolve = (ids: readonly SmartCollectionId[]) => ids
          .map(id => byId.get(id))
          .filter((col): col is SmartCollection => col !== undefined);
        const primaryCollections = resolve(group.primaryCollectionIds);
        const secondaryCollections = resolve(group.secondaryCollectionIds);
        if (primaryCollections.length === 0 && secondaryCollections.length === 0) return null;
        return (
          <GroupSection
            key={group.id}
            c={c}
            groupId={group.id}
            groupLabel={resolveSmartCollectionGroupLabel(group.id, group.label, t)}
            GroupIcon={group.icon}
            primaryCollections={primaryCollections}
            secondaryCollections={secondaryCollections}
            activeCollectionId={activeCollectionId}
            counts={counts}
            onActivate={onActivate}
            isPinned={isPinned}
            onTogglePin={onTogglePin}
            isMobile={isMobile}
          />
        );
      })}
    </div>
  );
}
