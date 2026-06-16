import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./supabase', () => ({
  authFetch: vi.fn(async () => ({
    ok: false,
    status: 401,
    json: async () => ({}),
  })),
}));

import type { NoteBase } from '@/components/views/noteUtils';
import {
  buildVaultBackupManifest,
  buildVaultBackupManifestV3,
  normalizeVaultBackupManifest,
  upgradeVaultBackupToV3,
  VAULT_BACKUP_SCHEMA_VERSION,
  VAULT_EXPORT_KIND,
} from './exportVaultBackup';
import { VAULT_BACKUP_SCHEMA_VERSION_V2 } from './vaultBackupConstants';
import { parseVaultBackupJson, validateVaultBackupManifest } from './importVaultBackup';
import { assertExportReady } from './vaultExportValidate';
import { extensionsEquivalent, simulateVaultRestore } from './vaultExtensionRestoreSim';
import { collectPortableVaultExtensions } from './vaultPortableExtensions';
import { fetchVaultCloudBlock } from './vaultCloudExport';
import { buildVaultBackupZip } from './vaultBackupZip';
import JSZip from 'jszip';

function note(id: string, title = 'Note'): NoteBase {
  return {
    id,
    title,
    body: `# ${title}\n\nContent`,
    folderId: null,
    starred: true,
    deletedAt: null,
    createdAt: 1,
    updatedAt: 2,
    properties: { tags: '["math"]' },
    relations: {},
  };
}

function v2ManifestJson(): string {
  return JSON.stringify({
    schemaVersion: VAULT_BACKUP_SCHEMA_VERSION_V2,
    exportedAt: '2026-01-01T00:00:00.000Z',
    app: 'absinthe',
    appVersion: '1.0.0',
    noteCount: 1,
    folderCount: 0,
    relationCount: 0,
    folders: [],
    notes: [{
      id: 'n1',
      title: 'Legacy',
      folderId: null,
      starred: false,
      updatedAt: 1,
      markdown: '# Legacy\n\nBody',
      properties: {},
      relations: {},
    }],
  });
}

describe('vault export v3', () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value); },
      removeItem: (key: string) => { store.delete(key); },
      get length() { return store.size; },
      key: (index: number) => [...store.keys()][index] ?? null,
    });
    store.set('planner-storage', JSON.stringify({ darkMode: true, language: 'en' }));
    store.set('note-saved-views-v1', JSON.stringify([{ id: 'sv1', name: 'All', query: 'tag:japanese' }]));
    store.set('healthDraft:2026-06-01', JSON.stringify({ exercises: [] }));
    store.set('healthMemo:2026-06-01', 'felt good');
  });

  it('builds v3 manifest with extensions and fingerprint', () => {
    const manifest = buildVaultBackupManifest([note('n1')], []);
    expect(manifest.schemaVersion).toBe(VAULT_BACKUP_SCHEMA_VERSION);
    expect(manifest.kind).toBe(VAULT_EXPORT_KIND);
    expect(manifest.extensions?.settings).toEqual({ darkMode: true, language: 'en' });
    expect(manifest.extensions?.knowledge.savedViews).toHaveLength(1);
    expect(manifest.extensions?.health.drafts['2026-06-01']).toBeDefined();
    expect(manifest.scope?.included).toContain('app-settings');
    expect(manifest.contentFingerprint).toBeTruthy();
  });

  it('parses v2 export and normalizes core fields', () => {
    const parsed = parseVaultBackupJson(v2ManifestJson());
    expect(parsed?.schemaVersion).toBe(VAULT_BACKUP_SCHEMA_VERSION_V2);
    expect(parsed?.notes[0]?.title).toBe('Legacy');
    expect(parsed?.extensions).toBeUndefined();
    const validation = validateVaultBackupManifest(parsed!, [], []);
    expect(validation.valid).toBe(true);
  });

  it('upgrades v2 to v3 with extensions', () => {
    const v2 = normalizeVaultBackupManifest(JSON.parse(v2ManifestJson()))!;
    const v3 = upgradeVaultBackupToV3(v2);
    expect(v3.schemaVersion).toBe(3);
    expect(v3.extensions?.settings).toBeTruthy();
  });

  it('validates export manifest before download', () => {
    const manifest = buildVaultBackupManifestV3([note('n1')], [], null);
    const report = assertExportReady(manifest);
    expect(report.valid).toBe(true);
    expect(report.hasExtensions).toBe(true);
    expect(report.fingerprintMatch).toBe(true);
  });

  it('includes cloud block when provided', () => {
    const cloud = {
      schemaVersion: 1 as const,
      fetchedAt: '2026-06-01T00:00:00Z',
      completeness: 'full' as const,
      errors: [],
      planner: { schedules: [{ id: 's1' }], todos: [], routines: [], routineLogs: [], weeklySchedules: [], recipes: [], ddays: [], routineExceptions: [] },
      health: { exerciseBlocks: [], workoutLogs: [], inbodyLogs: [], healthRoutines: [], proteinSources: [], proteinProfile: null },
    };
    const manifest = buildVaultBackupManifestV3([note('n1')], [], cloud);
    expect(manifest.cloud?.completeness).toBe('full');
    expect(manifest.scope?.cloudGaps).toContain('cloud:protein-intake-daily-logs-not-exported');
  });

  it('simulates round-trip core restore', () => {
    const manifest = buildVaultBackupManifest([note('n1', 'Alpha')], [{ id: 'f1', name: 'Work', createdAt: 1 }]);
    const sim = simulateVaultRestore(manifest, [], []);
    expect(sim.coreNoteCount).toBe(1);
    expect(sim.notes.find(n => n.id === 'n1')?.title).toBe('Alpha');
    expect(sim.folders).toHaveLength(1);
    expect(sim.extensionSections).toContain('settings');
    expect(sim.extensionSections).toContain('healthDrafts');
  });

  it('round-trips extensions JSON fidelity', () => {
    const collected = collectPortableVaultExtensions();
    const manifest = buildVaultBackupManifestV3([note('n1')], [], null, collected);
    expect(extensionsEquivalent(manifest.extensions!, collected)).toBe(true);
  });

  it('fetchVaultCloudBlock returns skipped on auth failure', async () => {
    const block = await fetchVaultCloudBlock();
    expect(block.completeness).toBe('skipped');
  });

  it('ZIP contains cloud sidecars when cloud present', async () => {
    const cloud = {
      schemaVersion: 1 as const,
      fetchedAt: '2026-06-01T00:00:00Z',
      completeness: 'full' as const,
      errors: [],
      planner: { schedules: [{ id: 's1', text: 'Study' }], todos: [], routines: [], routineLogs: [], weeklySchedules: [], recipes: [], ddays: [], routineExceptions: [] },
      health: { exerciseBlocks: [], workoutLogs: [{ id: 'w1' }], inbodyLogs: [], healthRoutines: [], proteinSources: [], proteinProfile: null },
    };
    const manifest = buildVaultBackupManifestV3([note('n1')], [], cloud);
    const blob = await buildVaultBackupZip(manifest);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    expect(zip.file('manifest.json')).toBeTruthy();
    expect(zip.file('cloud/workouts.csv')).toBeTruthy();
    expect(zip.file('cloud/planner-schedules.csv')).toBeTruthy();
  });
});
