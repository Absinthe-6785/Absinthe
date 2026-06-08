// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { applyDragAutoscroll, DRAG_AUTOSCROLL_EDGE_BAND_PX } from './dragAutoscroll';

function mockScrollContainer(opts: {
  top: number;
  height: number;
  scrollHeight: number;
  scrollTop?: number;
}) {
  const el = document.createElement('div');
  let scrollTop = opts.scrollTop ?? 0;
  Object.defineProperty(el, 'getBoundingClientRect', {
    value: () => ({
      top: opts.top,
      bottom: opts.top + opts.height,
      left: 0, right: 400, width: 400, height: opts.height, x: 0, y: opts.top,
      toJSON: () => ({}),
    }),
  });
  Object.defineProperty(el, 'clientHeight', { value: opts.height, configurable: true });
  Object.defineProperty(el, 'scrollHeight', { value: opts.scrollHeight, configurable: true });
  Object.defineProperty(el, 'scrollTop', {
    get: () => scrollTop,
    set: (v: number) => { scrollTop = v; },
    configurable: true,
  });
  return el;
}

describe('applyDragAutoscroll', () => {
  it('scrolls up when pointer is in top edge band', () => {
    const el = mockScrollContainer({ top: 100, height: 400, scrollHeight: 2000, scrollTop: 200 });
    const delta = applyDragAutoscroll(el, 100 + 10);
    expect(delta).toBeLessThan(0);
    expect(el.scrollTop).toBeLessThan(200);
  });

  it('scrolls down when pointer is in bottom edge band', () => {
    const el = mockScrollContainer({ top: 100, height: 400, scrollHeight: 2000, scrollTop: 200 });
    const delta = applyDragAutoscroll(el, 100 + 400 - 10);
    expect(delta).toBeGreaterThan(0);
    expect(el.scrollTop).toBeGreaterThan(200);
  });

  it('does not scroll in the middle band', () => {
    const el = mockScrollContainer({ top: 0, height: 400, scrollHeight: 2000, scrollTop: 100 });
    expect(applyDragAutoscroll(el, 200)).toBe(0);
    expect(el.scrollTop).toBe(100);
  });

  it('respects configurable edge band', () => {
    const el = mockScrollContainer({ top: 0, height: 200, scrollHeight: 1000, scrollTop: 50 });
    expect(applyDragAutoscroll(el, 10, DRAG_AUTOSCROLL_EDGE_BAND_PX)).not.toBe(0);
    const el2 = mockScrollContainer({ top: 0, height: 200, scrollHeight: 1000, scrollTop: 50 });
    expect(applyDragAutoscroll(el2, 10, 8)).toBe(0);
  });
});
