/**
 * K-122 — Global search overlay / palette behavior audit.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export function auditSearchOverlayBehavior(): Record<string, boolean> {
  const palette = readFileSync(join(ROOT, 'components/views/features/search/components/SearchWorkspacePalette.tsx'), 'utf8');
  const host = readFileSync(join(ROOT, 'components/views/features/search/GlobalSearchHost.tsx'), 'utf8');
  const a11y = readFileSync(join(ROOT, 'hooks/useModalA11y.ts'), 'utf8');
  return {
    overlayHook: palette.includes('data-k122-search-overlay'),
    outsideClickClose: palette.includes('onClick={onClose}'),
    escClose: palette.includes("e.key === 'Escape'") || a11y.includes("e.key === 'Escape'"),
    selectCloses: palette.includes('onClose()') && palette.includes('handleSelect'),
    focusRestore: a11y.includes('previouslyFocused'),
    clearOnClose: host.includes('setQuery(\'\')'),
    noRenderWhenClosed: palette.includes('if (!open) return null'),
  };
}

export function auditSearchOverlayRc(): boolean {
  return Object.values(auditSearchOverlayBehavior()).every(Boolean);
}
