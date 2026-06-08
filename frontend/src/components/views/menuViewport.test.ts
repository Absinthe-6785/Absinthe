// @vitest-environment happy-dom
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { computeFixedMenuPosition } from './menuViewport';

describe('computeFixedMenuPosition', () => {
  const origInnerHeight = window.innerHeight;
  const origInnerWidth = window.innerWidth;

  beforeEach(() => {
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
    Object.defineProperty(window, 'innerWidth', { value: 600, configurable: true });
  });

  afterEach(() => {
    Object.defineProperty(window, 'innerHeight', { value: origInnerHeight, configurable: true });
    Object.defineProperty(window, 'innerWidth', { value: origInnerWidth, configurable: true });
  });

  it('keeps anchor when menu fits below', () => {
    const pos = computeFixedMenuPosition(100, 100, 200, 300);
    expect(pos).toEqual({ top: 100, left: 100 });
  });

  it('flips above when menu would clip bottom', () => {
    const pos = computeFixedMenuPosition(100, 700, 200, 320);
    expect(pos.top).toBe(380);
    expect(pos.left).toBe(100);
  });

  it('clamps horizontal overflow', () => {
    const pos = computeFixedMenuPosition(500, 100, 200, 100);
    expect(pos.left).toBe(392);
  });
});
