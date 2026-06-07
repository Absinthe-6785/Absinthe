import { describe, expect, it } from 'vitest';
import { makeBlock } from './blockUtils';
import { applyHierarchyDragDrop } from './dragHierarchy';

describe('applyHierarchyDragDrop', () => {
  it('sibling to child — drop inside toggle', () => {
    const toggle = makeBlock('toggle', { id: 't', content: 'A', children: [] });
    const b = makeBlock('paragraph', { id: 'b', content: 'B' });
    const c = makeBlock('paragraph', { id: 'c', content: 'C' });
    const root = [toggle, b, c];

    const next = applyHierarchyDragDrop(root, 'c', 't', 'inside');
    expect(next![0].children[0].id).toBe('c');
    expect(next!.map(x => x.id)).toEqual(['t', 'b']);
  });

  it('child to sibling — move out and place after', () => {
    const child = makeBlock('paragraph', { id: 'b', content: 'B' });
    const toggle = makeBlock('toggle', { id: 't', content: 'A', children: [child] });
    const c = makeBlock('paragraph', { id: 'c', content: 'C' });
    const root = [toggle, c];

    const next = applyHierarchyDragDrop(root, 'b', 'c', 'after');
    expect(next!.map(x => x.id)).toEqual(['t', 'c', 'b']);
    expect(next![0].children).toHaveLength(0);
  });

  it('child to parent level — insert before root sibling', () => {
    const child = makeBlock('paragraph', { id: 'b', content: 'B' });
    const toggle = makeBlock('toggle', { id: 't', content: 'A', children: [child] });
    const c = makeBlock('paragraph', { id: 'c', content: 'C' });
    const root = [toggle, c];

    const next = applyHierarchyDragDrop(root, 'b', 'c', 'before');
    expect(next!.map(x => x.id)).toEqual(['t', 'b', 'c']);
    expect(next![0].children).toHaveLength(0);
  });

  it('nested toggle accepts cross-level inside drop', () => {
    const inner = makeBlock('paragraph', { id: 'p', content: 'P' });
    const innerToggle = makeBlock('toggle', { id: 'it', content: 'Inner', children: [] });
    const outer = makeBlock('toggle', { id: 'ot', content: 'Outer', children: [innerToggle] });
    const root = [outer, inner];

    const next = applyHierarchyDragDrop(root, 'p', 'it', 'inside');
    expect(next![0].children[0].id).toBe('it');
    expect(next![0].children[0].children[0].id).toBe('p');
  });

  it('rejects drop onto own descendant', () => {
    const child = makeBlock('paragraph', { id: 'c', content: 'c' });
    const toggle = makeBlock('toggle', { id: 't', content: 'T', children: [child] });
    expect(applyHierarchyDragDrop([toggle], 't', 'c', 'inside')).toBeNull();
  });

  it('drop onto collapsed toggle header target', () => {
    const toggle = makeBlock('toggle', { id: 't', content: 'T', children: [], collapsed: true });
    const p = makeBlock('paragraph', { id: 'p', content: 'P' });
    const next = applyHierarchyDragDrop([toggle, p], 'p', 't', 'inside');
    expect(next![0].children[0].id).toBe('p');
    expect(next![0].collapsed).toBe(false);
  });
});
