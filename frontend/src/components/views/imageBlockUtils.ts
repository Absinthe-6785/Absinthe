import type { CSSProperties } from 'react';
import type { BlockEditorColors } from './editorTypes';

export const IMAGE_MIN_WIDTH = 80;
export const IMAGE_MAX_WIDTH = 900;

export function imgBtnStyle(c: BlockEditorColors, danger = false): CSSProperties {
  return {
    background: danger ? `${c.danger}15` : c.card,
    border: `1px solid ${danger ? c.danger + '50' : c.border}`,
    color: danger ? c.danger : c.text,
    borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', gap: 5, lineHeight: 1,
  };
}

export function imageDisplayStyle(
  c: BlockEditorColors,
  width?: number,
): CSSProperties {
  return {
    maxWidth: '100%',
    width: width ? width : 'auto',
    borderRadius: 8,
    border: `1px solid ${c.border}`,
    display: 'block',
    margin: '0 auto',
  };
}

/** Clamp resized image width between min and max */
export function clampImageWidth(startW: number, deltaX: number): number {
  return Math.max(IMAGE_MIN_WIDTH, Math.min(IMAGE_MAX_WIDTH, Math.round(startW + deltaX)));
}
