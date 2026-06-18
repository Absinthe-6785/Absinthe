/**
 * K-99 — Responsive button & toolbar audit.
 */
import { K99_BUTTON_PRESETS, type ButtonPresetSize } from '@/theme/k99ButtonPresets';
import { TOUCH_TARGET_MIN_PX, VIEWPORT_BREAKPOINTS } from '@/lib/responsiveLayout';

export const K99_BUTTON_SIZES = ['sm', 'md', 'lg'] as const satisfies readonly ButtonPresetSize[];

export const K99_RESPONSIVE_WIDTHS = [320, 375, 768, 1024] as const;

export const K99_TOOLBAR_FEATURES = [
  'wrap-on-narrow',
  'more-menu-overflow',
  'min-touch-target',
  'icon-gap-consistent',
] as const;

export interface K99ButtonPresetRow {
  preset: ButtonPresetSize;
  desktopPx: number;
  mobilePx: number;
  iconPx: number;
  meetsTouchMin: boolean;
  hasFocusVisible: boolean;
}

export interface K99ToolbarRow {
  viewportPx: number;
  wrapsToolbar: boolean;
  hasMoreMenu: boolean;
  minTapPx: number;
}

export function auditButtonPresets(): K99ButtonPresetRow[] {
  return K99_BUTTON_SIZES.map(preset => {
    const spec = K99_BUTTON_PRESETS[preset];
    return {
      preset,
      desktopPx: spec.desktopBoxPx,
      mobilePx: spec.mobileBoxPx,
      iconPx: spec.iconPx,
      meetsTouchMin: spec.mobileBoxPx >= TOUCH_TARGET_MIN_PX,
      hasFocusVisible: true,
    };
  });
}

export function auditToolbarAtWidth(viewportPx: number): K99ToolbarRow {
  const isMobile = viewportPx < VIEWPORT_BREAKPOINTS.mobile;
  const isNarrow = viewportPx < VIEWPORT_BREAKPOINTS.narrow;
  return {
    viewportPx,
    wrapsToolbar: isNarrow,
    hasMoreMenu: isMobile || isNarrow,
    minTapPx: isMobile ? TOUCH_TARGET_MIN_PX : K99_BUTTON_PRESETS.md.desktopBoxPx,
  };
}

export function auditResponsiveMatrix(): K99ToolbarRow[] {
  return K99_RESPONSIVE_WIDTHS.map(auditToolbarAtWidth);
}

export function formatK99ResponsiveUiReport(
  buttons: readonly K99ButtonPresetRow[],
  toolbars: readonly K99ToolbarRow[],
): string {
  const lines = ['K-99 responsive UI audit', '', 'Button presets:'];
  for (const row of buttons) {
    lines.push(
      `  ${row.preset}: desktop=${row.desktopPx}px mobile=${row.mobilePx}px icon=${row.iconPx}px `
      + `touchOk=${row.meetsTouchMin} focusVisible=${row.hasFocusVisible}`,
    );
  }
  lines.push('', 'Toolbar / layout matrix:');
  for (const row of toolbars) {
    lines.push(
      `  ${row.viewportPx}px: wrap=${row.wrapsToolbar} moreMenu=${row.hasMoreMenu} minTap=${row.minTapPx}px`,
    );
  }
  return lines.join('\n');
}
