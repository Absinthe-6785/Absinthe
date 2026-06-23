/**
 * K-127 — Design system pass audit.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const WORKSPACE_VIEWS = [
  'components/views/HealthView.tsx',
  'components/views/SettingsView.tsx',
  'components/views/features/archive/ArchiveUnifiedView.tsx',
  'components/views/PlannerView.tsx',
  'components/views/features/recipe/components/RecipeStudioView.tsx',
] as const;

export function auditK127CardSurface(): Record<string, boolean> {
  const cards = readFileSync(join(ROOT, 'components/common/workspaceCardSizes.ts'), 'utf8');
  const skeleton = readFileSync(join(ROOT, 'components/common/WorkspaceCardSkeleton.tsx'), 'utf8');
  const health = readFileSync(join(ROOT, 'components/views/HealthView.tsx'), 'utf8');
  const reads = Object.fromEntries(
    WORKSPACE_VIEWS.map(rel => [rel, readFileSync(join(ROOT, rel), 'utf8')]),
  ) as Record<(typeof WORKSPACE_VIEWS)[number], string>;

  return {
    cardRadiusToken: cards.includes('WORKSPACE_CARD_RADIUS_CLASS'),
    cardSurfaceToken: cards.includes('WORKSPACE_CARD_SURFACE'),
    btnPrimaryToken: cards.includes('WORKSPACE_BTN_PRIMARY_CLASS'),
    skeletonUsesSurface: skeleton.includes('WORKSPACE_CARD_SURFACE') && skeleton.includes('data-k127-card-skeleton'),
    healthUsesSurface: health.includes('WORKSPACE_CARD_SURFACE'),
    settingsUsesSurface: reads['components/views/SettingsView.tsx'].includes('WORKSPACE_CARD_SURFACE'),
    archiveUsesGap: reads['components/views/features/archive/ArchiveUnifiedView.tsx'].includes('WORKSPACE_GAP_CLASS'),
    plannerModalSurface: reads['components/views/PlannerView.tsx'].includes('WORKSPACE_MODAL_SURFACE'),
    recipeUsesSurface: reads['components/views/features/recipe/components/RecipeStudioView.tsx'].includes('WORKSPACE_CARD_SURFACE'),
    noLegacy32RadiusInHealth: !health.includes('rounded-[32px]'),
  };
}

export function auditK127HeadersAndNav(): Record<string, boolean> {
  const header = readFileSync(join(ROOT, 'components/common/WorkspacePageHeader.tsx'), 'utf8');
  const nav = readFileSync(join(ROOT, 'components/common/WorkspaceSectionNav.tsx'), 'utf8');
  const empty = readFileSync(join(ROOT, 'components/common/ProductEmptyState.tsx'), 'utf8');
  const interaction = readFileSync(join(ROOT, 'lib/uiInteractionTokens.ts'), 'utf8');

  return {
    headerHook: header.includes('data-k127-workspace-header'),
    headerUsesSpacingTokens: header.includes('UI_SPACING.pageHeaderGapPx'),
    sectionNavHook: nav.includes('data-k127-section-nav'),
    sectionNavTouchTarget: nav.includes('min-h-[44px]'),
    emptyStateHook: empty.includes('data-k127-empty-state'),
    emptyUsesBtnToken: empty.includes('WORKSPACE_BTN_PRIMARY_CLASS'),
    interactionBtnRadius: interaction.includes('btnRadiusClass'),
    noteChromeRadius: interaction.includes('noteChromeBtnRadiusPx'),
  };
}

export function auditK127TokenDedup(): Record<string, boolean> {
  const spacing = readFileSync(join(ROOT, 'lib/uiSpacingTokens.ts'), 'utf8');
  const density = readFileSync(join(ROOT, 'lib/uiDensityTokens.ts'), 'utf8');

  return {
    spacingReferencesDensity: spacing.includes('UI_DENSITY.cardPaddingMobilePx'),
    densitySectionLabel: density.includes('sectionLabelFontPx'),
    workspaceGapClass: spacing.includes('WORKSPACE_GAP_CLASS'),
  };
}

export function auditK127Rc(): boolean {
  return [
    ...Object.values(auditK127CardSurface()),
    ...Object.values(auditK127HeadersAndNav()),
    ...Object.values(auditK127TokenDedup()),
  ].every(Boolean);
}
