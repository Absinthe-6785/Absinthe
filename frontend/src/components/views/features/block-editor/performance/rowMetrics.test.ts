// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { makeBlock } from '../../../blockUtils';
import {
  getVisibleRowMetrics,
  resolveDropTargetFromRows,
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

    expect(resolveDropTargetFromRows(10, rows, [], getBlock)).toEqual({
      overId: 'a',
      overPos: 'before',
    });
    expect(resolveDropTargetFromRows(30, rows, [], getBlock)).toEqual({
      overId: 'a',
      overPos: 'after',
    });
    expect(resolveDropTargetFromRows(90, rows, [], getBlock)).toEqual({
      overId: 'b',
      overPos: 'after',
    });
  });

  it('resolves inside for collapsed toggle rows', () => {
    const rows: BlockRowHit[] = [{ blockId: 't', top: 0, bottom: 40 }];
    const toggle = makeBlock('toggle', { id: 't', collapsed: true });
    expect(resolveDropTargetFromRows(20, rows, [], () => toggle)).toEqual({
      overId: 't',
      overPos: 'inside',
    });
  });
});
