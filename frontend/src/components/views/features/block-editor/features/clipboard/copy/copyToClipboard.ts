/**
 * copyToClipboard.ts — Programmatic clipboard write for copy actions
 */
import type { Block } from '../../../../../blockUtils';
import { blocksToMarkdown } from '../../../../../blockUtils';
import { blocksToCopyHtml } from './blockCopy';

async function resolveImageBlob(src: string): Promise<Blob | null> {
  if (!src) return null;
  try {
    if (src.startsWith('data:')) {
      const res = await fetch(src);
      return await res.blob();
    }
    const res = await fetch(src, { mode: 'cors' });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (blob.type.startsWith('image/')) return blob;
    return new Blob([blob], { type: 'image/png' });
  } catch {
    return null;
  }
}

export async function copyBlocksToClipboard(blocks: Block[]): Promise<boolean> {
  if (!blocks.length) return false;
  const plain = blocksToMarkdown(blocks);
  const html = blocksToCopyHtml(blocks);

  const singleImage = blocks.length === 1 && blocks[0].type === 'image' && blocks[0].src;
  const imageBlob = singleImage ? await resolveImageBlob(blocks[0].src!) : null;

  try {
    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
      const items: Record<string, Blob> = {
        'text/plain': new Blob([plain], { type: 'text/plain' }),
        'text/html': new Blob([html], { type: 'text/html' }),
      };
      if (imageBlob) {
        items['image/png'] = imageBlob.type === 'image/png'
          ? imageBlob
          : new Blob([await imageBlob.arrayBuffer()], { type: 'image/png' });
      }
      await navigator.clipboard.write([new ClipboardItem(items)]);
      return true;
    }
  } catch {
    // fall through to plain-text fallback
  }

  try {
    await navigator.clipboard.writeText(plain);
    return true;
  } catch {
    return false;
  }
}

export async function copyPlainTextToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
