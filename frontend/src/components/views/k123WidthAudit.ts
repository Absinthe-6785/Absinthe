/**
 * K-123 — Wide document column width audit.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { K123_EDITOR_COLUMN_MAX_PX } from '../../lib/k123EditorLayout';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export function auditEditorWidth(): Record<string, boolean> {
  const theme = readFileSync(join(ROOT, 'components/views/noteEditorTheme.ts'), 'utf8');
  const chrome = readFileSync(join(ROOT, 'components/views/editorChromeStyles.ts'), 'utf8');
  const layout = readFileSync(join(ROOT, 'lib/k123EditorLayout.ts'), 'utf8');
  return {
    columnMax: layout.includes(String(K123_EDITOR_COLUMN_MAX_PX)),
    inRange: K123_EDITOR_COLUMN_MAX_PX >= 900 && K123_EDITOR_COLUMN_MAX_PX <= 1100,
    noteTheme: theme.includes('NOTE_DOCUMENT_MAX_WIDTH'),
    cssVar: chrome.includes('var(--be-doc-width'),
    wideMediaBreakout: chrome.includes('calc(var(--be-doc-width'),
    notFullViewport: chrome.includes('max-width: var(--be-doc-width'),
  };
}

export function auditWidthRc(): boolean {
  return Object.values(auditEditorWidth()).every(Boolean);
}
