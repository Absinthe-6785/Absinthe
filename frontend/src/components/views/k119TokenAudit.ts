/**
 * K-119 — UI token maintenance audit.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export const K119_TOKEN_FILES = [
  'lib/uiInteractionTokens.ts',
  'lib/uiDensityTokens.ts',
  'lib/uiSpacingTokens.ts',
] as const;

export function auditUiTokens(): Record<string, boolean> {
  const interaction = readFileSync(join(ROOT, 'lib/uiInteractionTokens.ts'), 'utf8');
  const density = readFileSync(join(ROOT, 'lib/uiDensityTokens.ts'), 'utf8');
  const spacing = readFileSync(join(ROOT, 'lib/uiSpacingTokens.ts'), 'utf8');
  const popover = readFileSync(join(ROOT, 'components/common/popover/Popover.tsx'), 'utf8');
  const empty = readFileSync(join(ROOT, 'components/common/ProductEmptyState.tsx'), 'utf8');
  return {
    interactionFile: interaction.includes('UI_INTERACTION'),
    densityFile: density.includes('UI_DENSITY'),
    spacingFile: spacing.includes('UI_SPACING'),
    popoverUsesInteraction: popover.includes('UI_INTERACTION'),
    emptyUsesDensity: empty.includes('UI_DENSITY'),
    touchTargetExported: interaction.includes('touchTargetMinPx'),
    workspaceGapExported: spacing.includes('WORKSPACE_GAP_CLASS'),
  };
}

export function auditTokenRc(): boolean {
  const r = auditUiTokens();
  return Object.values(r).every(Boolean);
}
