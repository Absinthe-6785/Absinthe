import { afterEach, describe, expect, it } from 'vitest';
import {
  getVirtualBlocksPocOverride,
  isVirtualBlocksPocEnabled,
  setVirtualBlocksPocOverride,
} from './virtualBlocksFlag';

describe('virtualBlocksFlag', () => {
  afterEach(() => {
    setVirtualBlocksPocOverride(null);
  });

  it('defaults to false', () => {
    expect(isVirtualBlocksPocEnabled()).toBe(false);
  });

  it('prop override takes precedence', () => {
    expect(isVirtualBlocksPocEnabled(true)).toBe(true);
    expect(isVirtualBlocksPocEnabled(false)).toBe(false);
  });

  it('test override applies when no prop override', () => {
    setVirtualBlocksPocOverride(true);
    expect(isVirtualBlocksPocEnabled()).toBe(true);
    expect(getVirtualBlocksPocOverride()).toBe(true);
    setVirtualBlocksPocOverride(null);
    expect(isVirtualBlocksPocEnabled()).toBe(false);
  });
});
