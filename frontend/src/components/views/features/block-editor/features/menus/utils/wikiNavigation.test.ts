import { describe, expect, it } from 'vitest';
import {
  buildWikiInsertText,
  detectWikiQuery,
  findWikiLinkAtOffset,
} from './wikiNavigation';

describe('wikiNavigation', () => {
  it('detectWikiQuery finds open bracket query', () => {
    expect(detectWikiQuery('hello [[Not')).toBe('Not');
    expect(detectWikiQuery('hello [[Note]]')).toBeNull();
  });

  it('buildWikiInsertText replaces partial wiki', () => {
    const r = buildWikiInsertText('ab [[No', 7, 'Note');
    expect(r?.newText).toBe('ab [[Note]]');
    expect(r?.caret).toBe(11);
  });

  it('findWikiLinkAtOffset', () => {
    const text = 'see [[My Note]] here';
    expect(findWikiLinkAtOffset(text, 8)).toBe('My Note');
    expect(findWikiLinkAtOffset(text, 0)).toBeNull();
  });
});
