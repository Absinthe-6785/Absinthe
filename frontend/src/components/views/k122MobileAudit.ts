/**
 * K-122 — Mobile find-in-note audit.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export function auditSearchMobile(): Record<string, boolean> {
  const panel = readFileSync(join(ROOT, 'components/views/noteview/FindInNotePanel.tsx'), 'utf8');
  return {
    bottomSheet: panel.includes('data-k122-find-sheet'),
    backdropTap: panel.includes('data-k122-find-mobile-backdrop') && panel.includes('onClick={onClose}'),
    touch44: panel.includes('UI_INTERACTION.touchTargetMinPx'),
    noOverflow: panel.includes('maxWidth: \'100vw\'') || panel.includes('overflow: \'hidden\''),
    isMobileBranch: panel.includes('if (isMobile)'),
    safeArea: panel.includes('safe-area-inset-bottom'),
  };
}

export function auditMobileRc(): boolean {
  return Object.values(auditSearchMobile()).every(Boolean);
}
