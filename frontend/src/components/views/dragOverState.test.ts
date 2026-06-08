import { describe, expect, it } from 'vitest';
import { isDragOverUnchanged } from './dragOverState';

describe('isDragOverUnchanged', () => {
  it('returns true when overId and overPos match', () => {
    expect(isDragOverUnchanged({ overId: 'a', overPos: 'before' }, 'a', 'before')).toBe(true);
  });

  it('returns false when overPos changes', () => {
    expect(isDragOverUnchanged({ overId: 'a', overPos: 'before' }, 'a', 'after')).toBe(false);
  });

  it('returns false when overId changes', () => {
    expect(isDragOverUnchanged({ overId: 'a', overPos: 'before' }, 'b', 'before')).toBe(false);
  });

  it('treats null targets as comparable when prior state had no target', () => {
    expect(isDragOverUnchanged({ overId: null, overPos: null }, null, null)).toBe(true);
    expect(isDragOverUnchanged({ overId: null, overPos: null }, 'a', 'before')).toBe(false);
  });
});
