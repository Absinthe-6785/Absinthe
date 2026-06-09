import { describe, it, expect } from 'vitest';
import {
  isRelationEdge,
  isRelationRecord,
  type RelationEdge,
  type RelationRollupConfig,
} from './relationModels';

describe('relationModels', () => {
  it('narrows valid relation edges', () => {
    const edge: RelationEdge = {
      sourceId: 'lecture-1',
      targetId: 'course-1',
      propertyKey: 'course',
    };
    expect(isRelationEdge(edge)).toBe(true);
    expect(isRelationEdge({ sourceId: 'a', targetId: 'b' })).toBe(false);
  });

  it('narrows valid relation records', () => {
    expect(isRelationRecord({ propertyKey: 'course', targetId: 'course-1' })).toBe(true);
    expect(isRelationRecord({ propertyKey: 'course' })).toBe(false);
  });

  it('documents rollup config shape', () => {
    const config: RelationRollupConfig = {
      relationKey: 'lecture',
      aggregate: 'count',
    };
    expect(config.aggregate).toBe('count');
  });
});
