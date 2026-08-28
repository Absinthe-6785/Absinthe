import { describe, expect, it, vi } from 'vitest';
import { makeBlock } from '../../../../../blockUtils';
import { copyBlocksToClipboard, copyPlainTextToClipboard } from './copyToClipboard';

describe('copyToClipboard', () => {
  it('copyPlainTextToClipboard writes exact text', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    const ok = await copyPlainTextToClipboard('const x = 1;\n');
    expect(ok).toBe(true);
    expect(writeText).toHaveBeenCalledWith('const x = 1;\n');

    vi.unstubAllGlobals();
  });

  it('falls back to plain text when rich clipboard write rejects', async () => {
    const write = vi.fn().mockRejectedValue(new Error('rich clipboard unavailable'));
    const writeText = vi.fn().mockResolvedValue(undefined);
    class TestClipboardItem {
      constructor(readonly data: Record<string, Blob>) {}
    }
    vi.stubGlobal('ClipboardItem', TestClipboardItem);
    vi.stubGlobal('navigator', { clipboard: { write, writeText } });

    const ok = await copyBlocksToClipboard([
      makeBlock('paragraph', { content: 'A rich note' }),
    ]);

    expect(ok).toBe(true);
    expect(write).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith('A rich note');

    vi.unstubAllGlobals();
  });
});
