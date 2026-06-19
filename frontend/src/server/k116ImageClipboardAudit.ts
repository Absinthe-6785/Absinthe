/**
 * K-116 — Image clipboard audit (image/png + html + plain).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { K104_CLIPBOARD_MIME_TYPES } from '../components/views/k104ClipboardAudit';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export function auditImageClipboard(): Record<string, boolean> {
  const copy = readFileSync(
    join(ROOT, 'components/views/features/block-editor/features/clipboard/copy/copyToClipboard.ts'),
    'utf8',
  );
  const blockCopy = readFileSync(
    join(ROOT, 'components/views/features/block-editor/features/clipboard/copy/blockCopy.ts'),
    'utf8',
  );
  return {
    mimeTypes: K104_CLIPBOARD_MIME_TYPES.includes('image/png'),
    singleImageDetect: copy.includes("blocks[0].type === 'image'"),
    clipboardItemWrite: copy.includes('ClipboardItem'),
    copyListenerWired: blockCopy.includes('tryImageRichCopy'),
    plainLabelNotUrl: blockCopy.includes('formatImageDisplayLabel'),
  };
}

export function auditImageClipboardRc(): boolean {
  const c = auditImageClipboard();
  return c.mimeTypes && c.singleImageDetect && c.copyListenerWired && c.plainLabelNotUrl;
}
