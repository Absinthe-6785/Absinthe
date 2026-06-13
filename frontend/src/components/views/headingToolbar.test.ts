import { describe, expect, it } from 'vitest';
import { headingConvertTarget, toolbarHeadingLevel } from './headingToolbar';

describe('headingToolbar', () => {
  it('detects toggle heading levels', () => {
    expect(toolbarHeadingLevel('toggleHeading2')).toBe(2);
    expect(toolbarHeadingLevel('paragraph')).toBeNull();
  });

  it('preserves toggle heading family on convert', () => {
    expect(headingConvertTarget('toggleHeading2', 3)).toBe('toggleHeading3');
    expect(headingConvertTarget('heading2', 3)).toBe('heading3');
  });
});
