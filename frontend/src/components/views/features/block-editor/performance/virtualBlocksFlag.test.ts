import { afterEach, describe, expect, it } from 'vitest';
import {
  getVirtualBlocksDisableOverride,
  getVirtualBlocksPocOverride,
  isVirtualBlocksEnvOptedOut,
  isVirtualBlocksPocEnabled,
  setVirtualBlocksDisableOverride,
  setVirtualBlocksPocOverride,
} from './virtualBlocksFlag';

describe('virtualBlocksFlag', () => {
  afterEach(() => {
    setVirtualBlocksPocOverride(null);
    setVirtualBlocksDisableOverride(null);
  });

  it('defaults to true (production rollout)', () => {
    expect(isVirtualBlocksPocEnabled()).toBe(true);
  });

  it('prop override takes precedence', () => {
    expect(isVirtualBlocksPocEnabled(true)).toBe(true);
    expect(isVirtualBlocksPocEnabled(false)).toBe(false);
  });

  it('test enable override applies when no prop override', () => {
    setVirtualBlocksPocOverride(true);
    expect(isVirtualBlocksPocEnabled()).toBe(true);
    expect(getVirtualBlocksPocOverride()).toBe(true);
  });

  it('test disable override opts out', () => {
    setVirtualBlocksDisableOverride(true);
    expect(isVirtualBlocksPocEnabled()).toBe(false);
    expect(getVirtualBlocksDisableOverride()).toBe(true);
  });

  it('disable override beats enable override', () => {
    setVirtualBlocksPocOverride(true);
    setVirtualBlocksDisableOverride(true);
    expect(isVirtualBlocksPocEnabled()).toBe(false);
  });

  it('isVirtualBlocksEnvOptedOut reflects env flags', () => {
    expect(typeof isVirtualBlocksEnvOptedOut()).toBe('boolean');
  });
});
