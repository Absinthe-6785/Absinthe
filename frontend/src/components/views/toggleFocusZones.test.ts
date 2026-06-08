// @vitest-environment happy-dom
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  COLLAPSED_TOGGLE_ROW_EXTENSION_PX,
  classifyToggleFooterZone,
  collapsedToggleRowBounds,
  evaluateToggleFooterFeasibility,
  findCollapsedToggleZoneHit,
  isClientYInCollapsedToggleRow,
  toggleNestDepth,
} from './toggleFocusZones';
import { makeBlock } from './blockUtils';

function rect(top: number, height: number): DOMRect {
  return {
    left: 0, top, width: 400, height, right: 400, bottom: top + height, x: 0, y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

function mountCollapsedToggle(id: string, top: number, parent?: HTMLElement) {
  const wrap = document.createElement('div');
  wrap.className = 'be-toggle-wrap be-toggle-collapsed';
  const header = document.createElement('div');
  header.className = 'be-toggle-header-block be-block';
  header.setAttribute('data-drag-id', id);
  header.setAttribute('data-block-type', 'toggle');
  header.getBoundingClientRect = () => rect(top, 40);
  wrap.appendChild(header);
  (parent ?? document.body).appendChild(wrap);
  return { wrap, header };
}

function mountExpandedToggle(id: string, top: number, childBottom: number) {
  const wrap = document.createElement('div');
  wrap.className = 'be-toggle-wrap';
  const header = document.createElement('div');
  header.className = 'be-toggle-header-block be-block';
  header.setAttribute('data-drag-id', id);
  header.getBoundingClientRect = () => rect(top, 40);
  const children = document.createElement('div');
  children.className = 'be-toggle-children';
  children.getBoundingClientRect = () => rect(top + 40, childBottom - top - 40);
  wrap.append(header, children);
  wrap.getBoundingClientRect = () => rect(top, childBottom - top + 20);
  document.body.appendChild(wrap);
  return { wrap, header, children };
}

describe('toggleFocusZones', () => {
  let root: HTMLDivElement;

  beforeEach(() => {
    root = document.createElement('div');
    root.className = 'be-editor-root';
    document.body.appendChild(root);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('collapsed toggle hit — pointer in extended row below header', () => {
    mountCollapsedToggle('tog1', 0, root);
    const blocks = [makeBlock('toggle', { id: 'tog1', content: 'Grammar', collapsed: true })];

    expect(isClientYInCollapsedToggleRow(50, rect(0, 40))).toBe(true);
    expect(findCollapsedToggleZoneHit(50, root, blocks)).toBe('tog1');
  });

  it('expanded toggle miss — collapsed zone does not match open wrap', () => {
    mountExpandedToggle('tog2', 0, 120);
    const blocks = [makeBlock('toggle', { id: 'tog2', content: 'Open', collapsed: false, children: [
      makeBlock('paragraph', { content: 'child' }),
    ] })];

    expect(findCollapsedToggleZoneHit(100, root, blocks)).toBeNull();
  });

  it('footer-zone classification — below last child inside expanded wrap', () => {
    const wrap = document.createElement('div');
    wrap.className = 'be-toggle-wrap';
    const header = document.createElement('div');
    header.className = 'be-toggle-header-block be-block';
    header.setAttribute('data-drag-id', 'tog3');
    header.getBoundingClientRect = () => rect(0, 40);
    const children = document.createElement('div');
    children.className = 'be-toggle-children';
    children.getBoundingClientRect = () => rect(40, 60);
    wrap.append(header, children);
    wrap.getBoundingClientRect = () => rect(0, 120);
    root.appendChild(wrap);

    const hit = classifyToggleFooterZone(105, root);
    expect(hit.kind).toBe('footer-candidate');
    expect(hit.toggleId).toBe('tog3');
    expect(hit.insideWrapBelowChildren).toBe(true);
  });

  it('footer-zone classification — miss far below document', () => {
    const wrap = document.createElement('div');
    wrap.className = 'be-toggle-wrap';
    const header = document.createElement('div');
    header.className = 'be-toggle-header-block be-block';
    header.setAttribute('data-drag-id', 'tog4');
    const children = document.createElement('div');
    children.className = 'be-toggle-children';
    children.getBoundingClientRect = () => rect(40, 80);
    wrap.append(header, children);
    root.appendChild(wrap);
    expect(classifyToggleFooterZone(300, root).kind).toBe('none');
  });

  it('nested collapsed toggle — prefers innermost toggle', () => {
    const outer = mountCollapsedToggle('outer', 0, root);
    const nestedHost = document.createElement('div');
    nestedHost.className = 'be-editor-nested';
    outer.wrap.appendChild(nestedHost);
    mountCollapsedToggle('inner', 60, nestedHost);

    const blocks = [
      makeBlock('toggle', {
        id: 'outer',
        content: 'Outer',
        collapsed: true,
        children: [
          makeBlock('toggle', { id: 'inner', content: 'Inner', collapsed: true }),
        ],
      }),
    ];

    expect(toggleNestDepth(outer.wrap)).toBe(0);
    const innerWrap = nestedHost.querySelector('.be-toggle-wrap')!;
    expect(toggleNestDepth(innerWrap)).toBe(1);
    expect(findCollapsedToggleZoneHit(90, root, blocks)).toBe('inner');
  });

  it('collapsedToggleRowBounds uses extension constant', () => {
    const bounds = collapsedToggleRowBounds(rect(10, 40));
    expect(bounds.bottom - bounds.top).toBe(40 + COLLAPSED_TOGGLE_ROW_EXTENSION_PX);
  });

  it('evaluateToggleFooterFeasibility recommends hybrid model', () => {
    const verdict = evaluateToggleFooterFeasibility();
    expect(verdict.feasible).toBe(true);
    expect(verdict.domDetectable).toBe(true);
    expect(verdict.recommendation).toBe('hybrid-model');
  });
});
