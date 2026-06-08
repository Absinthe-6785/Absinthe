// @vitest-environment happy-dom
import React from 'react';
import { describe, expect, it } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { SafeBlockRenderer } from './SafeBlockRenderer';
import { makeBlock } from './blockUtils';
import type { BlockEditorColors } from './editorTypes';

const colors: BlockEditorColors = {
  bg: '#fff', text: '#111', textMuted: '#666', textFaint: '#999',
  accent: '#8B5CF6', accentBg: '#eee', border: '#ddd', card: '#fff',
  cardHov: '#f5f5f5', input: '#fff', inputBdr: '#ccc', toolbar: '#f9f9f9',
  danger: '#f00', green: '#0f0', codeBg: '#f1f5f9', calloutBg: '#fafafa',
  toggleBg: 'transparent', quoteBdr: '#ccc', selection: '#eef',
};

function ThrowOnRender({ message }: { message: string }): React.ReactElement {
  throw new Error(message);
}

function renderToDiv(node: React.ReactNode): HTMLDivElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => { root.render(node); });
  return container;
}

describe('SafeBlockRenderer', () => {
  it('renders children when no error', () => {
    const el = renderToDiv(
      <SafeBlockRenderer block={makeBlock('paragraph')} colors={colors}>
        <span data-testid="ok">content</span>
      </SafeBlockRenderer>,
    );
    expect(el.querySelector('[data-testid="ok"]')?.textContent).toBe('content');
  });

  it('shows UnsupportedBlock when child throws', () => {
    const block = { ...makeBlock('table'), type: 'table' as const };
    const el = renderToDiv(
      <SafeBlockRenderer block={block} colors={colors}>
        <ThrowOnRender message="Plus is not defined" />
      </SafeBlockRenderer>,
    );
    expect(el.textContent).toContain('Unsupported block');
    expect(el.textContent).toContain('table');
  });
});
