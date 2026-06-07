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

/** Purple-forward note chrome — primary #8B5CF6, off-white surfaces */
export function buildNoteChrome(dark: boolean, settings: AppSettings): NoteChromeColors {
  const base: NoteChromeColors = dark
    ? {
        wrap: '#18181B', sidebar: '#1f1f23', sideBdr: '#2e2e33', notelist: '#1a1a1e',
        editor: '#1f1f23', toolbar: '#27272a', toolBdr: '#3f3f46',
        card: '#27272a', cardHov: '#323238', cardAct: '#2e2640', cardActBdr: '#8B5CF6',
        text: '#fafafa', textMuted: '#a1a1aa', textFaint: '#71717A',
        accent: '#8B5CF6', accentBg: 'rgba(139,92,246,0.14)',
        input: '#27272a', inputBdr: '#3f3f46',
        badge: 'rgba(139,92,246,0.2)', badgeTxt: '#A78BFA',
        tag: 'rgba(139,92,246,0.14)', tagTxt: '#A78BFA',
        danger: '#f87171', green: '#4ade80',
      }
    : {
        wrap: '#F7F7F8', sidebar: '#F0F0F2', sideBdr: '#E4E4E7', notelist: '#ECECEF',
        editor: '#FFFFFF', toolbar: '#F7F7F8', toolBdr: '#E4E4E7',
        card: '#FFFFFF', cardHov: '#F4F4F5', cardAct: 'rgba(139,92,246,0.06)', cardActBdr: '#8B5CF6',
        text: '#18181B', textMuted: '#71717A', textFaint: '#A1A1AA',
        accent: '#8B5CF6', accentBg: 'rgba(139,92,246,0.08)',
        input: '#FAFAFA', inputBdr: '#E4E4E7',
        badge: 'rgba(139,92,246,0.1)', badgeTxt: '#7C3AED',
        tag: 'rgba(139,92,246,0.08)', tagTxt: '#7C3AED',
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
    selection: dark ? 'rgba(255,255,255,0.04)' : 'rgba(139,92,246,0.04)',
    blockFocusBg: dark ? 'rgba(139,92,246,0.08)' : 'rgba(139,92,246,0.04)',
    blockFocusBorder: dark ? 'rgba(139,92,246,0.35)' : 'rgba(139,92,246,0.25)',
    blockSelectedBg: dark ? 'rgba(139,92,246,0.06)' : 'rgba(139,92,246,0.03)',
    toolbarActiveFg: '#FFFFFF',
    searchHlBg: dark ? 'rgba(139,92,246,0.22)' : 'rgba(139,92,246,0.12)',
    searchHlColor: dark ? '#E9E0FF' : '#5B21B6',
    linkColor: accent,
    fontFamily,
    fontSize,
    documentMaxWidth: NOTE_DOCUMENT_MAX_WIDTH,
  };
}
