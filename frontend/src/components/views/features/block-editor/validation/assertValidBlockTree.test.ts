import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeBlock } from '../../../blockUtils';
import { assertValidBlockTree, isBlockTreeAssertionEnabled } from './assertValidBlockTree';

describe('assertValidBlockTree', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('does not throw for a valid tree', () => {
    vi.stubEnv('PROD', false);
    vi.stubEnv('DEV', true);
    expect(() => assertValidBlockTree(
      [makeBlock('paragraph', { id: 'p1', content: 'ok' })],
      'test-valid',
    )).not.toThrow();
  });

  it('throws for an invalid tree with context and violation code', () => {
    vi.stubEnv('PROD', false);
    vi.stubEnv('DEV', true);
    expect(() => assertValidBlockTree([], 'applyPasteBlocksAt')).toThrow(
      /Tree validation failed/,
    );
    expect(() => assertValidBlockTree([], 'applyPasteBlocksAt')).toThrow(
      /Context: applyPasteBlocksAt/,
    );
    expect(() => assertValidBlockTree([], 'applyPasteBlocksAt')).toThrow(
      /EMPTY_DOCUMENT/,
    );
  });

  it('includes duplicate id code in error message', () => {
    vi.stubEnv('PROD', false);
    vi.stubEnv('DEV', true);
    const blocks = [
      makeBlock('paragraph', { id: 'dup' }),
      makeBlock('paragraph', { id: 'dup' }),
    ];
    expect(() => assertValidBlockTree(blocks, 'clipboardToBlocks')).toThrow(
      /DUPLICATE_ID/,
    );
  });

  it('is skipped in production mode', () => {
    vi.stubEnv('PROD', true);
    vi.stubEnv('DEV', false);
    vi.stubEnv('MODE', 'production');
    expect(isBlockTreeAssertionEnabled()).toBe(false);
    expect(() => assertValidBlockTree([], 'production-skip')).not.toThrow();
  });

  it('runs in test mode when not production', () => {
    vi.stubEnv('PROD', false);
    vi.stubEnv('DEV', false);
    vi.stubEnv('MODE', 'test');
    expect(isBlockTreeAssertionEnabled()).toBe(true);
    expect(() => assertValidBlockTree([], 'test-mode')).toThrow(/EMPTY_DOCUMENT/);
  });
});
