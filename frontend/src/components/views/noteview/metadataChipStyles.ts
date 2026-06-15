import type { CSSProperties } from 'react';
import type { NoteChromeColors } from '../noteEditorTheme';

/** K-84/K-85 unified 24px metadata chip system. */
export const METADATA_CHIP_HEIGHT = 24;

export function metadataChipStyle(
  c: NoteChromeColors,
  opts?: { accent?: boolean; danger?: boolean },
): CSSProperties {
  const accent = opts?.accent ?? false;
  const danger = opts?.danger ?? false;
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    height: METADATA_CHIP_HEIGHT,
    padding: '0 8px',
    fontSize: 10,
    lineHeight: 1,
    borderRadius: 999,
    border: `1px solid ${danger ? c.danger : accent ? c.accent : c.sideBdr}`,
    background: danger ? `${c.danger}22` : accent ? c.accentBg : c.cardHov,
    color: danger ? c.danger : accent ? c.accent : c.textMuted,
    boxSizing: 'border-box',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  };
}

export const EDITOR_TOOLBAR_BTN_SIZE = 24;
export const EDITOR_TOOLBAR_GAP = 6;

export function editorToolbarButtonStyle(c: NoteChromeColors): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: EDITOR_TOOLBAR_BTN_SIZE,
    height: EDITOR_TOOLBAR_BTN_SIZE,
    padding: 0,
    borderRadius: 6,
    border: `1px solid ${c.toolBdr}`,
    background: c.card,
    color: c.textMuted,
    flexShrink: 0,
    cursor: 'pointer',
    boxSizing: 'border-box',
  };
}
