/**
 * K-116 — Protein / nutrition theme consistency audit.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export const K116_NUTRITION_SURFACES = [
  'protein-progress',
  'protein-timeline',
  'protein-food-library',
  'protein-quick-add',
] as const;

export function auditNutritionTheme(): Record<string, boolean> {
  const css = readFileSync(join(ROOT, 'index.css'), 'utf8');
  const tracker = readFileSync(
    join(ROOT, 'components/views/features/health/nutrition/ProteinTracker.tsx'),
    'utf8',
  );
  return {
    cssPanelToken: css.includes('--bg-panel') && css.includes('--text-primary'),
    cssBorderToken: css.includes('--border-color'),
    noHardcodedGray200: !tracker.includes('bg-gray-200'),
    noHardcodedGray800: !tracker.includes('hover:bg-gray-800'),
    usesSurfaceAlt: tracker.includes('bg-surface-alt'),
    usesThemeInput: tracker.includes('theme.input'),
    usesBorderBorder: tracker.includes('border-border'),
  };
}

export function auditNutritionThemeRc(): boolean {
  const t = auditNutritionTheme();
  return t.cssPanelToken && t.noHardcodedGray200 && t.usesSurfaceAlt;
}
