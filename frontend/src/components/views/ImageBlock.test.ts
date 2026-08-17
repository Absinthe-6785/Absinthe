// @vitest-environment happy-dom
import { act } from 'react';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Block } from './blockUtils';
import type { BlockEditorColors } from './editorTypes';
import { ImageBlock } from './ImageBlock';

vi.mock('../../hooks/useViewportLayout', () => ({
  useViewportLayout: () => ({ width: 1024, isMobile: false, isTablet: false, isNarrow: false }),
}));

vi.mock('../../lib/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key, lang: 'en' }),
}));

const colors = {
  card: '#fff', border: '#ddd', accent: '#7c3aed', accentBg: '#f5f3ff',
  input: '#fff', inputBdr: '#ddd', text: '#111', textMuted: '#555', textFaint: '#888', danger: '#dc2626',
} as BlockEditorColors;

const imageBlock = (src = 'https://example.test/image.png'): Block => ({
  id: 'image-1', type: 'image', content: '', children: [], indent: 0, src, alt: 'Existing image',
});
function render(element: ReturnType<typeof createElement>) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => root.render(element));
  return { host, root };
}

function cleanup(root: Root, host: HTMLElement) {
  act(() => root.unmount());
  host.remove();
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('ImageBlock Return-to-Use attachment isolation', () => {
  it('keeps existing images readable and blocks upload, replacement, URL, deletion, and drop mutations', () => {
    vi.stubEnv('VITE_ABSINTHE_RETURN_TO_USE_ATTACHMENT_ISOLATION', 'true');
    const onChange = vi.fn();
    const { host, root } = render(createElement(ImageBlock, {
      block: imageBlock(), colors, readOnly: false, onChange,
    }));

    expect(host.querySelector('img[src="https://example.test/image.png"]')).not.toBeNull();
    expect(host.querySelector('[data-k108-image-replace-file]')).toBeNull();
    expect(host.querySelector('[data-k108-image-replace-url]')).toBeNull();
    expect(host.querySelector('[data-k108-image-delete]')).toBeNull();

    const zone = host.querySelector('[data-k108-image-block]');
    if (!(zone instanceof HTMLElement)) throw new Error('image block missing');
    const file = new File(['image'], 'drop.png', { type: 'image/png' });
    const paste = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(paste, 'clipboardData', {
      value: { items: [{ type: 'image/png', getAsFile: () => file }] },
    });
    act(() => zone.dispatchEvent(paste));
    const drop = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(drop, 'dataTransfer', { value: { files: [file], items: [] } });
    act(() => zone.dispatchEvent(drop));

    expect(onChange).not.toHaveBeenCalled();
    cleanup(root, host);
  });

  it('leaves a read-only existing image available while isolation is active', () => {
    vi.stubEnv('VITE_ABSINTHE_RETURN_TO_USE_ATTACHMENT_ISOLATION', 'true');
    const onChange = vi.fn();
    const { host, root } = render(createElement(ImageBlock, {
      block: imageBlock(), colors, readOnly: true, onChange,
    }));

    expect(host.querySelector('img[src="https://example.test/image.png"]')).not.toBeNull();
    expect(host.querySelector('[data-k108-image-delete]')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
    cleanup(root, host);
  });
});
