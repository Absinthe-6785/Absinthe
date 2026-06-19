/**
 * K-119 — Scroll container audit.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export function auditScrollBehavior(): Record<string, boolean> {
  const layout = readFileSync(join(ROOT, 'components/common/workspaceLayout.tsx'), 'utf8');
  const settings = readFileSync(join(ROOT, 'components/views/SettingsView.tsx'), 'utf8');
  return {
    workspaceLayoutHook: layout.includes('data-k119-workspace-layout'),
    primaryScrollHook: layout.includes('data-k119-scroll-primary'),
    overscrollContain: layout.includes('UI_SPACING.scrollOverscroll'),
    settingsScroll: settings.includes('data-k119-settings-scroll'),
    minHeightZero: layout.includes('min-h-0'),
  };
}

export function auditScrollRc(): boolean {
  const r = auditScrollBehavior();
  return r.workspaceLayoutHook && r.primaryScrollHook && r.overscrollContain;
}
