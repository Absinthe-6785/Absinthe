/**
 * K-120 — UI token adoption audit.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export const K120_TOKEN_TARGETS = [
  'health',
  'recipe',
  'search',
  'block-editor-menu',
] as const;

export function auditTokenAdoption(): Record<string, boolean> {
  const health = readFileSync(join(ROOT, 'components/views/HealthView.tsx'), 'utf8');
  const recipe = readFileSync(join(ROOT, 'components/views/features/recipe/components/RecipeStudioView.tsx'), 'utf8');
  const search = readFileSync(join(ROOT, 'components/views/features/search/components/SearchWorkspacePalette.tsx'), 'utf8');
  const menu = readFileSync(join(ROOT, 'components/views/features/block-editor/features/menus/components/BlockContextMenu.tsx'), 'utf8');
  return {
    healthSpacing: health.includes('UI_SPACING'),
    recipeInteraction: recipe.includes('UI_INTERACTION'),
    recipeSpacing: recipe.includes('UI_SPACING'),
    searchInteraction: search.includes('UI_INTERACTION'),
    searchSpacing: search.includes('UI_SPACING'),
    editorMenuTokens: menu.includes('UI_INTERACTION') && menu.includes('UI_DENSITY'),
    editorMenuHook: menu.includes('data-k120-editor-context-menu'),
  };
}

export function auditTokenRc(): boolean {
  const r = auditTokenAdoption();
  return r.healthSpacing && r.recipeInteraction && r.searchInteraction && r.editorMenuTokens;
}
