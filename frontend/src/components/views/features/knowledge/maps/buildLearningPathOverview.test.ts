import { describe, it, expect } from 'vitest';
import { buildLearningPathOverview } from './buildLearningPathOverview';
import type { NoteBase } from '../../../noteUtils';

function note(id: string, partial: Partial<NoteBase> = {}): NoteBase {
  return {
    id,
    title: partial.title ?? id,
    body: partial.body ?? '',
    updatedAt: partial.updatedAt ?? 100,
    folderId: partial.folderId ?? null,
    deletedAt: partial.deletedAt ?? null,
    properties: partial.properties,
  };
}

describe('buildLearningPathOverview', () => {
  it('lists paths with step counts and current step', () => {
    const notes = [
      note('a', {
        title: 'Step One',
        properties: { learningPath: 'meiji-era', learningPathStep: '1' },
        updatedAt: 100,
      }),
      note('b', {
        title: 'Step Two',
        properties: { learningPath: 'meiji-era', learningPathStep: '2' },
        updatedAt: 200,
      }),
    ];
    const data = buildLearningPathOverview(notes);
    expect(data.totalPathCount).toBe(1);
    expect(data.paths[0]?.stepCount).toBe(2);
    expect(data.paths[0]?.currentStep?.noteTitle).toBe('Step Two');
  });

  it('returns empty overview when no paths exist', () => {
    const data = buildLearningPathOverview([]);
    expect(data.totalPathCount).toBe(0);
    expect(data.paths).toEqual([]);
  });
});
