/**
 * K-118 — Consecutive image block gallery collection.
 */
import type { Block } from './blockUtils';

export interface GalleryImage {
  blockId: string;
  src: string;
  alt?: string;
  caption?: string;
}

function toGalleryImage(block: Block): GalleryImage | null {
  if (block.type !== 'image' || !block.src) return null;
  return {
    blockId: block.id,
    src: block.src,
    alt: block.alt,
    caption: block.caption,
  };
}

/** Collect consecutive root-level image blocks around `blockId`. */
export function collectConsecutiveImageGallery(
  rootBlocks: readonly Block[],
  blockId: string,
): { images: GalleryImage[]; index: number } {
  const idx = rootBlocks.findIndex(b => b.id === blockId);
  if (idx < 0) return { images: [], index: 0 };

  let start = idx;
  while (start > 0) {
    const prev = rootBlocks[start - 1];
    if (prev?.type !== 'image' || !prev.src) break;
    start -= 1;
  }

  let end = idx;
  while (end < rootBlocks.length - 1) {
    const next = rootBlocks[end + 1];
    if (next?.type !== 'image' || !next.src) break;
    end += 1;
  }

  const images = rootBlocks
    .slice(start, end + 1)
    .map(toGalleryImage)
    .filter((img): img is GalleryImage => img != null);

  const index = images.findIndex(img => img.blockId === blockId);
  return { images, index: Math.max(0, index) };
}
