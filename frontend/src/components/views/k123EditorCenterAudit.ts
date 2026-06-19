/**
 * K-123 — Editor content centering audit.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { K123_EDITOR_COLUMN_MAX_PX } from '../../lib/k123EditorLayout';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export function auditEditorCentering(): Record<string, boolean> {
  const editor = readFileSync(join(ROOT, 'components/views/noteview/NoteViewEditorArea.tsx'), 'utf8');
  const chrome = readFileSync(join(ROOT, 'components/views/editorChromeStyles.ts'), 'utf8');
  const theme = readFileSync(join(ROOT, 'components/views/noteEditorTheme.ts'), 'utf8');
  return {
    columnShell: editor.includes('data-k123-editor-column') && editor.includes('k123-editor-column-shell'),
    shellMaxWidth: editor.includes('K123_EDITOR_SHELL_MAX_PX') && editor.includes('data-k123-editor-column'),
    documentMaxWidth: theme.includes('K123_EDITOR_COLUMN_MAX_PX') && theme.includes('NOTE_DOCUMENT_MAX_WIDTH'),
    beDocumentCenter: chrome.includes('margin: 0 auto') && chrome.includes('.be-document'),
    autoCenterColumn: chrome.includes('k123-editor-column-shell') && chrome.includes('margin: 0 auto'),
  };
}

export function auditEditorCenterRc(): boolean {
  return Object.values(auditEditorCentering()).every(Boolean);
}
