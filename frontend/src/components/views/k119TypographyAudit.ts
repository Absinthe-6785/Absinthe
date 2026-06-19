/**
 * K-119 — Typography & density audit.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export function auditTypographyDensity(): Record<string, boolean> {
  const empty = readFileSync(join(ROOT, 'components/common/ProductEmptyState.tsx'), 'utf8');
  const settings = readFileSync(join(ROOT, 'components/views/SettingsView.tsx'), 'utf8');
  const layout = readFileSync(join(ROOT, 'components/common/workspaceLayout.tsx'), 'utf8');
  return {
    emptyTitleSize: empty.includes('emptyStateTitleFontPx'),
    settingsTighterCards: settings.includes('lg:rounded-[24px]'),
    workspaceGap: layout.includes('WORKSPACE_GAP_CLASS'),
    densityTokens: empty.includes('UI_DENSITY'),
    spacingTokens: layout.includes('WORKSPACE_GAP_CLASS'),
  };
}

export function auditTypographyRc(): boolean {
  const r = auditTypographyDensity();
  return r.emptyTitleSize && r.workspaceGap && r.densityTokens;
}
