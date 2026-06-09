import { describe, expect, it } from 'vitest';
import { makeBlock } from '../../../blockUtils';
import {
  isEmptyDocument,
  multiSelectHintText,
  EMPTY_DOC_HINT_LINES,
} from './editorDiscoverability';

describe('editorDiscoverability', () => {
  it('isEmptyDocument true for single empty paragraph', () => {
    expect(isEmptyDocument([makeBlock('paragraph')])).toBe(true);
  });

  it('isEmptyDocument false when content exists', () => {
    expect(isEmptyDocument([makeBlock('paragraph', { content: 'Hi' })])).toBe(false);
  });

  it('isEmptyDocument false for multiple blocks', () => {
    expect(isEmptyDocument([
      makeBlock('paragraph'),
      makeBlock('paragraph', { content: 'x' }),
    ])).toBe(false);
  });

  it('multiSelectHintText includes count and shortcuts', () => {
    const text = multiSelectHintText(3);
    expect(text).toContain('3 blocks selected');
    expect(text).toContain('Shift+click');
    expect(text).toContain('Esc');
  });

  it('empty doc hints cover slash, paste, and drag', () => {
    const joined = EMPTY_DOC_HINT_LINES.join(' ');
    expect(joined).toContain("/");
    expect(joined.toLowerCase()).toContain('paste');
    expect(joined.toLowerCase()).toContain('drag');
  });
});
