import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  isVirtualBlocksPocEnabled,
  setVirtualBlocksDisableOverride,
  setVirtualBlocksPocOverride,
} from './virtualBlocksFlag';

describe('virtualBlocksFlag', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_DISABLE_VIRTUAL_BLOCKS', undefined);
    vi.stubEnv('VITE_VIRTUAL_BLOCKS_POC', undefined);
  });

  afterEach(() => {
    setVirtualBlocksPocOverride(null);
    setVirtualBlocksDisableOverride(null);
    vi.unstubAllEnvs();
  });

  it('defaults to true when the canonical rollback env is absent', () => {
    expect(isVirtualBlocksPocEnabled()).toBe(true);
  });

  it('canonical rollback env disables root virtualization', () => {
    vi.stubEnv('VITE_DISABLE_VIRTUAL_BLOCKS', 'true');
    expect(isVirtualBlocksPocEnabled()).toBe(false);
  });

  it('malformed or non-matching canonical env values leave virtualization enabled', () => {
    for (const value of ['false', '1', 'TRUE', 'yes']) {
      vi.stubEnv('VITE_DISABLE_VIRTUAL_BLOCKS', value);
      expect(isVirtualBlocksPocEnabled()).toBe(true);
    }
  });

  it('legacy VITE_VIRTUAL_BLOCKS_POC no longer controls the result', () => {
    vi.stubEnv('VITE_VIRTUAL_BLOCKS_POC', 'false');
    expect(isVirtualBlocksPocEnabled()).toBe(true);
  });

  it('prop override takes precedence', () => {
    expect(isVirtualBlocksPocEnabled(true)).toBe(true);
    expect(isVirtualBlocksPocEnabled(false)).toBe(false);
  });

  it('test enable override applies when no prop override', () => {
    setVirtualBlocksPocOverride(true);
    expect(isVirtualBlocksPocEnabled()).toBe(true);
  });

  it('test disable override opts out', () => {
    setVirtualBlocksDisableOverride(true);
    expect(isVirtualBlocksPocEnabled()).toBe(false);
  });

  it('disable override beats enable override', () => {
    setVirtualBlocksPocOverride(true);
    setVirtualBlocksDisableOverride(true);
    expect(isVirtualBlocksPocEnabled()).toBe(false);
  });

  it('null reset restores normal env decision behavior', () => {
    setVirtualBlocksPocOverride(false);
    setVirtualBlocksDisableOverride(true);
    expect(isVirtualBlocksPocEnabled()).toBe(false);

    setVirtualBlocksPocOverride(null);
    setVirtualBlocksDisableOverride(null);
    expect(isVirtualBlocksPocEnabled()).toBe(true);
  });
});
