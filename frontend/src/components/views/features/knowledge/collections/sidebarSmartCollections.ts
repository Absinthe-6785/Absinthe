/**
 * K-116 — Sidebar smart collection filter (no auto subject workspaces).
 */
import { SMART_COLLECTIONS } from './smartCollections';
import type { SmartCollection, SmartCollectionId } from './smartCollectionModels';

export const SUBJECT_SMART_COLLECTION_PREFIX = 'subject-' as const;

export function isSubjectSmartCollectionId(id: string): boolean {
  return id.startsWith(SUBJECT_SMART_COLLECTION_PREFIX);
}

/** Subject presets stay in registry for pinned refs; hidden from sidebar unless pinned. */
export function filterSidebarSmartCollections(
  collections: readonly SmartCollection[],
  pinnedIds: ReadonlySet<string>,
): SmartCollection[] {
  return collections.filter(col => {
    if (!isSubjectSmartCollectionId(col.id)) return true;
    return pinnedIds.has(col.id);
  });
}

export function sidebarSmartCollectionPinnedIds(
  pinned: ReadonlyArray<{ kind: string; id: string }>,
): Set<string> {
  const ids = new Set<string>();
  for (const ref of pinned) {
    if (ref.kind === 'smart-collection') ids.add(ref.id);
  }
  return ids;
}

export function getSidebarSmartCollections(
  pinned: ReadonlyArray<{ kind: string; id: string }>,
): readonly SmartCollection[] {
  const pinnedIds = sidebarSmartCollectionPinnedIds(pinned);
  return filterSidebarSmartCollections(SMART_COLLECTIONS, pinnedIds);
}

export type { SmartCollectionId };
