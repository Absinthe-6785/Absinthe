import { BLOCK_LEFT_SELECT_ZONE_PX } from './blockGutterSelection';

/** K-106 — Block selection / drag handle audit. */
export const K106_BLOCK_SELECTION = {
  leftSelectZonePx: BLOCK_LEFT_SELECT_ZONE_PX,
  gripHitSlopPx: 8,
  gutterStripInset: '-6px -10px',
} as const;

export function auditBlockSelection(): typeof K106_BLOCK_SELECTION {
  return K106_BLOCK_SELECTION;
}
