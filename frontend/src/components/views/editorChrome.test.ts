import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { blockShellClassName, BlockGutter, BlockHandles } from './EditorChrome';
import { shouldShowBlockChrome } from './editorReading';
import { GRIP_DRAG_TITLE, GUTTER_RANGE_TITLE } from './features/block-editor/utils/editorDiscoverability';

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
});
