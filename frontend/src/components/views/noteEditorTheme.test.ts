import { describe, expect, it } from 'vitest';
import {
  buildBlockEditorColors,
  buildNoteChrome,
  resolveNoteFontFamily,
  resolveNoteFontSize,
} from './noteEditorTheme';
import type { AppSettings } from '../../types';
import { DARK_TOKENS, LIGHT_TOKENS } from '../../theme/tokens';

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

type Rgb = readonly [number, number, number];

function hexToRgb(value: string): Rgb {
  const normalized = value.slice(1);
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ];
}

function compositeRgba(value: string, background: string): Rgb {
  const match = value.match(/^rgba\((\d+),(\d+),(\d+),([\d.]+)\)$/);
  if (!match) throw new Error(`Expected rgba color, received ${value}`);
  const foreground = match.slice(1, 4).map(Number) as unknown as Rgb;
  const alpha = Number(match[4]);
  const base = hexToRgb(background);
  return foreground.map((channel, index) => (
    channel * alpha + base[index] * (1 - alpha)
  )) as unknown as Rgb;
}

function relativeLuminance(rgb: Rgb): number {
  const [r, g, b] = rgb.map(channel => {
    const normalized = channel / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(foreground: string, background: Rgb): number {
  const foregroundLuminance = relativeLuminance(hexToRgb(foreground));
  const backgroundLuminance = relativeLuminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

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

describe('Notes semantic theme bridge', () => {
  it.each([
    ['light', false, LIGHT_TOKENS],
    ['dark', true, DARK_TOKENS],
  ] as const)('maps %s global tokens into explicit Notes roles', (mode, dark, tokens) => {
    const bridge = buildNoteChrome(dark, baseSettings);

    expect(bridge.mode).toBe(mode);
    expect(bridge.semantic).toEqual({
      workspace: tokens.colors.background,
      surface: tokens.colors.surface,
      surfaceElevated: tokens.colors.surfaceElevated,
      surfaceMuted: tokens.colors.surfaceMuted,
      border: tokens.colors.border,
      selected: tokens.colors.primary,
      selectedSurface: tokens.colors.accentBg,
      text: tokens.colors.text,
      mutedText: tokens.colors.mutedForeground,
      faintText: tokens.colors.sidebarMuted,
      input: tokens.colors.input,
      inputBorder: tokens.colors.inputBorder,
      focus: tokens.colors.focus,
      disabled: tokens.colors.disabled,
      warning: tokens.colors.warning,
      danger: tokens.colors.danger,
      success: tokens.colors.success,
    });
    expect(bridge.decorative).toEqual({
      orbit: tokens.cosmosDecorative.orbit,
      paleBlueDot: tokens.cosmosDecorative.paleBlueDot,
    });
  });

  it('preserves Notes text/accent overrides without hijacking safety semantics', () => {
    const settings = {
      ...baseSettings,
      notesTextColor: '  #123456  ',
      notesAccentColor: '  #654321  ',
    } as AppSettings;
    const bridge = buildNoteChrome(false, settings);

    expect(bridge.text).toBe('#123456');
    expect(bridge.semantic.text).toBe('#123456');
    expect(bridge.accent).toBe('#654321');
    expect(bridge.semantic.selected).toBe('#654321');
    expect(bridge.semantic.selectedSurface).toBe('#65432118');
    expect(bridge.semantic.danger).toBe(LIGHT_TOKENS.colors.danger);
    expect(bridge.semantic.success).toBe(LIGHT_TOKENS.colors.success);
    expect(bridge.semantic.warning).toBe(LIGHT_TOKENS.colors.warning);
    expect(bridge.semantic.focus).toBe(LIGHT_TOKENS.colors.focus);
    expect(bridge.semantic.disabled).toBe(LIGHT_TOKENS.colors.disabled);
    expect(bridge.decorative).toEqual({
      orbit: LIGHT_TOKENS.cosmosDecorative.orbit,
      paleBlueDot: LIGHT_TOKENS.cosmosDecorative.paleBlueDot,
    });
  });

  it('preserves font family and bounded font-size behavior in the same bridge', () => {
    const settings = {
      ...baseSettings,
      notesFontFamily: 'serif',
      notesFontSize: 19,
    } as AppSettings;
    const bridge = buildNoteChrome(false, settings);

    expect(bridge.typography).toEqual({
      fontFamily: resolveNoteFontFamily(settings),
      fontSize: resolveNoteFontSize(settings),
    });
    expect(bridge.typography.fontFamily).toContain('Georgia');
    expect(bridge.typography.fontSize).toBe(19);
    expect(resolveNoteFontSize({ ...settings, notesFontSize: 25 })).toBe(16);
  });

  it('is deterministic for identical mode and settings input', () => {
    const settings = {
      ...baseSettings,
      notesTextColor: '#223344',
      notesAccentColor: '#665544',
      notesFontFamily: 'mono',
      notesFontSize: 15,
    } as AppSettings;

    expect(buildNoteChrome(true, settings)).toEqual(buildNoteChrome(true, settings));
  });

  it.each([
    [false, LIGHT_TOKENS],
    [true, DARK_TOKENS],
  ] as const)('keeps pilot small copy above 4.5:1 in mode dark=%s', (dark, tokens) => {
    const bridge = buildNoteChrome(dark, baseSettings);
    const smallText = dark ? bridge.semantic.mutedText : bridge.semantic.text;
    const backgrounds = [
      hexToRgb(bridge.semantic.surfaceElevated),
      hexToRgb(bridge.semantic.surfaceMuted),
      compositeRgba(bridge.semantic.selectedSurface, bridge.semantic.surfaceElevated),
    ];

    expect(bridge.semantic.surfaceElevated).toBe(tokens.colors.surfaceElevated);
    expect(Math.min(...backgrounds.map(background => contrastRatio(smallText, background))))
      .toBeGreaterThanOrEqual(4.5);
  });
});
