import { describe, expect, it } from 'vitest';
import { isValidImageUrl } from './blockUtils';
import {
  clampImageWidth,
  IMAGE_MAX_WIDTH,
  IMAGE_MIN_WIDTH,
} from './imageBlockUtils';
import type { BlockEditorColors } from './editorTypes';
import { imgBtnStyle } from './imageBlockUtils';

const c: BlockEditorColors = {
  bg: '#fff', text: '#111', textMuted: '#666', textFaint: '#999',
  accent: '#8B5CF6', accentBg: '#eee', border: '#ddd', card: '#fff',
  cardHov: '#f5f5f5', input: '#fff', inputBdr: '#ccc', toolbar: '#f9f9f9',
  danger: '#f00', green: '#0f0', codeBg: '#f1f5f9', calloutBg: '#fafafa',
  toggleBg: 'transparent', quoteBdr: '#ccc', selection: '#eef',
};

describe('imageBlockUtils', () => {
  it('clampImageWidth respects min and max', () => {
    expect(clampImageWidth(300, -500)).toBe(IMAGE_MIN_WIDTH);
    expect(clampImageWidth(300, 800)).toBe(IMAGE_MAX_WIDTH);
    expect(clampImageWidth(200, 50)).toBe(250);
  });

  it('imgBtnStyle danger variant uses danger color', () => {
    const style = imgBtnStyle(c, true);
    expect(style.color).toBe(c.danger);
    expect(style.border).toContain(c.danger);
  });

  it('isValidImageUrl accepts https and data URLs', () => {
    expect(isValidImageUrl('https://example.com/a.png')).toBe(true);
    expect(isValidImageUrl('data:image/png;base64,abc')).toBe(true);
    expect(isValidImageUrl('javascript:alert(1)')).toBe(false);
  });
});
