/**
 * K-123 — Editor responsive layout audit.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { K123_RESPONSIVE_WIDTHS } from '../../lib/k123EditorLayout';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export function auditEditorResponsive(): Record<string, boolean> {
  const chrome = readFileSync(join(ROOT, 'components/views/editorChromeStyles.ts'), 'utf8');
  const styles = readFileSync(join(ROOT, 'components/views/noteview/useNoteViewStyles.ts'), 'utf8');
  const editor = readFileSync(join(ROOT, 'components/views/noteview/NoteViewEditorArea.tsx'), 'utf8');
  const reading = readFileSync(join(ROOT, 'components/views/editorReading.ts'), 'utf8');
  return {
    widthMatrix: K123_RESPONSIVE_WIDTHS.length === 4 && K123_RESPONSIVE_WIDTHS[0] === 320,
    mobileReading: reading.includes('@media (max-width: 767px)'),
    overflowHidden: styles.includes('#noteview-main{overflow-x:hidden'),
    columnShellPadding: chrome.includes('safe-area-inset'),
    scrollMinWidth: editor.includes('data-k123-editor-scroll') && editor.includes('minWidth: 0'),
    editorRootClip: chrome.includes('overflow-x: clip'),
  };
}

export function auditResponsiveRc(): boolean {
  return Object.values(auditEditorResponsive()).every(Boolean);
}
