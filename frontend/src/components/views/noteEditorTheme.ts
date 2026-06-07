import type { AppSettings } from '../../types';
import type { BlockEditorColors } from './editorTypes';
import { tokensForMode } from '../../theme/tokens';

export const NOTE_FONT_OPTIONS = [
  { id: 'system', label: 'System', value: "system-ui, -apple-system, 'Segoe UI', sans-serif" },
  { id: 'inter',  label: 'Inter',  value: "'Inter', system-ui, sans-serif" },
  { id: 'serif',  label: 'Serif',  value: "Georgia, 'Iowan Old Style', 'Times New Roman', serif" },
  { id: 'mono',   label: 'Mono',   value: "'JetBrains Mono', 'Fira Code', ui-monospace, monospace" },
] as const;

export const NOTE_DOCUMENT_MAX_WIDTH = 720;

/** Radius — aligned with global design tokens */
export const NOTE_RADIUS_BTN = 8;
export const NOTE_RADIUS_CARD = 12;
export const NOTE_RADIUS_MODAL = 16;

export interface NoteChromeColors {
  wrap: string;
  sidebar: string;
  sideBdr: string;
  notelist: string;
  editor: string;
  toolbar: string;
  toolBdr: string;
  card: string;
  cardHov: string;
  cardAct: string;
  cardActBdr: string;
  text: string;
  textMuted: string;
  textFaint: string;
  accent: string;
  accentBg: string;
  input: string;
  inputBdr: string;
  badge: string;
  badgeTxt: string;
  tag: string;
  tagTxt: string;
  danger: string;
  green: string;
}

/** Note chrome derived from Absinthe Design System tokens */
export function buildNoteChrome(dark: boolean, settings: AppSettings): NoteChromeColors {
  const t = tokensForMode(dark ? 'dark' : 'light');
  const c = t.colors;

  const base: NoteChromeColors = {
    wrap: c.background,
    sidebar: c.sidebar,
    sideBdr: c.border,
    notelist: dark ? '#16161A' : c.surfaceAlt,
    editor: c.surface,
    toolbar: c.surface,
    toolBdr: c.border,
    card: c.surface,
    cardHov: c.surfaceAlt,
    cardAct: dark ? 'rgba(139,92,246,0.12)' : 'rgba(139,92,246,0.06)',
    cardActBdr: c.primary,
    text: c.text,
    textMuted: c.muted,
    textFaint: dark ? '#71717A' : '#A8A29E',
    accent: c.primary,
    accentBg: c.accentBg,
    input: c.input,
    inputBdr: c.inputBorder,
    badge: dark ? 'rgba(139,92,246,0.2)' : 'rgba(139,92,246,0.1)',
    badgeTxt: dark ? '#A78BFA' : '#7C3AED',
    tag: c.accentBg,
    tagTxt: dark ? '#A78BFA' : '#7C3AED',
    danger: c.danger,
    green: c.success,
  };

  let result = { ...base };
  const textOverride = settings.notesTextColor?.trim();
  const accentOverride = settings.notesAccentColor?.trim();
  if (textOverride) result = { ...result, text: textOverride };
  if (accentOverride) {
    result = {
      ...result,
      accent: accentOverride,
      accentBg: `${accentOverride}18`,
      badge: `${accentOverride}20`,
      badgeTxt: accentOverride,
      tag: `${accentOverride}14`,
      tagTxt: accentOverride,
      cardActBdr: accentOverride,
    };
  }
  return result;
}

/** @deprecated Use buildNoteChrome */
export const buildObsidianChrome = buildNoteChrome;

export function resolveNoteFontFamily(settings: AppSettings): string {
  const id = settings.notesFontFamily ?? 'system';
  return NOTE_FONT_OPTIONS.find(o => o.id === id)?.value ?? NOTE_FONT_OPTIONS[0].value;
}

export function resolveNoteFontSize(settings: AppSettings): number {
  const n = settings.notesFontSize;
  return typeof n === 'number' && n >= 12 && n <= 24 ? n : 16;
}

export function buildBlockEditorColors(
  chrome: NoteChromeColors,
  dark: boolean,
  settings: AppSettings,
): BlockEditorColors {
  const t = tokensForMode(dark ? 'dark' : 'light');
  const fontFamily = resolveNoteFontFamily(settings);
  const fontSize = resolveNoteFontSize(settings);
  const accent = chrome.accent;

  return {
    bg: chrome.editor,
    text: chrome.text,
    textMuted: chrome.textMuted,
    textFaint: chrome.textFaint,
    accent,
    accentBg: chrome.accentBg,
    border: chrome.sideBdr,
    card: chrome.card,
    cardHov: chrome.cardHov,
    input: chrome.input,
    inputBdr: chrome.inputBdr,
    toolbar: chrome.toolbar,
    danger: chrome.danger,
    green: chrome.green,
    codeBg: dark ? '#2a2a2a' : '#f4f4f2',
    calloutBg: dark ? '#2a2838' : '#f6f4ff',
    toggleBg: dark ? 'transparent' : '#f5f5f3',
    quoteBdr: dark ? '#555555' : '#d0d0cc',
    selection: dark ? 'rgba(255,255,255,0.04)' : 'rgba(139,92,246,0.04)',
    blockFocusBg: dark ? 'rgba(139,92,246,0.06)' : 'rgba(139,92,246,0.04)',
    blockFocusBorder: 'transparent',
    blockSelectedBg: dark ? 'rgba(139,92,246,0.08)' : 'rgba(139,92,246,0.05)',
    blockHoverBg: 'transparent',
    toolbarActiveFg: t.colors.primaryForeground,
    radiusBtn: NOTE_RADIUS_BTN,
    radiusCard: NOTE_RADIUS_CARD,
    radiusModal: NOTE_RADIUS_MODAL,
    searchHlBg: dark ? 'rgba(139,92,246,0.22)' : 'rgba(139,92,246,0.12)',
    searchHlColor: dark ? '#E9E0FF' : '#5B21B6',
    linkColor: accent,
    fontFamily,
    fontSize,
    documentMaxWidth: NOTE_DOCUMENT_MAX_WIDTH,
    menuShadow: t.shadow.menu,
    isDark: dark,
  };
}
