/**
 * K-115 — Projection independence audit (six projections, no cycles).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { K112_PROJECTIONS } from '../components/views/k112ProjectionAudit';
import { K113_ACTIVITY_COMPOSER } from '../components/views/k113ProjectionAudit';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const BUILDER_REL_PATHS: Record<string, string> = {
  'buildHealthProjection.ts': 'components/views/features/health/buildHealthProjection.ts',
  'buildPlannerProjection.ts': 'components/views/features/planner/calendar/buildPlannerProjection.ts',
  'buildArchiveProjection.ts': 'components/views/features/knowledge/archive/buildArchiveProjection.ts',
  'buildRecipeProjection.ts': 'components/views/features/recipe/buildRecipeProjection.ts',
  'buildSearchProjection.ts': 'components/views/features/search/buildSearchProjection.ts',
  'buildRecentActivityProjection.ts': 'components/views/buildRecentActivityProjection.ts',
};

export const K115_PROJECTIONS = [
  ...K112_PROJECTIONS,
  K113_ACTIVITY_COMPOSER,
] as const;

export function auditProjectionNames(): readonly string[] {
  return K115_PROJECTIONS.map(p => p.name);
}

export function auditProjectionBuilders(): readonly string[] {
  return K115_PROJECTIONS.map(p => ('builder' in p ? p.builder : ''));
}

/** Each builder must not import another projection builder (no circular deps). */
export function auditProjectionIndependence(): {
  count: number;
  noGlobalProjection: boolean;
  noCircularImports: boolean;
  buildersExist: boolean;
} {
  const builders = K115_PROJECTIONS.map(p => ('builder' in p ? p.builder : '')).filter(Boolean);
  let noCircularImports = true;
  for (const builder of builders) {
    const rel = BUILDER_REL_PATHS[builder];
    if (!rel) continue;
    const src = readFileSync(join(ROOT, rel), 'utf8');
    for (const other of builders) {
      if (other === builder) continue;
      const otherBase = other.replace('.ts', '');
      if (src.includes(`from './${otherBase}'`) || src.includes(`from '../${otherBase}'`)) {
        noCircularImports = false;
      }
    }
  }
  const allExist = builders.every(b => {
    const rel = BUILDER_REL_PATHS[b];
    if (!rel) return false;
    try {
      readFileSync(join(ROOT, rel), 'utf8');
      return true;
    } catch {
      return false;
    }
  });
  return {
    count: K115_PROJECTIONS.length,
    noGlobalProjection: !K115_PROJECTIONS.some(p => 'isGlobal' in p && p.isGlobal),
    noCircularImports,
    buildersExist: allExist,
  };
}

export function auditProjectionRc(): readonly string[] {
  const ind = auditProjectionIndependence();
  return [
    `projections:${ind.count}`,
    ind.noGlobalProjection ? 'no-global' : 'global-found',
    ind.noCircularImports ? 'no-cycles' : 'cycle-risk',
    ind.buildersExist ? 'builders-ok' : 'builders-missing',
  ];
}
