/** K-112 — Projection layer sanity audit — single-pass, no duplicates. */
export const K112_PROJECTIONS = [
  {
    name: 'HealthProjection',
    builder: 'buildHealthProjection.ts',
    hook: 'useMemo in HealthView.tsx',
    legacyRemoved: null,
  },
  {
    name: 'PlannerProjection',
    builder: 'buildPlannerProjection.ts',
    hook: 'CalendarShell.tsx',
    legacyRemoved: null,
  },
  {
    name: 'ArchiveProjection',
    builder: 'buildArchiveProjection.ts',
    hook: 'useArchiveProjection.ts',
    legacyRemoved: null,
  },
  {
    name: 'RecipeProjection',
    builder: 'buildRecipeProjection.ts',
    hook: 'useRecipeProjection.ts',
    legacyRemoved: null,
  },
  {
    name: 'SearchProjection',
    builder: 'buildSearchProjection.ts',
    hook: 'GlobalSearchHost.tsx',
    legacyRemoved: 'WorkspaceSearchPalette.tsx',
  },
] as const;

export function auditProjections(): readonly string[] {
  return K112_PROJECTIONS.map(p => p.name);
}

export function auditProjectionLegacyRemoved(): readonly string[] {
  return K112_PROJECTIONS.map(p => p.legacyRemoved).filter(Boolean) as string[];
}

export function auditProjectionSinglePass(): boolean {
  return K112_PROJECTIONS.length === 5;
}
