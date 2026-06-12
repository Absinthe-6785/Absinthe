/**
 * copyToClipboard.ts — Programmatic clipboard write for copy actions
 */
import type { Block } from '../../../../../blockUtils';
import { blocksToMarkdown } from '../../../../../blockUtils';
import { blocksToCopyHtml } from './blockCopy';

export async function copyBlocksToClipboard(blocks: Block[]): Promise<boolean> {
  if (!blocks.length) return false;
  const plain = blocksToMarkdown(blocks);
  const html = blocksToCopyHtml(blocks);

  try {
    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/plain': new Blob([plain], { type: 'text/plain' }),
          'text/html': new Blob([html], { type: 'text/html' }),
        }),
      ]);
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
