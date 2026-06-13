// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { resolveActiveTocIndex, measureHeadingPositions, measureHeadingPositionsHybrid } from './outlineScrollSpy';

describe('resolveActiveTocIndex', () => {
  const headings = [
    { idx: 0, top: 0 },
    { idx: 1, top: 200 },
    { idx: 2, top: 500 },
  ];

  it('returns first heading at top of document', () => {
    expect(resolveActiveTocIndex(0, headings)).toBe(0);
  });

  it('advances active heading as scroll passes offsets', () => {
    expect(resolveActiveTocIndex(140, headings)).toBe(0);
    expect(resolveActiveTocIndex(220, headings)).toBe(1);
    expect(resolveActiveTocIndex(520, headings)).toBe(2);
  });

  it('returns null for empty headings', () => {
    expect(resolveActiveTocIndex(100, [])).toBeNull();
  });
});

describe('measureHeadingPositions', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('maps DOM nodes to scroll-relative tops', () => {
    const root = document.createElement('div');
    root.style.height = '400px';
    root.style.overflow = 'auto';
    document.body.appendChild(root);

    const h1 = document.createElement('h2');
    h1.setAttribute('data-be-heading', '0');
    h1.style.marginTop = '100px';
    h1.textContent = 'One';
    root.appendChild(h1);

    const h2 = document.createElement('h2');
    h2.setAttribute('data-be-heading', '1');
    h2.style.marginTop = '200px';
    h2.textContent = 'Two';
    root.appendChild(h2);

    root.scrollTop = 50;

    const positions = measureHeadingPositions(root, [
      { idx: 0, selector: '[data-be-heading="0"]' },
      { idx: 1, selector: '[data-be-heading="1"]' },
    ]);

    expect(positions).toHaveLength(2);
    expect(positions.map(p => p.idx)).toEqual([0, 1]);

    document.body.removeChild(root);
  });

  it('hybrid measurement uses virtual offsets when DOM nodes are missing', () => {
    const root = document.createElement('div');
    root.style.height = '400px';
    root.style.overflow = 'auto';
    document.body.appendChild(root);

    const positions = measureHeadingPositionsHybrid(
      root,
      [
        { idx: 0, selector: '[data-block-id="missing-0"]', blockId: 'blk-a' },
        { idx: 1, selector: '[data-block-id="missing-1"]', blockId: 'blk-b' },
      ],
      (blockId) => (blockId === 'blk-a' ? 0 : 420),
    );

    expect(positions).toEqual([
      { idx: 0, top: 0 },
      { idx: 1, top: 420 },
    ]);
    expect(resolveActiveTocIndex(400, positions)).toBe(1);

    document.body.removeChild(root);
  });
});
