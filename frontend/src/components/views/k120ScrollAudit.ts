/**
 * K-120 — Scroll container cleanup audit.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export const K120_SCROLL_WORKSPACES = ['health', 'recipe', 'search', 'archive'] as const;

export function auditScrollCleanup(): Record<string, boolean> {
  const health = readFileSync(join(ROOT, 'components/views/HealthView.tsx'), 'utf8');
  const recipe = readFileSync(join(ROOT, 'components/views/features/recipe/components/RecipeStudioView.tsx'), 'utf8');
  const search = readFileSync(join(ROOT, 'components/views/features/search/components/SearchWorkspacePalette.tsx'), 'utf8');
  const archive = readFileSync(join(ROOT, 'components/views/features/archive/ArchiveShell.tsx'), 'utf8');
  return {
    healthScroll: health.includes('data-k120-scroll-health'),
    recipeScroll: recipe.includes('data-k120-scroll-recipe'),
    searchScroll: search.includes('data-k120-scroll-search'),
    archiveScroll: archive.includes('data-k120-scroll-archive'),
    overscrollHealth: health.includes('UI_SPACING.scrollOverscroll'),
    overscrollArchive: archive.includes('UI_SPACING.scrollOverscroll'),
  };
}

export function auditScrollRc(): boolean {
  const r = auditScrollCleanup();
  return r.healthScroll && r.recipeScroll && r.searchScroll && r.archiveScroll;
}
