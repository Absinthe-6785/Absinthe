import type { VaultBackupCloudBlock } from './vaultCloudExport';

const cell = (v: unknown): string => {
  const s = v == null ? '' : String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
};

const toRow = (values: unknown[]): string => values.map(cell).join(',');

function jsonRows(label: string, items: unknown[]): string {
  if (items.length === 0) return `# ${label}\n(empty)\n`;
  const header = toRow(['json']);
  const rows = items.map(item => toRow([JSON.stringify(item)]));
  return `# ${label}\n${header}\n${rows.join('\n')}\n`;
}

/** Human-inspectable CSV sidecars for cloud block in ZIP export. */
export function buildCloudZipSidecars(cloud: VaultBackupCloudBlock): Record<string, string> {
  const files: Record<string, string> = {};
  const p = cloud.planner;
  const h = cloud.health;

  files['cloud/planner-schedules.csv'] = jsonRows('schedules', p.schedules);
  files['cloud/planner-todos.csv'] = jsonRows('todos', p.todos);
  files['cloud/planner-routines.csv'] = jsonRows('routines', p.routines);
  files['cloud/planner-weekly.csv'] = jsonRows('weekly_schedules', p.weeklySchedules);
  files['cloud/planner-recipes.csv'] = jsonRows('recipes', p.recipes);
  files['cloud/workouts.csv'] = jsonRows('workout_logs', h.workoutLogs);
  files['cloud/inbody.csv'] = jsonRows('inbody_logs', h.inbodyLogs);
  files['cloud/exercise-blocks.csv'] = jsonRows('exercise_blocks', h.exerciseBlocks);
  files['cloud/health-routines.csv'] = jsonRows('health_routines', h.healthRoutines);
  files['cloud/protein-sources.csv'] = jsonRows('protein_sources', h.proteinSources);

  files['cloud/README.txt'] = `Absinthe Cloud Export Sidecars
================================
Completeness: ${cloud.completeness}
Fetched at: ${cloud.fetchedAt}
Errors: ${cloud.errors.length ? cloud.errors.join(', ') : 'none'}

Protein daily intake logs are not included (no bulk API).
Full structured data is in manifest.json → cloud block.
`;

  return files;
}
