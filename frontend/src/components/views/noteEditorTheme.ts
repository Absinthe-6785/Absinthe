import type { AppSettings } from '../../types';
import type { BlockEditorColors } from './BlockEditor';

export const NOTE_FONT_OPTIONS = [
  { id: 'system', label: 'System', value: "system-ui, -apple-system, 'Segoe UI', sans-serif" },
  { id: 'inter',  label: 'Inter',  value: "'Inter', system-ui, sans-serif" },
  { id: 'serif',  label: 'Serif',  value: "Georgia, 'Iowan Old Style', 'Times New Roman', serif" },
  { id: 'mono',   label: 'Mono',   value: "'JetBrains Mono', 'Fira Code', ui-monospace, monospace" },
] as const;

export const NOTE_DOCUMENT_MAX_WIDTH = 720;

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

/** Obsidian-inspired neutrals + violet accent (no yellow focus) */
export function buildObsidianChrome(dark: boolean, settings: AppSettings): NoteChromeColors {
  const base: NoteChromeColors = dark
    ? {
        wrap: '#1e1e1e', sidebar: '#262626', sideBdr: '#333333', notelist: '#1a1a1a',
        editor: '#1e1e1e', toolbar: '#262626', toolBdr: '#3a3a3a',
        card: '#2a2a2a', cardHov: '#333333', cardAct: '#2d2b3f', cardActBdr: '#7f6df2',
        text: '#dcddde', textMuted: '#999999', textFaint: '#666666',
        accent: '#7f6df2', accentBg: '#7f6df218',
        input: '#2a2a2a', inputBdr: '#404040',
        badge: '#7f6df220', badgeTxt: '#a89bfa',
        tag: '#7f6df218', tagTxt: '#a89bfa',
        danger: '#e06c75', green: '#7fd99a',
      }
    : {
        wrap: '#f7f7f5', sidebar: '#f2f2f0', sideBdr: '#e3e3e0', notelist: '#ececea',
        editor: '#ffffff', toolbar: '#f5f5f3', toolBdr: '#e0e0dc',
        card: '#ffffff', cardHov: '#f0f0ee', cardAct: '#f3f1ff', cardActBdr: '#7c3aed',
        text: '#2e3338', textMuted: '#5c6370', textFaint: '#a0a4ab',
        accent: '#7c3aed', accentBg: '#7c3aed14',
        input: '#fafafa', inputBdr: '#d8d8d4',
        badge: '#7c3aed14', badgeTxt: '#6d28d9',
        tag: '#7c3aed12', tagTxt: '#6d28d9',
        danger: '#dc2626', green: '#15803d',
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
    toggleBg: dark ? '#262626' : '#f5f5f3',
    quoteBdr: dark ? '#555555' : '#d0d0cc',
    selection: dark ? '#ffffff08' : '#00000006',
    blockFocusBg: dark ? '#ffffff06' : '#00000004',
    blockFocusBorder: dark ? '#555555' : '#d8d8d4',
    searchHlBg: dark ? '#3d3860' : '#e8e4ff',
    searchHlColor: dark ? '#e2e0f0' : '#3b3566',
    linkColor: accent,
    fontFamily,
    fontSize,
    documentMaxWidth: NOTE_DOCUMENT_MAX_WIDTH,
  };
}
