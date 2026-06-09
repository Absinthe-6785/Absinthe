import type { SmartCollection, SmartCollectionId } from './smartCollectionModels';

/** Phase 1 system-defined smart collections */
export const SMART_COLLECTIONS: readonly SmartCollection[] = [
  {
    id: 'recent',
    name: 'Recent Notes',
    description: 'All notes ordered by most recently updated.',
  },
  {
    id: 'orphan',
    name: 'Orphan Notes',
    description: 'Notes with no wiki backlinks and no unlinked mentions.',
  },
  {
    id: 'untagged',
    name: 'Untagged Notes',
    description: 'Notes with no indexed tags.',
  },
  {
    id: 'highly-connected',
    name: 'Highly Connected',
    description: 'Notes with strong relationship counts from backlinks, mentions, and related notes.',
  },
  {
    id: 'with-backlinks',
    name: 'With Backlinks',
    description: 'Notes with incoming or outgoing wiki links.',
  },
  {
    id: 'with-mentions',
    name: 'With Mentions',
    description: 'Notes with incoming or outgoing unlinked mentions.',
  },
];

export function findSmartCollection(id: string): SmartCollection | undefined {
  return SMART_COLLECTIONS.find(collection => collection.id === id);
}

export function isSmartCollectionId(id: string): id is SmartCollectionId {
  return SMART_COLLECTIONS.some(collection => collection.id === id);
}

/** Activate a smart collection — returns its id for sidebar state */
export function activateSmartCollection(collection: SmartCollection): SmartCollectionId {
  return collection.id;
}
