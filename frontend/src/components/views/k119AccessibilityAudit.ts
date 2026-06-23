/**
 * K-119 — Accessibility audit.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { UI_INTERACTION } from '@/lib/uiInteractionTokens';
import { TOUCH_TARGET_MIN_PX } from '@/lib/responsiveLayout';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export function auditAccessibility(): Record<string, boolean> {
  const popover = readFileSync(join(ROOT, 'components/common/popover/Popover.tsx'), 'utf8');
  const toolbar = readFileSync(join(ROOT, 'components/common/WorkspaceToolbar.tsx'), 'utf8');
  const empty = readFileSync(join(ROOT, 'components/common/ProductEmptyState.tsx'), 'utf8');
  return {
    escapeDismiss: popover.includes('UI_INTERACTION.escapeKey'),
    focusTrap: popover.includes('focusables'),
    dialogRole: popover.includes("role = 'dialog'"),
    touchTarget44: toolbar.includes('touchTargetMinPx') || toolbar.includes('WORKSPACE_BTN_PRIMARY_CLASS'),
    emptyStatusRole: empty.includes('role="status"'),
    focusRing: toolbar.includes('focus-visible:outline'),
    ariaLabelToolbar: toolbar.includes('aria-label'),
  };
}

export function auditAccessibilityRc(): boolean {
  const r = auditAccessibility();
  return r.escapeDismiss && r.focusTrap && r.touchTarget44 && r.emptyStatusRole;
}
