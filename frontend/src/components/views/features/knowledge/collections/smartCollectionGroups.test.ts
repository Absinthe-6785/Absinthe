import { describe, it, expect } from 'vitest';
import { SMART_COLLECTIONS } from './smartCollections';
import {
  SMART_COLLECTION_GROUPS,
  isPrimarySmartCollection,
  isSecondarySmartCollection,
  PRIMARY_COLLECTION_GROUP_IDS,
} from './smartCollectionGroups';

describe('smartCollectionGroups K-30.50', () => {
  it('covers every smart collection exactly once', () => {
    const grouped = SMART_COLLECTION_GROUPS.flatMap(g => g.collectionIds);
    const all = SMART_COLLECTIONS.map(c => c.id);
    expect(grouped.sort()).toEqual([...all].sort());
    expect(new Set(grouped).size).toBe(all.length);
  });

  it('splits primary and secondary without overlap within groups', () => {
    for (const group of SMART_COLLECTION_GROUPS) {
      const primary = new Set(group.primaryCollectionIds);
      const secondary = new Set(group.secondaryCollectionIds);
      for (const id of primary) {
        expect(group.collectionIds).toContain(id);
        expect(secondary.has(id)).toBe(false);
      }
      for (const id of secondary) {
        expect(group.collectionIds).toContain(id);
        expect(primary.has(id)).toBe(false);
      }
      expect(primary.size + secondary.size).toBe(group.collectionIds.length);
    }
  });

  it('exposes five primary collection categories', () => {
    expect(PRIMARY_COLLECTION_GROUP_IDS).toEqual([
      'knowledge',
      'study',
      'projects',
      'subjects',
      'insights',
    ]);
  });

  it('classifies primary and secondary collections', () => {
    expect(isPrimarySmartCollection('exam-study-notes')).toBe(true);
    expect(isSecondarySmartCollection('exam-prep')).toBe(true);
    expect(isPrimarySmartCollection('exam-prep')).toBe(false);
  });
});
