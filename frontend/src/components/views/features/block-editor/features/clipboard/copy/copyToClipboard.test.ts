import { describe, expect, it, vi } from 'vitest';
import { copyPlainTextToClipboard } from './copyToClipboard';

describe('copyToClipboard', () => {
  it('copyPlainTextToClipboard writes exact text', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    const ok = await copyPlainTextToClipboard('const x = 1;\n');
    expect(ok).toBe(true);
    expect(writeText).toHaveBeenCalledWith('const x = 1;\n');

    vi.unstubAllGlobals();
  });
});
