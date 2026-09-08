// @vitest-environment happy-dom
import { act } from 'react';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Block } from './blockUtils';
import type { BlockEditorColors } from './editorTypes';
import { ImageBlock } from './ImageBlock';

const viewport = vi.hoisted(() => ({ isMobile: false }));

vi.mock('../../hooks/useViewportLayout', () => ({
  useViewportLayout: () => ({
    width: viewport.isMobile ? 390 : 1024,
    isMobile: viewport.isMobile,
    isTablet: false,
    isNarrow: viewport.isMobile,
  }),
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
  viewport.isMobile = false;
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
    expect(host.querySelector('[data-k108-image-controls]')).toBeNull();
    expect(host.textContent).not.toContain('Attachments are temporarily disabled');

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

  it('omits the disabled-only mobile actions control while preserving the historical image', () => {
    viewport.isMobile = true;
    vi.stubEnv('VITE_ABSINTHE_RETURN_TO_USE_ATTACHMENT_ISOLATION', 'true');
    const { host, root } = render(createElement(ImageBlock, {
      block: imageBlock(), colors, readOnly: false, onChange: vi.fn(),
    }));

    expect(host.querySelector('img[src="https://example.test/image.png"]')).not.toBeNull();
    expect(host.querySelector('[data-k108-image-more]')).toBeNull();
    expect(host.textContent).not.toContain('Attachments are temporarily disabled');
    cleanup(root, host);
  });

  it('keeps an isolated empty image block structurally stable without attachment affordances', () => {
    vi.stubEnv('VITE_ABSINTHE_RETURN_TO_USE_ATTACHMENT_ISOLATION', 'true');
    const onChange = vi.fn();
    const { host, root } = render(createElement(ImageBlock, {
      block: imageBlock(''), colors, readOnly: false, onChange,
    }));

    expect(host.querySelector('[data-k108-image-isolated-empty]')).not.toBeNull();
    expect(host.querySelector('button')).toBeNull();
    expect(host.textContent).not.toContain('Attachments are temporarily disabled');
    expect(host.textContent).not.toContain('blockImageDropPasteHint');

    const zone = host.querySelector('[data-k108-image-block]');
    if (!(zone instanceof HTMLElement)) throw new Error('empty image block missing');
    const file = new File(['image'], 'drop.png', { type: 'image/png' });
    const drop = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(drop, 'dataTransfer', { value: { files: [file], items: [] } });
    act(() => zone.dispatchEvent(drop));
    const paste = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(paste, 'clipboardData', {
      value: { items: [{ type: 'image/png', getAsFile: () => file }] },
    });
    act(() => zone.dispatchEvent(paste));
    expect(onChange).not.toHaveBeenCalled();
    cleanup(root, host);
  });

  it('preserves populated and empty ImageBlock affordances when isolation is disabled', () => {
    vi.stubEnv('VITE_ABSINTHE_RETURN_TO_USE_ATTACHMENT_ISOLATION', 'false');
    const populated = render(createElement(ImageBlock, {
      block: imageBlock(), colors, readOnly: false, onChange: vi.fn(),
    }));
    expect(populated.host.querySelector('[data-k108-image-controls]')).not.toBeNull();
    expect(populated.host.querySelector('[data-k108-image-replace-file]')).not.toBeNull();
    cleanup(populated.root, populated.host);

    viewport.isMobile = true;
    const mobile = render(createElement(ImageBlock, {
      block: imageBlock(), colors, readOnly: false, onChange: vi.fn(),
    }));
    expect(mobile.host.querySelector('[data-k108-image-more]')).not.toBeNull();
    cleanup(mobile.root, mobile.host);
    viewport.isMobile = false;

    const empty = render(createElement(ImageBlock, {
      block: imageBlock(''), colors, readOnly: false, onChange: vi.fn(),
    }));
    expect(empty.host.textContent).toContain('blockImageUpload');
    expect(empty.host.textContent).toContain('blockImageEnterUrl');
    expect(empty.host.textContent).toContain('blockImageDropPasteHint');
    cleanup(empty.root, empty.host);
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
