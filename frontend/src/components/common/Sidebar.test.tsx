import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { Sidebar } from '../common/Sidebar';

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
});
