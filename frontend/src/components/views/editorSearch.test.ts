import { describe, expect, it } from 'vitest';
import { makeBlock } from './blockUtils';
import { collectEditorSearchMatches, shouldHighlightBlock } from './editorSearch';

describe('collectEditorSearchMatches', () => {
  it('finds matches across blocks', () => {
    const blocks = [
      makeBlock('paragraph', { id: 'a', content: 'hello world' }),
      makeBlock('paragraph', { id: 'b', content: 'hello again' }),
    ];
    const matches = collectEditorSearchMatches(blocks, 'hello');
    expect(matches).toHaveLength(2);
    expect(matches[0].blockId).toBe('a');
    expect(matches[1].blockId).toBe('b');
  });
});

describe('shouldHighlightBlock', () => {
  it('limits to active block in block scope', () => {
    expect(shouldHighlightBlock('block', 'a', 'a')).toBe(true);
    expect(shouldHighlightBlock('block', 'b', 'a')).toBe(false);
  });

  it('highlights all blocks in document scope', () => {
    expect(shouldHighlightBlock('document', 'b', 'a')).toBe(true);
  });
});
