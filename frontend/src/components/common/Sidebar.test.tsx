import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { Sidebar } from '../common/Sidebar';
import { UI_INTERACTION } from '../../lib/uiInteractionTokens';

const baseProps = () => ({
  activeTab: 'note' as const,
  setActiveTab: () => {},
  appSettings: { darkMode: false, language: 'en' as const, defaultCategory: 'Study' as const },
  updateSetting: () => {},
  handleSignOut: () => {},
  userName: 'Test',
  onOpenSettingsSection: () => {},
});

describe('Sidebar mobile navigation', () => {
  it('renders mobile More trigger and hides desktop utility buttons on small screens', () => {
    const html = renderToStaticMarkup(createElement(Sidebar, baseProps()));
    expect(html).toContain('data-k126-mobile-more-trigger');
    expect(html).toContain('data-k126-mobile-sidebar');
    expect(html).toContain('hidden lg:flex');
    expect(html).toContain('flex lg:hidden');
  });

  it('keeps primary workspace tabs', () => {
    const html = renderToStaticMarkup(createElement(Sidebar, baseProps()));
    expect(html).toContain('aria-label="Note"');
    expect(html).toContain('aria-label="Health"');
    expect(html).toContain('aria-label="Archive"');
    expect(html).toContain('aria-label="Schedule"');
    expect(html).toContain('aria-label="Recipe"');
  });

  it('keeps dimensions while routing selected and focus states through semantic authority', () => {
    const host = document.createElement('div');
    host.innerHTML = renderToStaticMarkup(createElement(Sidebar, baseProps()));
    const sidebar = host.querySelector<HTMLElement>('[data-k126-mobile-sidebar]')!;
    const selected = sidebar.querySelector<HTMLElement>('[aria-label="Note"]')!;

    expect(sidebar.classList.contains('abs-cosmos-sidebar')).toBe(true);
    expect(sidebar.classList.contains('lg:w-[72px]')).toBe(true);
    expect(selected.classList.contains('bg-selected')).toBe(true);
    expect(selected.classList.contains('bg-primary')).toBe(false);
    for (const focusClass of UI_INTERACTION.focusRingClass.split(/\s+/)) {
      expect(selected.classList.contains(focusClass)).toBe(true);
    }

    const marker = sidebar.querySelector<SVGElement>('[data-pixel-cosmos-mark][data-pixel-cosmos-variant="identity"]')!;
    expect(marker.getAttribute('aria-hidden')).toBe('true');
    expect(marker.getAttribute('focusable')).toBe('false');
    expect(marker.classList.contains('pointer-events-none')).toBe(true);
  });
});
