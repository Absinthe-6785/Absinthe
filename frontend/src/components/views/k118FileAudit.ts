/**
 * K-118 — File block preview audit.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)));

export function auditFilePreviews(): Record<string, boolean> {
  const embed = readFileSync(join(ROOT, 'MediaEmbedPreview.tsx'), 'utf8');
  const audio = readFileSync(join(ROOT, 'AudioBlock.tsx'), 'utf8');
  const media = readFileSync(join(ROOT, 'mediaUrlUtils.ts'), 'utf8');
  return {
    pdfPreview: embed.includes('data-k118-embed-kind') && embed.includes("'pdf'"),
    audioPreview: audio.includes('data-k118-audio-duration'),
    videoThumb: embed.includes('data-k118-video-thumb'),
    fileOpen: embed.includes('data-k118-embed-open'),
    pdfDetect: media.includes("return 'pdf'"),
    videoDetect: media.includes("return 'video'"),
  };
}

export function auditFileRc(): boolean {
  const r = auditFilePreviews();
  return r.pdfPreview && r.audioPreview && r.videoThumb && r.pdfDetect;
}
