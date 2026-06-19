/**
 * K-123 — Block interaction gutter audit.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { K123_EDITOR_GUTTER_PX } from '../../lib/k123EditorLayout';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export function auditBlockGutter(): Record<string, boolean> {
  const chrome = readFileSync(join(ROOT, 'components/views/editorChromeStyles.ts'), 'utf8');
  const shell = readFileSync(join(ROOT, 'components/views/noteview/NoteViewEditorArea.tsx'), 'utf8');
  return {
    gutterWidth: chrome.includes('K123_EDITOR_GUTTER_PX') && chrome.includes('.be-gutter'),
    gutterPadding: chrome.includes('padding-left: ${K123_EDITOR_GUTTER_PX}px') || chrome.includes(`padding-left: ${K123_EDITOR_GUTTER_PX}px`),
    gutterStrip: chrome.includes('.be-gutter-strip'),
    handlesVisible: chrome.includes('.be-handles'),
    columnOverflowClip: chrome.includes('overflow-x: clip') || chrome.includes('overflow: visible'),
    shellGutterRoom: shell.includes('k123-editor-column-shell'),
  };
}

export function auditBlockGutterRc(): boolean {
  return Object.values(auditBlockGutter()).every(Boolean);
}
