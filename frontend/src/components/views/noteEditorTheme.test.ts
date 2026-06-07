import { describe, expect, it } from 'vitest';
import { buildBlockEditorColors } from './noteEditorTheme';
import type { AppSettings } from '../../types';

const baseSettings = {
  notesFontFamily: 'system',
  notesFontSize: 16,
} as AppSettings;

const chrome = {
  editor: '#0E0E10',
  text: '#fff',
  textMuted: '#aaa',
  textFaint: '#666',
  accent: '#8B5CF6',
  accentBg: 'rgba(139,92,246,0.1)',
  sideBdr: '#333',
  card: '#1B1B1F',
  cardHov: '#222',
  input: '#1B1B1F',
  inputBdr: '#333',
  toolbar: '#1B1B1F',
  danger: '#f00',
  green: '#0f0',
};

describe('noteEditorTheme dark toggle polish', () => {
  it('dark toggleBg is transparent', () => {
    const c = buildBlockEditorColors(chrome, true, baseSettings);
    expect(c.toggleBg).toBe('transparent');
  });

  it('dark blockSelectedBg uses purple tint', () => {
    const c = buildBlockEditorColors(chrome, true, baseSettings);
    expect(c.blockSelectedBg).toContain('139,92,246');
  });
});
