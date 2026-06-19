/**
 * K-123 — Block handle visibility audit.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export function auditBlockHandles(): Record<string, boolean> {
  const chrome = readFileSync(join(ROOT, 'components/views/editorChromeStyles.ts'), 'utf8');
  const editorChrome = readFileSync(join(ROOT, 'components/views/EditorChrome.tsx'), 'utf8');
  return {
    gutterHandles: chrome.includes('.be-gutter:hover > .be-handles'),
    gripButton: chrome.includes('.be-grip') || editorChrome.includes('be-grip'),
    handleMenu: chrome.includes('.be-block-handle-menu'),
    menuHitPad: chrome.includes('width: 20px'),
    selectedGutter: chrome.includes('.be-block-selected > .be-gutter'),
    dragGutter: chrome.includes('.be-dragging > .be-gutter'),
    documentEditOverflow: chrome.includes('.be-document-edit') && chrome.includes('overflow: visible'),
  };
}

export function auditHandleRc(): boolean {
  return Object.values(auditBlockHandles()).every(Boolean);
}
