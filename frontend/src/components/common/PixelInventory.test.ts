import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  PixelInventoryCard,
  PixelStatusBadge,
  type PixelInventoryColors,
  type PixelInventoryState,
} from './PixelInventory';

const colors: PixelInventoryColors = {
  card: '#ffffff',
  sideBdr: '#dddddd',
  text: '#111111',
  textMuted: '#555555',
  textFaint: '#888888',
  accent: '#7c3aed',
  accentBg: '#f5f3ff',
  danger: '#dc2626',
  green: '#16a34a',
};

describe('PixelInventory pilot primitives', () => {
  it.each([
    ['ready', 'Ready', 'Inventory slot'],
    ['blocked', 'Blocked', 'Locked slot'],
    ['manual-review', 'Manual Review', 'Review slot'],
    ['synced', 'Synced', 'Archived slot'],
    ['missing', 'Missing Local', 'Broken slot'],
    ['recoverable', 'Recoverable', 'Remote signal'],
  ] satisfies Array<[PixelInventoryState, string, string]>)('renders %s with readable state text', (state, label, motif) => {
    const html = renderToStaticMarkup(createElement(PixelStatusBadge, { state, colors }));

    expect(html).toContain('data-pixel-status-badge');
    expect(html).toContain(`data-pixel-inventory-state="${state}"`);
    expect(html).toContain(label);
    expect(html).toContain(motif);
  });

  it('renders a card as an inventory slot with title, count, and text content', () => {
    const html = renderToStaticMarkup(
      createElement(
        PixelInventoryCard,
        { state: 'ready', colors, title: 'Ready for manual upload', count: 2, testId: 'upload-queue-ready' },
        createElement('p', null, 'Upload is explicit and limited to selected Ready items.'),
      ),
    );

    expect(html).toContain('data-pixel-inventory-card');
    expect(html).toContain('data-pixel-marker="slot-ready"');
    expect(html).toContain('Ready for manual upload');
    expect(html).toContain('Ready');
    expect(html).toContain('Inventory slot');
    expect(html).toContain('2');
    expect(html).toContain('Upload is explicit and limited to selected Ready items.');
  });

  it('does not make state icon-only or color-only', () => {
    const html = renderToStaticMarkup(createElement(PixelStatusBadge, { state: 'blocked', colors }));

    expect(html).toContain('Blocked');
    expect(html).toContain('Locked slot');
    expect(html).toContain('data-pixel-marker="slot-locked"');
    expect(html).toContain('data-pixel-inventory-state="blocked"');
  });

  it('keeps long titles and counts in the card without dropping status text', () => {
    const html = renderToStaticMarkup(
      createElement(
        PixelInventoryCard,
        {
          state: 'manual-review',
          colors,
          title: 'Needs manual review for attachment-with-a-very-long-local-blob-name',
          count: 12,
          testId: 'upload-queue-manual-review',
        },
        createElement('button', { type: 'button' }, 'Upload this item'),
      ),
    );

    expect(html).toContain('Needs manual review for attachment-with-a-very-long-local-blob-name');
    expect(html).toContain('12');
    expect(html).toContain('Manual Review');
    expect(html).toContain('Review slot');
    expect(html).toContain('Upload this item');
  });
});
