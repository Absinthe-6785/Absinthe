// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { writeWorkoutSummaryClipboard } from './workoutSummaryClipboard';

const summary = '📅 2026-11-07\n\n1. 스쿼트 🏋️\n   Set 1  100kg × 5';

describe('writeWorkoutSummaryClipboard', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', {});
    Object.defineProperty(document, 'execCommand', { configurable: true, value: undefined });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete (document as Document & { execCommand?: unknown }).execCommand;
  });

  it('preserves the exact Unicode summary when the modern clipboard confirms the write', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    await expect(writeWorkoutSummaryClipboard(summary)).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledExactlyOnceWith(summary);
  });

  it('returns false when clipboard APIs are missing', async () => {
    await expect(writeWorkoutSummaryClipboard(summary)).resolves.toBe(false);
  });

  it('requires the fallback to return true after a rejected clipboard permission', async () => {
    const writeText = vi.fn().mockRejectedValue(new DOMException('denied', 'NotAllowedError'));
    const execCommand = vi.fn(() => true);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    Object.defineProperty(document, 'execCommand', { configurable: true, value: execCommand });
    const before = document.body.querySelectorAll('textarea').length;

    await expect(writeWorkoutSummaryClipboard(summary)).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledExactlyOnceWith(summary);
    expect(execCommand).toHaveBeenCalledExactlyOnceWith('copy');
    expect(document.body.querySelectorAll('textarea')).toHaveLength(before);
  });

  it('reports a false fallback result as failure and removes the temporary textarea', async () => {
    const execCommand = vi.fn(() => false);
    Object.defineProperty(document, 'execCommand', { configurable: true, value: execCommand });
    const before = document.body.querySelectorAll('textarea').length;

    await expect(writeWorkoutSummaryClipboard(summary)).resolves.toBe(false);
    expect(execCommand).toHaveBeenCalledExactlyOnceWith('copy');
    expect(document.body.querySelectorAll('textarea')).toHaveLength(before);
  });

  it('returns false on synchronous clipboard/fallback exceptions and still cleans up', async () => {
    const writeText = vi.fn(() => { throw new Error('clipboard unavailable'); });
    const execCommand = vi.fn(() => { throw new Error('copy rejected'); });
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    Object.defineProperty(document, 'execCommand', { configurable: true, value: execCommand });
    const before = document.body.querySelectorAll('textarea').length;

    await expect(writeWorkoutSummaryClipboard(summary)).resolves.toBe(false);
    expect(writeText).toHaveBeenCalledOnce();
    expect(execCommand).toHaveBeenCalledExactlyOnceWith('copy');
    expect(document.body.querySelectorAll('textarea')).toHaveLength(before);
  });
});
