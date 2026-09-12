import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PixelDecorativeMark, type PixelDecorativeMarkVariant } from './PixelDecorativeMark';

const componentPath = join(process.cwd(), 'src', 'components', 'common', 'PixelDecorativeMark.tsx');
const sidebarPath = join(process.cwd(), 'src', 'components', 'common', 'Sidebar.tsx');

const variants: readonly PixelDecorativeMarkVariant[] = ['identity', 'trace', 'orbit'];

describe('PixelDecorativeMark authority', () => {
  it.each(variants)('renders the %s variant as hidden, non-focusable crisp SVG', variant => {
    const html = renderToStaticMarkup(createElement(PixelDecorativeMark, { variant }));

    expect(html).toContain('<svg');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('focusable="false"');
    expect(html).toContain('shape-rendering="crispEdges"');
    expect(html).toContain('pointer-events-none');
    expect(html).toContain(`data-pixel-cosmos-variant="${variant}"`);
    expect(html).not.toContain('<title');
    expect(html).not.toContain('role=');
    expect(html).not.toContain('tabindex=');
  });

  it('keeps a bounded integer-scale size API', () => {
    const xs = renderToStaticMarkup(createElement(PixelDecorativeMark, { variant: 'identity', size: 'xs' }));
    const sm = renderToStaticMarkup(createElement(PixelDecorativeMark, { variant: 'identity', size: 'sm' }));
    const md = renderToStaticMarkup(createElement(PixelDecorativeMark, { variant: 'identity', size: 'md' }));

    expect(xs).toContain('width="12" height="12"');
    expect(sm).toContain('width="24" height="24"');
    expect(md).toContain('width="36" height="36"');
  });

  it('uses only existing decorative Cosmos roles with no semantic-state API', () => {
    const source = readFileSync(componentPath, 'utf8');

    for (const role of ['pale-blue-dot', 'starlight', 'orbit', 'satellite', 'trace-glow']) {
      expect(source).toContain(`var(--cosmos-${role})`);
    }
    for (const semanticRole of ['--color-selected', '--color-focus', '--color-disabled', '--color-warning', '--color-danger', '--color-success']) {
      expect(source).not.toContain(semanticRole);
    }
    expect(source).not.toMatch(/\b(selected|focused|disabled|warning|danger|success|syncing|favorite)\b/);
  });

  it('is static, local, and free of heavyweight asset machinery', () => {
    const source = readFileSync(componentPath, 'utf8');

    for (const forbidden of [
      /https?:\/\//,
      /<animate\b/,
      /animation/i,
      /requestAnimationFrame/,
      /setInterval/,
      /setTimeout/,
      /<canvas\b/,
      /WebGL/,
      /filter=/,
      /href=/,
      /\.(?:png|jpe?g|webp|gif|woff2?)['"]/
    ]) {
      expect(source).not.toMatch(forbidden);
    }
  });

  it('replaces the existing Sidebar decoration without replacing icons', () => {
    const sidebar = readFileSync(sidebarPath, 'utf8');

    expect(sidebar).toContain("<PixelDecorativeMark variant=\"identity\"");
    expect(sidebar).toContain("from 'lucide-react'");
    expect(sidebar).toContain('<Icon size={20} strokeWidth={2.25} />');
  });
});
