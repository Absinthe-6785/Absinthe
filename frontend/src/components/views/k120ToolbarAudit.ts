/**
 * K-120 — Workspace toolbar migration audit.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export const K120_TOOLBAR_DOMAINS = ['health', 'recipe', 'search'] as const;

export function auditToolbarMigration(): Record<string, boolean> {
  const health = readFileSync(join(ROOT, 'components/views/HealthView.tsx'), 'utf8');
  const recipe = readFileSync(join(ROOT, 'components/views/features/recipe/components/RecipeStudioView.tsx'), 'utf8');
  const search = readFileSync(join(ROOT, 'components/views/features/search/components/SearchWorkspacePalette.tsx'), 'utf8');
  const toolbar = readFileSync(join(ROOT, 'components/common/WorkspaceToolbar.tsx'), 'utf8');
  return {
    healthToolbar: health.includes('WorkspaceToolbar') && health.includes('data-k120-health-save'),
    recipeToolbar: recipe.includes('WorkspaceToolbar') && recipe.includes('WorkspaceToolbarPrimary'),
    searchToolbar: search.includes('data-k120-search-toolbar') && search.includes('WorkspaceToolbarIconButton'),
    bottomSticky: toolbar.includes('stickyPosition'),
    scheduleCompactToolbar: readFileSync(join(ROOT, 'components/views/features/planner/PlannerStickyActions.tsx'), 'utf8').includes('data-k121-schedule-toolbar'),
  };
}

export function auditToolbarRc(): boolean {
  const r = auditToolbarMigration();
  return r.healthToolbar && r.recipeToolbar && r.searchToolbar;
}
