/**
 * K-116 — Image preview simplification audit.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export const K116_IMAGE_LABELS = ['Image', 'Screenshot'] as const;

export function auditImagePreview(): Record<string, boolean> {
  const blockUtils = readFileSync(join(ROOT, 'components/views/blockUtils.ts'), 'utf8');
  return {
    formatImageDisplayLabel: blockUtils.includes('formatImageDisplayLabel'),
    hidesDataUrls: blockUtils.includes('isDataImageUrl'),
    markdownUsesLabel: blockUtils.includes('formatImageMarkdownAlt(block)'),
    screenshotDetect: blockUtils.includes('screenshot'),
  };
}

export function auditImagePreviewRc(): boolean {
  const p = auditImagePreview();
  return p.formatImageDisplayLabel && p.hidesDataUrls && p.markdownUsesLabel;
}
