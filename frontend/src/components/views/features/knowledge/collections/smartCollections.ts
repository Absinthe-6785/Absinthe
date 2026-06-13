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
  {
    id: 'research-sources',
    name: 'Sources',
    description: 'Notes classified as source material (noteKind: source).',
  },
  {
    id: 'research-literature',
    name: 'Literature Notes',
    description: 'Processed literature notes (noteKind: literature).',
  },
  {
    id: 'research-permanent',
    name: 'Permanent Notes',
    description: 'Permanent knowledge notes (noteKind: permanent).',
  },
  {
    id: 'exam-study-notes',
    name: 'Study Notes',
    description: 'Structured study notes (#study tag).',
  },
  {
    id: 'exam-weak-topics',
    name: 'Weak Topics',
    description: 'Notes flagged as needing extra review.',
  },
  {
    id: 'exam-review-notes',
    name: 'Review Notes',
    description: 'Notes tagged for review or containing question blocks.',
  },
  {
    id: 'exam-prep',
    name: 'Exam Prep',
    description: 'Notes tagged for exam preparation (#exam-prep).',
  },
  {
    id: 'map-concepts',
    name: 'Concept Notes',
    description: 'Notes classified as concepts (noteKind: concept).',
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
