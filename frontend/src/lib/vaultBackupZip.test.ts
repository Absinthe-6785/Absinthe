import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import type { NoteBase } from '@/components/views/noteUtils';
import { buildVaultBackupManifest, buildVaultBackupManifestV3 } from './exportVaultBackup';
import type { VaultBackupCloudBlock } from './vaultCloudExport';
import { buildVaultBackupZip, parseVaultBackupZip } from './vaultBackupZip';

function note(id: string, title: string): NoteBase {
  return {
    id,
    title,
    body: `# ${title}\n\nBody`,
    folderId: null,
    starred: false,
    deletedAt: null,
    createdAt: 1,
    updatedAt: 2,
    properties: {},
    relations: { links: ['n2'] },
  };
}

describe('vaultBackupZip', () => {
  it('discloses attachment-byte limits without changing local archive entries or payloads', async () => {
    const manifest = buildVaultBackupManifest(
      [note('n1', 'Alpha'), note('n2', 'Beta')],
      [{ id: 'f1', name: 'Work', createdAt: 1 }],
    );
    const blob = await buildVaultBackupZip(manifest);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const parsed = await parseVaultBackupZip(blob);

    expect(Object.keys(zip.files).sort()).toEqual([
      'README.txt',
      'manifest.json',
      'notes/',
      'notes/Alpha-n1.md',
      'notes/Beta-n2.md',
    ]);
    expect(await zip.file('manifest.json')!.async('string')).toBe(JSON.stringify(manifest, null, 2));
    expect(await zip.file('notes/Alpha-n1.md')!.async('string')).toBe(manifest.notes[0]!.markdown);
    const readme = await zip.file('README.txt')!.async('string');
    expect(readme).toContain('Original attachment binary bytes are not included in ZIP or JSON vault exports.');
    expect(readme).toContain('A successful export means the supported data for that export was written.');

    expect(parsed?.notes).toHaveLength(2);
    expect(parsed?.folders).toHaveLength(1);
    expect(parsed?.noteCount).toBe(2);
    expect(parsed?.appVersion).toBeTruthy();
  });

  it('keeps the optional cloud CSV entry set unchanged while disclosing supported-data scope', async () => {
    const cloud: VaultBackupCloudBlock = {
      schemaVersion: 1,
      fetchedAt: '2026-09-02T00:00:00.000Z',
      completeness: 'full',
      errors: [],
      planner: {
        schedules: [], todos: [], routines: [], routineLogs: [], weeklySchedules: [],
        recipes: [], ddays: [], routineExceptions: [],
      },
      health: {
        exerciseBlocks: [], workoutLogs: [], inbodyLogs: [], healthRoutines: [],
        proteinSources: [], proteinProfile: null,
      },
    };
    const manifest = buildVaultBackupManifestV3([note('n1', 'Alpha')], [], cloud);
    const zip = await JSZip.loadAsync(await (await buildVaultBackupZip(manifest)).arrayBuffer());

    expect(Object.keys(zip.files).sort()).toEqual([
      'README.txt',
      'cloud/',
      'cloud/README.txt',
      'cloud/exercise-blocks.csv',
      'cloud/health-routines.csv',
      'cloud/inbody.csv',
      'cloud/planner-recipes.csv',
      'cloud/planner-routines.csv',
      'cloud/planner-schedules.csv',
      'cloud/planner-todos.csv',
      'cloud/planner-weekly.csv',
      'cloud/protein-sources.csv',
      'cloud/workouts.csv',
      'manifest.json',
      'notes/',
      'notes/Alpha-n1.md',
    ]);
    expect(await zip.file('README.txt')!.async('string'))
      .toContain('Original attachment binary bytes are not included in ZIP or JSON vault exports.');
  });

  it('returns null for invalid zip', async () => {
    const blob = new Blob(['not a zip'], { type: 'application/zip' });
    expect(await parseVaultBackupZip(blob)).toBeNull();
  });
});
