// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { makeBlock } from '../../../blockUtils';
import { commitDragDrop } from '../../../editorDragDrop';
import {
  getVirtualRowMetrics,
  getVisibleRowMetrics,
  resolveDropTargetFromRows,
  resolveOverlayFrame,
  type BlockRowHit,
} from './rowMetrics';

describe('rowMetrics', () => {
  it('collects visible rows from mounted block DOM', () => {
    document.body.innerHTML = `
      <div class="be-editor-root">
        <div data-drag-id="a" style="margin:0;height:40px"></div>
        <div data-drag-id="b" style="margin:0;height:40px"></div>
      </div>
    `;
    const root = document.querySelector('.be-editor-root') as HTMLElement;
    const rows = getVisibleRowMetrics({
      getEditorRoot: () => root,
      getRootBlockIds: () => ['a', 'b'],
    });
    expect(rows).toHaveLength(2);
    expect(rows.map(r => r.blockId)).toEqual(['a', 'b']);
  });

  it('resolves before/after targets from virtual row hits', () => {
    const rows: BlockRowHit[] = [
      { blockId: 'a', top: 0, bottom: 40 },
      { blockId: 'b', top: 40, bottom: 80 },
    ];
    const paragraph = makeBlock('paragraph', { id: 'a' });
    const getBlock = (id: string) => (id === 'a' ? paragraph : makeBlock('paragraph', { id }));

    const before = resolveDropTargetFromRows(10, rows, [], getBlock);
    const middle = resolveDropTargetFromRows(30, rows, [], getBlock);
    const after = resolveDropTargetFromRows(90, rows, [], getBlock);
    expect(before).toEqual({ overId: 'a', overPos: 'before' });
    expect(middle).toEqual({ overId: 'a', overPos: 'after' });
    expect(after).toEqual({ overId: 'b', overPos: 'after' });
  });

  it('resolves inside for collapsed toggle rows', () => {
    const rows: BlockRowHit[] = [{ blockId: 't', top: 0, bottom: 40 }];
    const toggle = makeBlock('toggle', { id: 't', collapsed: true });
    expect(resolveDropTargetFromRows(20, rows, [], () => toggle)).toEqual({
      overId: 't',
      overPos: 'inside',
    });
  });

  it('splits a large visual gap at the adjacent slot boundary with no dead zone', () => {
    const rows: BlockRowHit[] = [
      { blockId: 'a', top: 0, bottom: 40 },
      { blockId: 'b', top: 100, bottom: 140 },
    ];

    const upperGap = resolveDropTargetFromRows(69, rows, []);
    const boundary = resolveDropTargetFromRows(70, rows, []);
    const lowerGap = resolveDropTargetFromRows(90, rows, []);
    expect(upperGap).toEqual({ overId: 'a', overPos: 'after' });
    expect(boundary).toEqual({ overId: 'b', overPos: 'before' });
    expect(lowerGap).toEqual({ overId: 'b', overPos: 'before' });
  });

  it('keeps unequal and multiline sibling zones sorted and contiguous', () => {
    const rows: BlockRowHit[] = [
      { blockId: 'heading', top: 0, bottom: 30 },
      { blockId: 'multiline', top: 80, bottom: 240 },
      { blockId: 'list', top: 260, bottom: 300 },
    ];

    const hits = [
      resolveDropTargetFromRows(15, rows, []),
      resolveDropTargetFromRows(55, rows, []),
      resolveDropTargetFromRows(65, rows, []),
      resolveDropTargetFromRows(250, rows, []),
      resolveDropTargetFromRows(270, rows, []),
    ];
    expect(hits.map(hit => `${hit?.overId}:${hit?.overPos}`)).toEqual([
      'heading:after',
      'multiline:before',
      'multiline:before',
      'list:before',
      'list:before',
    ]);
  });

  it('maps a one-pixel move across a slot boundary to one adjacent destination', () => {
    const rows: BlockRowHit[] = [
      { blockId: 'a', top: 0, bottom: 20 },
      { blockId: 'b', top: 120, bottom: 150 },
      { blockId: 'c', top: 170, bottom: 190 },
    ];
    const before = resolveDropTargetFromRows(69, rows, []);
    const after = resolveDropTargetFromRows(70, rows, []);
    expect(before).toEqual({ overId: 'a', overPos: 'after' });
    expect(after).toEqual({ overId: 'b', overPos: 'before' });
  });

  it('uses the resolved slot destination for the same commit result', () => {
    const rows: BlockRowHit[] = [
      { blockId: 'a', top: 0, bottom: 40 },
      { blockId: 'b', top: 120, bottom: 160 },
    ];
    const hit = resolveDropTargetFromRows(80, rows, []);
    expect(hit).toEqual({ overId: 'b', overPos: 'before' });
    const source = makeBlock('paragraph', { id: 'source', content: 'source' });
    const a = makeBlock('paragraph', { id: 'a', content: 'A' });
    const b = makeBlock('paragraph', { id: 'b', content: 'B' });
    // The existing commit API consumes the same canonical overId/overPos pair.
    expect(commitDragDrop([source, a, b], ['source'], hit!.overId, hit!.overPos)?.map(block => block.id))
      .toEqual(['a', 'source', 'b']);
  });

  it('keeps virtual row boundaries in client space after editor scrolling', () => {
    const scroll = document.createElement('div');
    scroll.scrollTop = 80;
    scroll.getBoundingClientRect = () => ({
      left: 20, width: 400, top: 120, bottom: 520, right: 420, height: 400, x: 20, y: 120,
      toJSON: () => ({}),
    } as DOMRect);
    const virtualizer = {
      measurementsCache: [
        { start: 0, size: 40 },
        { start: 100, size: 60 },
      ],
      getOffsetForIndex: (index: number) => [index === 0 ? 0 : 100, 'start'] as [number, string],
    };
    const blocks = [
      makeBlock('paragraph', { id: 'a' }),
      makeBlock('paragraph', { id: 'b' }),
    ];
    const rows = getVirtualRowMetrics(virtualizer as never, blocks, scroll);
    expect(rows.map(row => [row.top, row.bottom])).toEqual([[40, 80], [140, 200]]);

    const beforeBoundary = resolveDropTargetFromRows(109, rows, []);
    const afterBoundary = resolveDropTargetFromRows(110, rows, []);
    expect(beforeBoundary).toEqual({ overId: 'a', overPos: 'after' });
    expect(afterBoundary).toEqual({ overId: 'b', overPos: 'before' });
  });

  it('keeps multiline text, heading, and list blocks atomic at sibling boundaries', () => {
    const rows: BlockRowHit[] = [
      { blockId: 'heading', top: 0, bottom: 84 },
      { blockId: 'list', top: 124, bottom: 268 },
      { blockId: 'paragraph', top: 308, bottom: 348 },
    ];
    const blocks = new Map([
      ['heading', makeBlock('heading2', { id: 'heading', content: '첫 줄\n둘째 줄' })],
      ['list', makeBlock('bullet', { id: 'list', content: 'alpha **bold**\nbeta 日本語 한국어' })],
      ['paragraph', makeBlock('paragraph', { id: 'paragraph', content: 'one\ntwo\nthree' })],
    ]);
    const getBlock = (id: string) => blocks.get(id);

    const headingInterior = resolveDropTargetFromRows(42, rows, [], getBlock);
    const listInterior = resolveDropTargetFromRows(200, rows, [], getBlock);
    const paragraphInterior = resolveDropTargetFromRows(320, rows, [], getBlock);

    expect(headingInterior).toEqual({ overId: 'heading', overPos: 'after' });
    expect(listInterior).toEqual({ overId: 'list', overPos: 'after' });
    expect(paragraphInterior).toEqual({ overId: 'paragraph', overPos: 'before' });
  });

  it('keeps moved multiline heights attached to ids and siblings non-overlapping', () => {
    const a = makeBlock('paragraph', { id: 'a', content: 'A' });
    const multiline = makeBlock('paragraph', { id: 'multiline', content: 'one\ntwo\nthree' });
    const c = makeBlock('paragraph', { id: 'c', content: 'C' });
    const scroll = document.createElement('div');
    scroll.getBoundingClientRect = () => ({
      left: 0, width: 400, top: 0, bottom: 600, right: 400, height: 600, x: 0, y: 0,
      toJSON: () => ({}),
    } as DOMRect);

    const cases = [
      {
        blocks: [a, multiline, c],
        measurementsCache: [
          { key: 'a', start: 0, size: 40 },
          { key: 'multiline', start: 64, size: 132 },
          { key: 'c', start: 220, size: 40 },
        ],
      },
      {
        blocks: [a, c, multiline],
        measurementsCache: [
          { key: 'a', start: 0, size: 40 },
          { key: 'c', start: 64, size: 40 },
          { key: 'multiline', start: 128, size: 132 },
        ],
      },
      {
        blocks: [multiline, a, c],
        measurementsCache: [
          { key: 'multiline', start: 0, size: 132 },
          { key: 'a', start: 156, size: 40 },
          { key: 'c', start: 220, size: 40 },
        ],
      },
    ];

    for (const testCase of cases) {
      const rows = getVirtualRowMetrics({
        measurementsCache: testCase.measurementsCache,
        getOffsetForIndex: (index: number) => [testCase.measurementsCache[index]!.start, 'start'],
      } as never, testCase.blocks, scroll);
      expect(rows.map(row => row.blockId)).toEqual(testCase.blocks.map(block => block.id));
      expect(rows.find(row => row.blockId === 'multiline')?.bottom
        - rows.find(row => row.blockId === 'multiline')?.top).toBe(132);
      for (let index = 1; index < rows.length; index += 1) {
        expect(rows[index - 1]!.bottom).toBeLessThanOrEqual(rows[index]!.top);
      }
    }
  });

  it('resolveOverlayFrame uses row metrics when DOM is absent', () => {
    const scroll = document.createElement('div');
    scroll.getBoundingClientRect = () => ({
      left: 20, width: 400, top: 0, bottom: 600, right: 420, height: 600, x: 20, y: 0,
      toJSON: () => ({}),
    } as DOMRect);
    const mockVirtualizer = {
      measurementsCache: [{ start: 200, size: 48 }],
      getOffsetForIndex: () => [200, 'start'] as [number, string],
    };
    const blocks = [makeBlock('paragraph', { id: 'offscreen' })];
    const frame = resolveOverlayFrame('offscreen', {
      getEditorRoot: () => null,
      getRootBlockIds: () => ['offscreen'],
      getBlocks: () => blocks,
      getVirtualizer: () => mockVirtualizer as never,
      getScrollElement: () => scroll,
    });
    expect(frame).not.toBeNull();
    expect(frame!.height).toBe(48);
  });
});
