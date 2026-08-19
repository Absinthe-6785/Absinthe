// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { blockShellClassName, BlockGutter, BlockHandles } from './EditorChrome';
import { shouldShowBlockChrome } from './editorReading';
import { GRIP_DRAG_TITLE, GUTTER_RANGE_TITLE } from './features/block-editor/utils/editorDiscoverability';

interface HandleHarnessState {
  blockClass?: string;
  controlsVisible?: boolean;
  blockId?: string;
  depth?: number;
}

let coarsePointer = false;
let anchorTop = 112;
const roots: Root[] = [];

class TestResizeObserver {
  static instances: TestResizeObserver[] = [];
  readonly observe = vi.fn();
  readonly disconnect = vi.fn();

  constructor(readonly callback: ResizeObserverCallback) {
    TestResizeObserver.instances.push(this);
  }

  unobserve(): void {}

  trigger(): void {
    this.callback([], this as unknown as ResizeObserver);
  }
}

function testRect(top: number, left: number, width: number, height: number): DOMRect {
  return {
    x: left, y: top, top, left, width, height,
    right: left + width, bottom: top + height,
    toJSON: () => ({}),
  } as DOMRect;
}

function HandleHarness({
  blockClass = '',
  controlsVisible = false,
  blockId = 'b1',
  depth = 0,
}: HandleHarnessState) {
  return createElement('div', { className: `be-block ${blockClass}` },
    createElement('div', { className: 'be-gutter' },
      createElement(BlockHandles, {
        blockId,
        depth,
        readOnly: false,
        controlsVisible,
        bindGripPointer: () => {},
        onOpenTurnInto: () => {},
      }),
    ),
    createElement('div', { className: 'be-content' },
      createElement('div', { className: 'be-editable' }, 'multiline content'),
    ),
  );
}

function mountHandleHarness(initial: HandleHarnessState = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  roots.push(root);
  const render = (state: HandleHarnessState) => {
    act(() => root.render(createElement(HandleHarness, state)));
  };
  render(initial);
  return { container, root, render };
}

beforeEach(() => {
  coarsePointer = false;
  anchorTop = 112;
  TestResizeObserver.instances = [];
  vi.stubGlobal('ResizeObserver', TestResizeObserver);
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn((query: string) => ({
      matches: query === '(pointer: coarse)' && coarsePointer,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => true,
    })),
  });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
    if (this.classList.contains('be-block')) return testRect(100, 40, 360, 200);
    if (this.classList.contains('be-editable')) return testRect(anchorTop, 96, 320, 120);
    return testRect(0, 0, 32, 32);
  });
  vi.spyOn(window, 'getComputedStyle').mockReturnValue({ lineHeight: '24px' } as CSSStyleDeclaration);
});

afterEach(() => {
  while (roots.length) {
    const root = roots.pop();
    if (root) act(() => root.unmount());
  }
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('editorChrome', () => {
  it('blockShellClassName includes active and selected', () => {
    expect(blockShellClassName(true, true, false)).toContain('be-block-active');
    expect(blockShellClassName(true, true, false)).toContain('be-block-selected');
  });

  it('shouldShowBlockChrome hidden in reading mode', () => {
    expect(shouldShowBlockChrome(true)).toBe(false);
    expect(shouldShowBlockChrome(false)).toBe(true);
  });

  it('controls visible class', () => {
    expect(blockShellClassName(false, false, true)).toContain('be-controls-visible');
  });

  it('selected without active', () => {
    expect(blockShellClassName(false, true, false)).toContain('be-block-selected');
    expect(blockShellClassName(false, true, false)).not.toContain('be-block-active');
  });

  it('dragging class via extra', () => {
    expect(blockShellClassName(false, false, false, 'be-dragging')).toContain('be-dragging');
  });

  it('active and selected together', () => {
    const cls = blockShellClassName(true, true, false);
    expect(cls).toContain('be-block-active');
    expect(cls).toContain('be-block-selected');
  });

  it('BlockGutter renders dedicated strip element', () => {
    const html = renderToStaticMarkup(
      createElement(BlockGutter, { blockId: 'x', readOnly: false }, null),
    );
    expect(html).toContain('be-gutter');
    expect(html).toContain('be-gutter-strip');
    expect(html).toContain('data-gutter-block-id="x"');
    expect(html).toContain(GUTTER_RANGE_TITLE);
  });

  it('BlockHandles grip exposes drag/menu discoverability labels (UX-5C)', () => {
    const html = renderToStaticMarkup(
      createElement(BlockHandles, {
        blockId: 'b1',
        depth: 0,
        readOnly: false,
        controlsVisible: false,
        bindGripPointer: () => {},
        onOpenTurnInto: () => {},
      }),
    );
    expect(html).toContain('be-grip');
    expect(html).toContain(GRIP_DRAG_TITLE);
  });

  it('skips geometry and observers for a truly hidden virtualized row', () => {
    const rectSpy = vi.mocked(HTMLElement.prototype.getBoundingClientRect);
    const styleSpy = vi.mocked(window.getComputedStyle);
    mountHandleHarness();

    expect(rectSpy).not.toHaveBeenCalled();
    expect(styleSpy).not.toHaveBeenCalled();
    expect(TestResizeObserver.instances).toHaveLength(0);
  });

  it('keeps desktop-selected rows geometry-inactive when the handle stays hidden', () => {
    const rectSpy = vi.mocked(HTMLElement.prototype.getBoundingClientRect);
    mountHandleHarness({ blockClass: 'be-block-selected' });

    expect(rectSpy).not.toHaveBeenCalled();
    expect(TestResizeObserver.instances).toHaveLength(0);
  });

  it('measures hover-visible controls and attaches an observer', () => {
    const { container } = mountHandleHarness({ controlsVisible: true });

    expect(container.querySelector<HTMLElement>('.be-handles')?.style.top).toBe('24px');
    expect(TestResizeObserver.instances).toHaveLength(1);
  });

  it('measures pinned controls through the shared visible-controls state', () => {
    const { container } = mountHandleHarness({ controlsVisible: true });

    expect(container.querySelector<HTMLElement>('.be-handles')?.style.top).toBe('24px');
    expect(TestResizeObserver.instances[0]?.observe).toHaveBeenCalledTimes(1);
  });

  it('measures a keyboard-active block without hover or pin state', () => {
    const { container } = mountHandleHarness({ blockClass: 'be-block-active' });

    expect(container.querySelector<HTMLElement>('.be-handles')?.style.top).toBe('24px');
    expect(TestResizeObserver.instances).toHaveLength(1);
  });

  it('measures a remounted dragging block exposed by CSS', () => {
    const { container } = mountHandleHarness({ blockClass: 'be-dragging' });

    expect(container.querySelector<HTMLElement>('.be-handles')?.style.top).toBe('24px');
    expect(TestResizeObserver.instances).toHaveLength(1);
  });

  it('measures a coarse-pointer selected block', () => {
    coarsePointer = true;
    const { container } = mountHandleHarness({ blockClass: 'be-block-selected' });

    expect(container.querySelector<HTMLElement>('.be-handles')?.style.top).toBe('24px');
    expect(TestResizeObserver.instances).toHaveLength(1);
  });

  it('freshly measures a hidden row when it becomes visible', () => {
    const rectSpy = vi.mocked(HTMLElement.prototype.getBoundingClientRect);
    const { container, render } = mountHandleHarness();
    expect(rectSpy).not.toHaveBeenCalled();

    render({ controlsVisible: true });

    expect(rectSpy).toHaveBeenCalledTimes(2);
    expect(container.querySelector<HTMLElement>('.be-handles')?.style.top).toBe('24px');
  });

  it('disconnects the observer when a visible row becomes hidden', () => {
    const { render } = mountHandleHarness({ controlsVisible: true });
    const observer = TestResizeObserver.instances[0];

    render({ controlsVisible: false });

    expect(observer?.disconnect).toHaveBeenCalledTimes(1);
  });

  it('realigns multiline geometry from current DOM measurements', () => {
    const { container } = mountHandleHarness({ blockClass: 'be-block-active' });
    const handles = container.querySelector<HTMLElement>('.be-handles');
    expect(handles?.style.top).toBe('24px');

    anchorTop = 136;
    act(() => TestResizeObserver.instances[0]?.trigger());

    expect(handles?.style.top).toBe('48px');
  });

  it('freshly aligns a remounted active virtual row instead of retaining top zero', () => {
    const first = mountHandleHarness({ blockClass: 'be-block-active', blockId: 'active' });
    expect(first.container.querySelector<HTMLElement>('.be-handles')?.style.top).toBe('24px');
    act(() => first.root.unmount());
    roots.splice(roots.indexOf(first.root), 1);

    const second = mountHandleHarness({ blockClass: 'be-block-active', blockId: 'active' });
    expect(second.container.querySelector<HTMLElement>('.be-handles')?.style.top).toBe('24px');
  });

  it('keeps drag geometry active until pointer release and then cleans up', () => {
    const { container, render } = mountHandleHarness({ controlsVisible: true });
    const grip = container.querySelector<HTMLElement>('.be-grip');
    const block = container.querySelector<HTMLElement>('.be-block');
    const observer = TestResizeObserver.instances[0];

    act(() => grip?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 7 })));
    block?.classList.add('be-dragging');
    render({ blockClass: 'be-dragging', controlsVisible: false });
    expect(observer?.disconnect).not.toHaveBeenCalled();

    block?.classList.remove('be-dragging');
    act(() => window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 7 })));
    expect(observer?.disconnect).toHaveBeenCalledTimes(1);
  });
});
