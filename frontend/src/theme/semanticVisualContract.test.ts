// @vitest-environment happy-dom
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';

import { WorkspaceCardSkeleton } from '../components/common/WorkspaceCardSkeleton';
import { ProductEmptyState } from '../components/common/ProductEmptyState';
import { WorkspacePageHeader } from '../components/common/WorkspacePageHeader';
import { WorkspaceSectionNav } from '../components/common/WorkspaceSectionNav';
import { WorkspaceToolbarIconButton, WorkspaceToolbarPrimary } from '../components/common/WorkspaceToolbar';
import {
  WORKSPACE_CARD_SURFACE,
  WORKSPACE_MODAL_SURFACE,
  WORKSPACE_SURFACE_ROLE,
} from '../components/common/workspaceCardSizes';
import { UI_INTERACTION } from '../lib/uiInteractionTokens';
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

  it('routes shared card and modal appearance through elevated surface authority', () => {
    expect(WORKSPACE_SURFACE_ROLE).toEqual({
      card: {
        colorClass: 'bg-surface-elevated text-foreground',
        radiusClass: 'rounded-absinthe-xl',
        shadowClass: 'shadow-sm',
      },
      modal: {
        colorClass: 'bg-surface-elevated text-foreground',
        radiusClass: 'rounded-absinthe-xl',
        shadowClass: 'shadow-absinthe-md',
      },
    });
  });

  it('routes shared selected, focus, and disabled appearance through VIS-02 semantics', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const theme = buildThemeClasses();

    await act(async () => root.render(createElement('div', null,
      createElement(WorkspaceSectionNav, {
        items: [{ id: 'active', label: 'Active' }, { id: 'idle', label: 'Idle' }],
        mode: 'toggle',
        active: 'active',
        onSelect: () => undefined,
        theme,
        ariaLabel: 'Sections',
        dataHook: 'visual-authority',
      }),
      createElement(WorkspaceToolbarPrimary, {
        label: 'Disabled action',
        onClick: () => undefined,
        disabled: true,
      }),
      createElement(WorkspaceToolbarIconButton, {
        label: 'Selected tool',
        icon: createElement('span'),
        onClick: () => undefined,
        active: true,
      }),
    )));

    const selectedNav = container.querySelector<HTMLElement>('[data-k125-section-nav-item="active"]')!;
    const disabledPrimary = container.querySelector<HTMLButtonElement>('[data-k119-toolbar-primary]')!;
    const selectedTool = container.querySelector<HTMLElement>('[data-k119-toolbar-icon]')!;

    expect(selectedNav.classList.contains('bg-selected')).toBe(true);
    expect(selectedNav.classList.contains('bg-primary')).toBe(false);
    for (const focusClass of UI_INTERACTION.focusRingClass.split(/\s+/)) {
      expect(selectedNav.classList.contains(focusClass)).toBe(true);
    }
    expect(disabledPrimary.disabled).toBe(true);
    expect(disabledPrimary.classList.contains('disabled:bg-surface-muted')).toBe(true);
    expect(disabledPrimary.classList.contains('disabled:text-disabled')).toBe(true);
    expect(selectedTool.classList.contains('bg-selected')).toBe(true);

    act(() => root.unmount());
  });

  it('routes shared CSS focus helpers through the semantic focus variable', () => {
    expect(UI_INTERACTION.focusRingClass).toContain('focus-visible:outline-focus');
    expect(UI_INTERACTION.focusRingClass).not.toContain('focus-visible:outline-primary');

    const css = readFileSync(join(process.cwd(), 'src', 'index.css'), 'utf8');
    const focusRule = css.match(/\.abs-focus-ring:focus-visible\s*\{([^}]*)\}/s)?.[1];
    const skipLinkRule = css.match(/\.abs-skip-link:focus\s*\{([^}]*)\}/s)?.[1];
    expect(focusRule).toContain('var(--color-focus)');
    expect(skipLinkRule).toContain('var(--color-focus)');
  });

  it('keeps danger-filled controls on a measured semantic fill authority', () => {
    const css = readFileSync(join(process.cwd(), 'src', 'index.css'), 'utf8');
    const baseRule = css.match(/\.abs-danger-filled-control\s*\{([^}]*)\}/s)?.[1];
    const darkRule = css.match(/\[data-theme='dark'\] \.abs-danger-filled-control\s*\{([^}]*)\}/s)?.[1];
    const confirmModal = readFileSync(join(process.cwd(), 'src', 'components', 'common', 'ConfirmModal.tsx'), 'utf8');
    const appContent = readFileSync(join(process.cwd(), 'src', 'components', 'AppContent.tsx'), 'utf8');

    expect(baseRule).toContain('var(--color-primary-fg)');
    expect(baseRule).toContain('var(--color-danger)');
    expect(darkRule).toContain('var(--color-danger) 70%');
    expect(darkRule).toContain('var(--color-background)');
    expect(confirmModal).toContain('abs-danger-filled-control');
    expect(appContent).toContain('abs-danger-filled-control');
  });

  it('stops every identified continuous animation authority under reduced motion', () => {
    const css = readFileSync(join(process.cwd(), 'src', 'index.css'), 'utf8');
    const reducedMotion = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
    const app = readFileSync(join(process.cwd(), 'src', 'App.tsx'), 'utf8');
    const skeleton = readFileSync(join(process.cwd(), 'src', 'components', 'common', 'WorkspaceCardSkeleton.tsx'), 'utf8');
    const interactionTokens = readFileSync(join(process.cwd(), 'src', 'theme', 'k99InteractionTokens.ts'), 'utf8');
    const noteEditor = readFileSync(join(process.cwd(), 'src', 'components', 'views', 'noteview', 'NoteViewEditorArea.tsx'), 'utf8');
    const noteGraph = readFileSync(join(process.cwd(), 'src', 'components', 'views', 'NoteGraphView.tsx'), 'utf8');
    const pixelMark = readFileSync(join(process.cwd(), 'src', 'components', 'common', 'PixelDecorativeMark.tsx'), 'utf8');

    expect(app).toContain('animate-spin');
    expect(skeleton).toContain('animate-pulse');
    expect(css).toContain('.k100-skeleton-pulse');
    expect(interactionTokens).toContain('.k101-skeleton-pulse');
    expect(noteEditor).toContain('abs-continuous-status-pulse');

    for (const authority of [
      '.animate-spin',
      '.animate-pulse',
      '.k100-skeleton-pulse',
      '.k101-skeleton-pulse',
      '.abs-continuous-status-pulse',
    ]) {
      expect(reducedMotion, authority).toContain(authority);
    }
    expect(reducedMotion).toContain('animation: none !important');
    expect(reducedMotion).not.toContain('display: none');
    expect(noteGraph).toMatch(/@media \(prefers-reduced-motion: reduce\)[^]*\.ku-star-pulse, \.ku-active-pulse \{ animation: none; \}/);
    expect(pixelMark).not.toMatch(/animation|animate-/);
  });

  it('keeps the production Cosmos layer decorative and independent from semantic state', () => {
    const css = readFileSync(join(process.cwd(), 'src', 'index.css'), 'utf8');
    const sidebarSource = readFileSync(join(process.cwd(), 'src', 'components', 'common', 'Sidebar.tsx'), 'utf8');
    const decorativeAssetSource = readFileSync(join(process.cwd(), 'src', 'components', 'common', 'PixelDecorativeMark.tsx'), 'utf8');
    const shellRule = css.match(/\.abs-cosmos-shell\s*\{([^}]*)\}/s)?.[1];
    const shellDecorationRule = css.match(/\.abs-cosmos-shell::before\s*\{([^}]*)\}/s)?.[1];
    const sidebarRule = css.match(/\.abs-cosmos-sidebar\s*\{([^}]*)\}/s)?.[1];

    expect(shellRule).toContain('var(--cosmos-void)');
    expect(shellDecorationRule).toContain('pointer-events: none');
    expect(sidebarRule).toContain('var(--cosmos-orbit)');
    expect(sidebarRule).toContain('var(--cosmos-starlight)');
    expect(decorativeAssetSource).toContain('var(--cosmos-pale-blue-dot)');
    expect(decorativeAssetSource).toContain('pointer-events-none');
    expect(decorativeAssetSource).not.toContain('--color-selected');
    expect(sidebarSource).toContain("'bg-selected text-primary-foreground shadow-absinthe-sm'");
    expect(sidebarSource).not.toContain("'bg-primary text-primary-foreground shadow-absinthe-sm'");
    expect(sidebarSource).toContain('UI_INTERACTION.focusRingClass');
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
