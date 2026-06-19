/**
 * K-118 — Media clipboard MIME audit.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { K104_CLIPBOARD_MIME_TYPES } from './k104ClipboardAudit';

const ROOT = join(dirname(fileURLToPath(import.meta.url)));

export function auditMediaClipboard(): Record<string, boolean> {
  const copy = readFileSync(
    join(ROOT, 'features/block-editor/features/clipboard/copy/copyToClipboard.ts'),
    'utf8',
  );
  const blockCopy = readFileSync(
    join(ROOT, 'features/block-editor/features/clipboard/copy/blockCopy.ts'),
    'utf8',
  );
  const viewer = readFileSync(join(ROOT, 'ImageGalleryViewer.tsx'), 'utf8');
  return {
    mimePlain: K104_CLIPBOARD_MIME_TYPES.includes('text/plain'),
    mimeHtml: K104_CLIPBOARD_MIME_TYPES.includes('text/html'),
    mimePng: K104_CLIPBOARD_MIME_TYPES.includes('image/png'),
    mediaPlainLabel: blockCopy.includes('formatMediaDisplayLabel'),
    copyBlocksMime: copy.includes('image/png'),
    viewerCopy: viewer.includes('image/png'),
  };
}

export function auditClipboardRc(): boolean {
  const c = auditMediaClipboard();
  return c.mimePlain && c.mimeHtml && c.mimePng && c.mediaPlainLabel;
}
