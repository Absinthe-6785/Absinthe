import {
  ACTION_SIZE_LG,
  ACTION_SIZE_MD,
  ACTION_SIZE_SM,
  ICON_SIZE_LG,
  ICON_SIZE_MD,
  ICON_SIZE_SM,
} from './actionTokens';
import { TOUCH_TARGET_MIN_PX } from '../lib/responsiveLayout';

/** K-99 — Small / Medium / Large button presets for consistent chrome. */
export type ButtonPresetSize = 'sm' | 'md' | 'lg';

export interface ButtonPresetSpec {
  size: ButtonPresetSize;
  desktopBoxPx: number;
  mobileBoxPx: number;
  iconPx: number;
  minTapPx: number;
  borderRadiusPx: number;
  iconGapPx: number;
}

export const K99_BUTTON_PRESETS: Record<ButtonPresetSize, ButtonPresetSpec> = {
  sm: {
    size: 'sm',
    desktopBoxPx: ACTION_SIZE_SM,
    mobileBoxPx: TOUCH_TARGET_MIN_PX,
    iconPx: ICON_SIZE_SM,
    minTapPx: TOUCH_TARGET_MIN_PX,
    borderRadiusPx: 6,
    iconGapPx: 4,
  },
  md: {
    size: 'md',
    desktopBoxPx: ACTION_SIZE_MD,
    mobileBoxPx: TOUCH_TARGET_MIN_PX,
    iconPx: ICON_SIZE_MD,
    minTapPx: TOUCH_TARGET_MIN_PX,
    borderRadiusPx: 8,
    iconGapPx: 6,
  },
  lg: {
    size: 'lg',
    desktopBoxPx: ACTION_SIZE_LG,
    mobileBoxPx: TOUCH_TARGET_MIN_PX,
    iconPx: ICON_SIZE_LG,
    minTapPx: TOUCH_TARGET_MIN_PX,
    borderRadiusPx: 10,
    iconGapPx: 8,
  },
};

export function resolveButtonBoxPx(preset: ButtonPresetSize, compactChrome: boolean): number {
  const spec = K99_BUTTON_PRESETS[preset];
  return compactChrome ? spec.mobileBoxPx : spec.desktopBoxPx;
}
