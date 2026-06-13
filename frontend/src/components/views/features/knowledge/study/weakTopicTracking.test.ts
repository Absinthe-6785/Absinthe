import { describe, it, expect } from 'vitest';
import type { NoteBase } from '../../../noteUtils';
import { isWeakTopic, setWeakTopic } from './weakTopicTracking';

function note(id: string): NoteBase {
  return { id, title: id, body: '', updatedAt: 1, folderId: null, deletedAt: null };
}

describe('weakTopicTracking', () => {
  it('sets and clears weak topic flag', () => {
    const flagged = setWeakTopic(note('a'), true);
    expect(isWeakTopic(flagged)).toBe(true);
    const cleared = setWeakTopic(flagged, false);
    expect(isWeakTopic(cleared)).toBe(false);
  });
});
