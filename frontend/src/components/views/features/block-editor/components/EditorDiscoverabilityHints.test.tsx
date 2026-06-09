// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { EmptyDocumentHint, MultiSelectHint } from './EditorDiscoverabilityHints';
import type { BlockEditorColors } from '../../../editorTypes';

const colors: BlockEditorColors = {
  bg: '#fff', text: '#111', textMuted: '#666', textFaint: '#999',
  accent: '#8B5CF6', accentBg: '#eee', border: '#ddd', card: '#fff',
  cardHov: '#f5f5f5', input: '#fff', inputBdr: '#ccc', toolbar: '#f9f9f9',
  danger: '#f00', green: '#0f0', codeBg: '#f1f5f9', calloutBg: '#fafafa',
  toggleBg: 'transparent', quoteBdr: '#ccc', selection: '#eef',
};

describe('EditorDiscoverabilityHints', () => {
  it('MultiSelectHint renders when count > 1', () => {
    const html = renderToStaticMarkup(
      createElement(MultiSelectHint, { count: 2, colors }),
    );
    expect(html).toContain('be-multi-select-hint');
    expect(html).toContain('2 blocks selected');
    expect(html).toContain('Shift+click');
  });

  it('MultiSelectHint hidden for single selection', () => {
    const html = renderToStaticMarkup(
      createElement(MultiSelectHint, { count: 1, colors }),
    );
    expect(html).toBe('');
  });

  it('EmptyDocumentHint renders guidance lines', () => {
    const html = renderToStaticMarkup(
      createElement(EmptyDocumentHint, { visible: true, colors }),
    );
    expect(html).toContain('be-empty-doc-hint');
    expect(html).toContain("Type '/' for commands");
    expect(html).toContain('Paste markdown');
  });

  it('EmptyDocumentHint hidden when not visible', () => {
    const html = renderToStaticMarkup(
      createElement(EmptyDocumentHint, { visible: false, colors }),
    );
    expect(html).toBe('');
  });
});
