// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isUniverseMode, loadGraphViewMode, saveGraphViewMode } from './graphViewMode';

describe('graphViewMode', () => {
  let storage: Record<string, string>;

  beforeEach(() => {
    storage = {};
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => storage[key] ?? null,
        setItem: (key: string, value: string) => { storage[key] = value; },
        removeItem: (key: string) => { delete storage[key]; },
        clear: () => { storage = {}; },
        key: () => null,
        length: 0,
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('defaults to network mode', () => {
    expect(loadGraphViewMode()).toBe('network');
    expect(isUniverseMode('network')).toBe(false);
  });

  it('persists universe preference', () => {
    saveGraphViewMode('universe');
    expect(loadGraphViewMode()).toBe('universe');
    expect(isUniverseMode('universe')).toBe(true);
    saveGraphViewMode('network');
  });
});
