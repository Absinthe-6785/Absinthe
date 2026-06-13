import { describe, it, expect } from 'vitest';
import type { NoteBase } from '../../../noteUtils';
import {
  slugifyLearningPathId,
  buildLearningPathMovePatches,
  buildLearningPathNormalizePatches,
  buildLearningPathRenamePatches,
  nextLearningPathStep,
} from './learningPathEditor';

function note(id: string, props: Record<string, string>, title = id): NoteBase {
  return {
    id,
    title,
    body: '',
    updatedAt: 100,
    folderId: null,
    deletedAt: null,
    properties: props,
  };
}

describe('learningPathEditor', () => {
  it('slugifies path labels', () => {
    expect(slugifyLearningPathId('Meiji Era')).toBe('meiji-era');
  });

  it('moves steps up and down', () => {
    const notes = [
      note('a', { learningPath: 'test', learningPathStep: '1' }, 'A'),
      note('b', { learningPath: 'test', learningPathStep: '2' }, 'B'),
    ];
    const patches = buildLearningPathMovePatches(notes, 'test', 'b', 'up');
    expect(patches.get('a')?.learningPathStep).toBe('2');
    expect(patches.get('b')?.learningPathStep).toBe('1');
  });

  it('normalizes step numbers', () => {
    const notes = [
      note('a', { learningPath: 'test', learningPathStep: '3' }),
      note('b', { learningPath: 'test', learningPathStep: '1' }),
    ];
    const patches = buildLearningPathNormalizePatches(notes, 'test');
    expect(patches.get('b')?.learningPathStep).toBe('1');
    expect(patches.get('a')?.learningPathStep).toBe('2');
  });

  it('renames path ids across notes', () => {
    const notes = [note('a', { learningPath: 'old', learningPathStep: '1' })];
    const patches = buildLearningPathRenamePatches(notes, 'old', 'new-path');
    expect(patches.get('a')?.learningPath).toBe('new-path');
  });

  it('computes next step number', () => {
    const notes = [
      note('a', { learningPath: 'test', learningPathStep: '1' }),
      note('b', { learningPath: 'test', learningPathStep: '2' }),
    ];
    expect(nextLearningPathStep(notes, 'test')).toBe(3);
  });
});
