/**
 * K-118 — Preview density audit.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)));

export const K118_PREVIEW_LABELS = [
  'Image',
  'PDF',
  'YouTube',
  'Audio',
  'Video',
] as const;

export function auditPreviewDensity(): Record<string, boolean> {
  const media = readFileSync(join(ROOT, 'mediaUrlUtils.ts'), 'utf8');
  const embed = readFileSync(join(ROOT, 'MediaEmbedPreview.tsx'), 'utf8');
  const blockCopy = readFileSync(
    join(ROOT, 'features/block-editor/features/clipboard/copy/blockCopy.ts'),
    'utf8',
  );
  return {
    formatMediaDisplayLabel: media.includes('formatMediaDisplayLabel'),
    embedTitle: embed.includes('data-k118-embed-title'),
    collapsedUrl: embed.includes('truncateUrl'),
    clipboardLabels: blockCopy.includes('plainCopyLabel'),
    youtubeLabel: media.includes("'YouTube'"),
  };
}

export function auditPreviewRc(): boolean {
  const r = auditPreviewDensity();
  return r.formatMediaDisplayLabel && r.embedTitle && r.clipboardLabels;
}
