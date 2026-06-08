import { describe, expect, it } from 'vitest';
import { isKnownBlockType, sanitizeBlockType, KNOWN_BLOCK_TYPES } from './blockTypeGuards';

describe('blockTypeGuards', () => {
  it('KNOWN_BLOCK_TYPES includes all standard types', () => {
    expect(KNOWN_BLOCK_TYPES.has('paragraph')).toBe(true);
    expect(KNOWN_BLOCK_TYPES.has('table')).toBe(true);
    expect(KNOWN_BLOCK_TYPES.has('math')).toBe(true);
    expect(KNOWN_BLOCK_TYPES.has('toggle')).toBe(true);
  });

  it('isKnownBlockType accepts valid types', () => {
    expect(isKnownBlockType('heading2')).toBe(true);
    expect(isKnownBlockType('code')).toBe(true);
  });

  it('isKnownBlockType rejects unknown values', () => {
    expect(isKnownBlockType('plus')).toBe(false);
    expect(isKnownBlockType(null)).toBe(false);
    expect(isKnownBlockType(42)).toBe(false);
  });

  it('sanitizeBlockType coerces unknown to paragraph', () => {
    expect(sanitizeBlockType('plus')).toBe('paragraph');
    expect(sanitizeBlockType(undefined)).toBe('paragraph');
    expect(sanitizeBlockType('bullet')).toBe('bullet');
  });
});
