/**
 * K-122 — Search highlight behavior audit.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export function auditSearchHighlightBehavior(): Record<string, boolean> {
  const styles = readFileSync(join(ROOT, 'components/views/editorChromeStyles.ts'), 'utf8');
  const editor = readFileSync(join(ROOT, 'components/views/BlockEditor.tsx'), 'utf8');
  const panel = readFileSync(join(ROOT, 'components/views/noteview/FindInNotePanel.tsx'), 'utf8');
  const render = readFileSync(join(ROOT, 'components/views/editableRender.ts'), 'utf8');
  return {
    subtleHighlight: styles.includes('.be-search-hl'),
    activeHighlight: styles.includes('.be-search-hl-current'),
    accentActive: styles.includes('be-accent') || styles.includes('139, 92, 246'),
    domActiveMark: editor.includes('be-search-hl-current'),
    matchCountVisible: panel.includes('data-k122-find-count'),
    applyHighlight: render.includes('be-search-hl'),
  };
}

export function auditHighlightRc(): boolean {
  return Object.values(auditSearchHighlightBehavior()).every(Boolean);
}
