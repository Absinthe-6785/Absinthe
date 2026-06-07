import { describe, expect, it } from 'vitest';
import { blockShellClassName } from './EditorChrome';
import { shouldShowBlockChrome } from './editorReading';

describe('editorChrome', () => {
  it('blockShellClassName includes active and selected', () => {
    expect(blockShellClassName(true, true, false)).toContain('be-block-active');
    expect(blockShellClassName(true, true, false)).toContain('be-block-selected');
  });

  it('shouldShowBlockChrome hidden in reading mode', () => {
    expect(shouldShowBlockChrome(true)).toBe(false);
    expect(shouldShowBlockChrome(false)).toBe(true);
  });

  it('controls visible class', () => {
    expect(blockShellClassName(false, false, true)).toContain('be-controls-visible');
  });
});
