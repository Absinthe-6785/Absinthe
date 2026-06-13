import { describe, expect, it } from 'vitest';
import { makeBlock } from './blockUtils';
import { shouldHideBlockInReadingMode } from './readingModeVisibility';

describe('shouldHideBlockInReadingMode', () => {
  it('hides empty text blocks', () => {
    expect(shouldHideBlockInReadingMode(makeBlock('paragraph'))).toBe(true);
    expect(shouldHideBlockInReadingMode(makeBlock('heading2'))).toBe(true);
    expect(shouldHideBlockInReadingMode(makeBlock('bullet'))).toBe(true);
  });

  it('keeps blocks with content', () => {
    expect(shouldHideBlockInReadingMode({ ...makeBlock('paragraph'), content: 'Hello' })).toBe(false);
  });

  it('hides empty toggles without children', () => {
    expect(shouldHideBlockInReadingMode(makeBlock('toggle'))).toBe(true);
    expect(shouldHideBlockInReadingMode({
      ...makeBlock('toggle'),
      children: [makeBlock('paragraph', { content: 'nested' })],
    })).toBe(false);
  });

  it('hides empty unchecked todos', () => {
    expect(shouldHideBlockInReadingMode(makeBlock('todo'))).toBe(true);
    expect(shouldHideBlockInReadingMode({ ...makeBlock('todo'), checked: true })).toBe(false);
  });
});
