/**
 * K-118 — Image viewer and gallery audit.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)));

export function auditImageExperience(): Record<string, boolean> {
  const viewer = readFileSync(join(ROOT, 'ImageGalleryViewer.tsx'), 'utf8');
  const image = readFileSync(join(ROOT, 'ImageBlock.tsx'), 'utf8');
  const gallery = readFileSync(join(ROOT, 'imageGallery.ts'), 'utf8');
  return {
    fullscreenViewer: viewer.includes('data-k118-image-viewer'),
    arrowNav: viewer.includes('data-k118-image-prev') && viewer.includes('data-k118-image-next'),
    zoom: viewer.includes('data-k118-image-zoom-in'),
    copyImage: viewer.includes('data-k118-image-copy'),
    saveImage: viewer.includes('data-k118-image-save'),
    pinchZoom: viewer.includes('touches.length === 2'),
    swipeNav: viewer.includes('swipeRef'),
    clickOpen: image.includes('data-k118-image-open'),
    consecutiveGallery: gallery.includes('collectConsecutiveImageGallery'),
  };
}

export function auditImageRc(): boolean {
  const r = auditImageExperience();
  return r.fullscreenViewer && r.clickOpen && r.consecutiveGallery && r.copyImage;
}
