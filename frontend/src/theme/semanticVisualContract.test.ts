// @vitest-environment happy-dom
import { createRequire } from 'node:module';
import { createElement } from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';

import { WorkspaceCardSkeleton } from '../components/common/WorkspaceCardSkeleton';
import { ProductEmptyState } from '../components/common/ProductEmptyState';
import { WorkspacePageHeader } from '../components/common/WorkspacePageHeader';
import {
  WORKSPACE_CARD_SURFACE,
  WORKSPACE_MODAL_SURFACE,
  WORKSPACE_SURFACE_ROLE,
} from '../components/common/workspaceCardSizes';
import { buildThemeClasses } from './buildThemeClasses';
import { DARK_TOKENS, LIGHT_TOKENS } from './tokens';

const require = createRequire(import.meta.url);
const tailwindConfig = require('../../tailwind.config.cjs') as {
  theme: {
    extend: {
      colors: Record<string, string>;
      fontFamily: Record<string, string>;
    };
  };
};

describe('UI-02 semantic visual contract', () => {
  let container: HTMLDivElement | null = null;

  afterEach(() => {
    container?.remove();
    container = null;
  });

  it('maps supported theme values through semantic muted and heading authorities', () => {
    expect(LIGHT_TOKENS.colors.mutedForeground).toBe(LIGHT_TOKENS.colors.muted);
    expect(DARK_TOKENS.colors.mutedForeground).toBe(DARK_TOKENS.colors.muted);
    expect(tailwindConfig.theme.extend.colors['muted-foreground']).toBe('var(--color-muted-foreground)');
    expect(tailwindConfig.theme.extend.fontFamily.heading).toBe('var(--font-heading)');

    const theme = buildThemeClasses();
    expect(theme.textMuted).toBe('text-muted-foreground');
    expect(theme.input).toContain('placeholder:text-muted-foreground');
  });

  it.each([
    ['card', WORKSPACE_CARD_SURFACE],
    ['modal', WORKSPACE_MODAL_SURFACE],
  ] as const)('gives the %s role one radius and one shadow authority', (role, composedClass) => {
    const contract = WORKSPACE_SURFACE_ROLE[role];
    const classes = composedClass.split(/\s+/);
    expect(classes.filter(value => value.startsWith('rounded-'))).toEqual([contract.radiusClass]);
    expect(classes.filter(value => value.startsWith('shadow-'))).toEqual([contract.shadowClass]);
    expect(classes).toEqual(expect.arrayContaining(contract.colorClass.split(' ')));
  });

  it('preserves the previously resolved shared card and modal appearance', () => {
    expect(WORKSPACE_SURFACE_ROLE).toEqual({
      card: {
        colorClass: 'bg-surface text-foreground',
        radiusClass: 'rounded-absinthe-xl',
        shadowClass: 'shadow-sm',
      },
      modal: {
        colorClass: 'bg-surface text-foreground',
        radiusClass: 'rounded-absinthe-xl',
        shadowClass: 'shadow-absinthe-md',
      },
    });
  });

  it('renders representative shared copy with the semantic muted foreground role', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const theme = buildThemeClasses();
    const Icon = () => createElement('span');

    await act(async () => root.render(createElement('div', null,
      createElement(WorkspacePageHeader, {
        workspace: 'semantic-contract',
        title: 'Title',
        subtitle: 'Subtitle',
        theme,
      }),
      createElement(ProductEmptyState, {
        icon: Icon,
        title: 'Empty',
        description: 'Description',
        theme,
        dataHook: 'semantic-contract',
      }),
    )));

    const subtitle = container.querySelector('[data-k127-workspace-header] p');
    const empty = container.querySelector('[data-product-empty="semantic-contract"]');
    expect(subtitle?.classList.contains('text-muted-foreground')).toBe(true);
    expect(empty?.classList.contains('text-muted-foreground')).toBe(true);

    act(() => root.unmount());
  });

  it('keeps a shared card consumer independent from legacy theme.card decoration', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const theme = {
      ...buildThemeClasses(),
      card: 'bg-conflict rounded-conflict shadow-conflict',
    };

    await act(async () => root.render(createElement(WorkspaceCardSkeleton, { theme })));
    const skeleton = container.querySelector('[data-workspace-card-skeleton]');
    expect(skeleton?.classList.contains(WORKSPACE_SURFACE_ROLE.card.radiusClass)).toBe(true);
    expect(skeleton?.classList.contains(WORKSPACE_SURFACE_ROLE.card.shadowClass)).toBe(true);
    expect(skeleton?.classList.contains('rounded-conflict')).toBe(false);
    expect(skeleton?.classList.contains('shadow-conflict')).toBe(false);

    act(() => root.unmount());
  });
});
