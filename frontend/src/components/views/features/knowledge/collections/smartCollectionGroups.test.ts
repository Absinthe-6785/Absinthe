import { describe, it, expect } from 'vitest';
import { SMART_COLLECTIONS } from './smartCollections';
import { SMART_COLLECTION_GROUPS } from './smartCollectionGroups';

describe('smartCollectionGroups', () => {
  it('covers every smart collection exactly once', () => {
    const grouped = SMART_COLLECTION_GROUPS.flatMap(g => g.collectionIds);
    const all = SMART_COLLECTIONS.map(c => c.id);
    expect(grouped.sort()).toEqual([...all].sort());
    expect(new Set(grouped).size).toBe(all.length);
  });

  it('uses Korean section labels', () => {
    const labels = SMART_COLLECTION_GROUPS.map(g => g.label);
    expect(labels).toContain('지식');
    expect(labels).toContain('학습');
    expect(labels).toContain('프로젝트');
    expect(labels).toContain('인사이트');
  });
});
