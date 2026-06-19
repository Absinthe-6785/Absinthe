/**
 * K-118 — Image gallery audit.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)));

export function auditGallery(): Record<string, boolean> {
  const ctx = readFileSync(join(ROOT, 'ImageGalleryContext.tsx'), 'utf8');
  const editor = readFileSync(join(ROOT, 'BlockEditor.tsx'), 'utf8');
  return {
    provider: ctx.includes('ImageGalleryProvider'),
    wiredInEditor: editor.includes('ImageGalleryProvider'),
    multiImage: ctx.includes('images.length > 1'),
  };
}

export function auditGalleryRc(): boolean {
  const r = auditGallery();
  return r.provider && r.wiredInEditor;
}
