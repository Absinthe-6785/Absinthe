/**
 * K-118 — Mobile editor touch audit.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)));

export function auditMobileEditor(): Record<string, boolean> {
  const chrome = readFileSync(join(ROOT, 'editorChromeStyles.ts'), 'utf8');
  const styles = readFileSync(join(ROOT, 'noteview/useNoteViewStyles.ts'), 'utf8');
  const image = readFileSync(join(ROOT, 'ImageBlock.tsx'), 'utf8');
  return {
    coarseHandles: chrome.includes('pointer: coarse') && chrome.includes('be-handle-btn'),
    toolbarMobile: styles.includes('be-editor-toolbar-btn') && styles.includes('min-height:44px'),
    imageMobileMenu: image.includes('min-h-[44px]') || image.includes('minWidth: 44'),
    overflowHidden: chrome.includes('overflow-x: clip') || chrome.includes('overflow-x: hidden'),
  };
}

export function auditMobileEditorRc(): boolean {
  const r = auditMobileEditor();
  return r.coarseHandles && r.toolbarMobile && r.overflowHidden;
}
