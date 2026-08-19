// @vitest-environment happy-dom
/**
 * UX-5E.1D — drag isolation: overlay updates without block-tree rerenders.
 */
import { createElement, type ComponentProps } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BlockEditor } from './BlockEditor';
import { EDITOR_CHROME_STYLES } from './editorChromeStyles';
import { flattenBlockIds, makeBlock, type Block } from './blockUtils';
import type { BlockEditorColors } from './editorTypes';

const colors: BlockEditorColors = {
  bg: '#fff', text: '#111', textMuted: '#666', textFaint: '#999',
  accent: '#8B5CF6', accentBg: '#eee', border: '#ddd', card: '#fff',
  cardHov: '#f5f5f5', input: '#fff', inputBdr: '#ccc', toolbar: '#f9f9f9',
  danger: '#f00', green: '#0f0', codeBg: '#f1f5f9', calloutBg: '#fafafa',
  toggleBg: 'transparent', quoteBdr: '#ccc', selection: '#eef',
};

const ROW_H = 48;

let singleBlockRenderCount = 0;

vi.mock('./features/block-editor/components/SingleBlock', async (importOriginal) => {
  const mod = await importOriginal<typeof import('./features/block-editor/components/SingleBlock')>();
  const Original = mod.SingleBlock;
  return {
    SingleBlock: (props: ComponentProps<typeof Original>) => {
      singleBlockRenderCount += 1;
      return createElement(Original, props);
    },
  };
});

function rect(left: number, top: number, w: number, h: number): DOMRect {
  return {
    left, top, width: w, height: h, right: left + w, bottom: top + h, x: left, y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

function mountEditor(blocks: Block[]) {
  document.body.innerHTML = '';
  document.head.innerHTML = '';
  const style = document.createElement('style');
  style.textContent = EDITOR_CHROME_STYLES;
  document.head.appendChild(style);

  const scrollZone = document.createElement('div');
  scrollZone.className = 'editor-drop-zone';
  scrollZone.style.height = '400px';
  scrollZone.style.overflow = 'auto';
  document.body.appendChild(scrollZone);

  const host = document.createElement('div');
  scrollZone.appendChild(host);

  let root: Root | null = null;
  act(() => {
    root = createRoot(host);
    root.render(createElement(BlockEditor, {
      blocks,
      onChange: () => {},
      colors,
      readOnly: false,
      virtualBlocksPoc: false,
    }));
  });

  const flatIds = flattenBlockIds(blocks);
  flatIds.forEach((id, i) => {
    const block = document.querySelector(`[data-drag-id="${id}"]`) as HTMLElement | null;
    if (!block) return;
    const top = i * ROW_H;
    block.getBoundingClientRect = () => rect(40, top, 360, ROW_H - 4);
    const grip = block.querySelector('.be-grip') as HTMLElement | null;
    if (grip) grip.getBoundingClientRect = () => rect(40, top + 8, 26, 26);
  });

  const hitTest = (x: number, y: number): Element[] => {
    const idx = Math.floor(y / ROW_H);
    if (idx < 0 || idx >= flatIds.length) return [];
    const id = flatIds[idx];
    const block = document.querySelector(`[data-drag-id="${id}"]`) as HTMLElement | null;
    return block ? [block] : [];
  };
  if (typeof document.elementsFromPoint === 'function') {
    vi.spyOn(document, 'elementsFromPoint').mockImplementation(hitTest);
  } else {
    document.elementsFromPoint = hitTest;
  }

  return { root, flatIds };
}

describe('drag isolation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
    document.head.innerHTML = '';
    singleBlockRenderCount = 0;
  });

  it('updates overlay indicators without rerendering SingleBlock on pointer move', () => {
    const blocks = Array.from({ length: 12 }, (_, i) =>
      makeBlock('paragraph', { id: `b${i}`, content: `${i}` }),
    );
    const { flatIds } = mountEditor(blocks);
    const rendersAfterMount = singleBlockRenderCount;

    const grip = document.querySelector(`[data-drag-id="b11"] .be-grip`) as HTMLElement;
    const startY = 11 * ROW_H + 12;

    act(() => {
      grip.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        clientX: 58,
        clientY: startY,
        pointerId: 1,
        button: 0,
        buttons: 1,
        pointerType: 'mouse',
      }));
    });

    act(() => {
      window.dispatchEvent(new PointerEvent('pointermove', {
        bubbles: true,
        cancelable: true,
        clientX: 200,
        clientY: startY + 12,
        pointerId: 1,
        button: 0,
        buttons: 1,
        pointerType: 'mouse',
      }));
    });

    for (let i = 0; i < 5; i++) {
      act(() => {
        window.dispatchEvent(new PointerEvent('pointermove', {
          bubbles: true,
          cancelable: true,
          clientX: 200,
          clientY: flatIds.indexOf(`b${i}`) * ROW_H + 12,
          pointerId: 1,
          button: 0,
          buttons: 1,
          pointerType: 'mouse',
        }));
      });
    }

    act(() => {
      window.dispatchEvent(new PointerEvent('pointermove', {
        bubbles: true,
        cancelable: true,
        clientX: 200,
        clientY: 36,
        pointerId: 1,
        button: 0,
        buttons: 1,
        pointerType: 'mouse',
      }));
    });
    const afterTarget = document.querySelector('[data-drag-id="b0"]') as HTMLElement;
    expect(afterTarget.classList.contains('be-drop-target-after')).toBe(true);

    act(() => {
      window.dispatchEvent(new PointerEvent('pointermove', {
        bubbles: true,
        cancelable: true,
        clientX: 200,
        clientY: 4 * ROW_H + 12,
        pointerId: 1,
        button: 0,
        buttons: 1,
        pointerType: 'mouse',
      }));
    });

    const firstTarget = document.querySelector('[data-drag-id="b0"]') as HTMLElement;
    const finalTarget = document.querySelector('[data-drag-id="b4"]') as HTMLElement;
    expect(firstTarget.classList.contains('be-drop-target')).toBe(false);
    expect(finalTarget.classList.contains('be-drop-target')).toBe(true);
    expect(finalTarget.classList.contains('be-drop-target-before')).toBe(true);
    expect(document.querySelectorAll('.be-drop-target')).toHaveLength(1);
    expect(document.querySelector('.be-drop-highlight')).toBeFalsy();
    expect(document.querySelector('.be-drop-line')).toBeFalsy();
    expect(singleBlockRenderCount).toBe(rendersAfterMount);
    expect(document.querySelector('.be-block.be-dragging')).toBeTruthy();

    act(() => {
      window.dispatchEvent(new PointerEvent('pointerup', {
        bubbles: true,
        cancelable: true,
        clientX: 200,
        clientY: 4 * ROW_H + 12,
        pointerId: 1,
        button: 0,
        buttons: 0,
        pointerType: 'mouse',
      }));
    });

    expect(document.querySelectorAll('.be-drop-target')).toHaveLength(0);
    expect(document.querySelector('.be-drop-highlight')).toBeFalsy();
    expect(document.querySelector('.be-drop-line')).toBeFalsy();
  });
});
