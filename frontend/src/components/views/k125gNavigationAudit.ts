/**
 * K-125G — Global navigation & layout cohesion audit.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const TARGET_VIEWS = [
  'components/views/noteview/NoteViewSidebar.tsx',
  'components/views/HealthView.tsx',
  'components/views/PlannerView.tsx',
  'components/views/features/archive/ArchiveUnifiedView.tsx',
  'components/views/features/recipe/components/RecipeStudioView.tsx',
  'components/views/SettingsView.tsx',
] as const;

export function auditK125gPageHeaders(): Record<string, boolean> {
  const reads = Object.fromEntries(
    TARGET_VIEWS.map(rel => [rel, readFileSync(join(ROOT, rel), 'utf8')]),
  ) as Record<(typeof TARGET_VIEWS)[number], string>;

  return {
    sharedHeaderComponent: readFileSync(join(ROOT, 'components/common/WorkspacePageHeader.tsx'), 'utf8').includes('data-k125-workspace-header'),
    notesHeader: reads['components/views/noteview/NoteViewSidebar.tsx'].includes('WorkspacePageHeader'),
    healthHeader: reads['components/views/HealthView.tsx'].includes('WorkspacePageHeader'),
    scheduleHeader: reads['components/views/PlannerView.tsx'].includes('WorkspacePageHeader'),
    archiveHeader: reads['components/views/features/archive/ArchiveUnifiedView.tsx'].includes('WorkspacePageHeader'),
    recipeHeader: reads['components/views/features/recipe/components/RecipeStudioView.tsx'].includes('WorkspacePageHeader'),
    settingsHeader: reads['components/views/SettingsView.tsx'].includes('WorkspacePageHeader'),
    unifiedTitleScale: reads['components/views/SettingsView.tsx'].includes('WorkspacePageHeader')
      && !reads['components/views/SettingsView.tsx'].includes('text-2xl lg:text-3xl'),
  };
}

export function auditK125gSectionNav(): Record<string, boolean> {
  const sectionNav = readFileSync(join(ROOT, 'components/common/WorkspaceSectionNav.tsx'), 'utf8');
  const healthNav = readFileSync(join(ROOT, 'components/views/features/health/HealthWorkspaceNav.tsx'), 'utf8');
  const scheduleNav = readFileSync(join(ROOT, 'components/views/features/planner/ScheduleSectionNav.tsx'), 'utf8');
  const notesSidebar = readFileSync(join(ROOT, 'components/views/noteview/NoteViewSidebar.tsx'), 'utf8');

  return {
    sharedSectionNav: sectionNav.includes('data-k125-section-nav'),
    healthDelegates: healthNav.includes('WorkspaceSectionNav'),
    scheduleDelegates: scheduleNav.includes('WorkspaceSectionNav'),
    notesListFilterDelegates: notesSidebar.includes('WorkspaceSectionNav'),
    noParallelScheduleWorkspaceNav: !readFileSync(join(ROOT, 'components/views/PlannerView.tsx'), 'utf8').includes('ScheduleWorkspaceNav'),
    scheduleLegacyHook: scheduleNav.includes('data-k117-schedule-section-nav'),
  };
}

export function auditK125gSpacingAndCards(): Record<string, boolean> {
  const health = readFileSync(join(ROOT, 'components/views/HealthView.tsx'), 'utf8');
  const settings = readFileSync(join(ROOT, 'components/views/SettingsView.tsx'), 'utf8');
  const cardSizes = readFileSync(join(ROOT, 'components/common/workspaceCardSizes.ts'), 'utf8');

  return {
    healthGapToken: health.includes('lg:gap-4'),
    settingsCardSurface: settings.includes('WORKSPACE_CARD_SURFACE'),
    cardSurfaceToken: cardSizes.includes('WORKSPACE_CARD_SURFACE'),
    settingsWorkspaceHook: settings.includes('data-workspace="settings"'),
  };
}

export function auditK125gEmptyStates(): Record<string, boolean> {
  const archive = readFileSync(join(ROOT, 'components/views/features/archive/ArchiveUnifiedView.tsx'), 'utf8');

  return {
    archiveProductEmpty: archive.includes('ProductEmptyState') && archive.includes('data-k121-empty-state="archive-unified"'),
    archiveEmptyAction: archive.includes('k125ArchiveEmptyAction'),
  };
}

export function auditK125gRc(): boolean {
  const checks = [
    ...Object.values(auditK125gPageHeaders()),
    ...Object.values(auditK125gSectionNav()),
    ...Object.values(auditK125gSpacingAndCards()),
    ...Object.values(auditK125gEmptyStates()),
  ];
  return checks.every(Boolean);
}
