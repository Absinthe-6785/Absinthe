import { describe, expect, it } from 'vitest';
import {
  decodeRelatedReasonFlags,
  encodeRelatedReasonFlags,
  toCompactRelatedRef,
} from './relatedCompactRef';

describe('relatedCompactRef', () => {
  it('round-trips reason flags', () => {
    const reasons = ['backlink', 'mention', 'shared tag'] as const;
    const flags = encodeRelatedReasonFlags(reasons);
    expect(decodeRelatedReasonFlags(flags).sort()).toEqual([...reasons].sort());
  });

  it('prefers mutual backlink over backlink when both encoded', () => {
    const flags = encodeRelatedReasonFlags(['mutual backlink', 'backlink']);
    expect(decodeRelatedReasonFlags(flags)).toEqual(['mutual backlink']);
  });

  it('builds compact refs without titles', () => {
    const ref = toCompactRelatedRef('n1', 13, ['backlink', 'mention']);
    expect(ref).toEqual({ noteId: 'n1', score: 13, reasonFlags: expect.any(Number) });
    expect(ref.noteId).toBe('n1');
  });
});
