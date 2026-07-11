import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import JSZip from 'jszip';
import { describe, expect, it, vi } from 'vitest';
import type { VaultBackupManifest } from './exportVaultBackup';
import {
  RecoveryCanonicalizationError,
  buildRecoveryExportPackage,
  createRecoveryExportArchive,
  stableRecoveryJson,
  verifyRecoveryExportPackage,
  type RecoveryExportPackage,
  type RecoveryRecord,
} from './recoveryExportPackage';
import {
  adaptSuppliedJsonArray,
  adaptVaultBackupManifest,
  applyAdapterResult,
  buildAttachmentReferenceDataset,
  readAttachmentInventoryForRecovery,
  readJsonArrayFromStorage,
  readJsonValueFromStorage,
  readStoragePrefixForRecovery,
  sanitizeRecoveryProvenance,
} from './recoveryExportSourceAdapters';

const exportedAt = '2026-07-11T00:00:00.000Z';
const source = { kind: 'supplied_export' as const, label: 'synthetic.json', ownerScope: 'confirmed' as const };

function hash(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

function withRehashedFiles(pkg: RecoveryExportPackage, changes: Record<string, string>): RecoveryExportPackage {
  const files = { ...pkg.files, ...changes };
  const sums: Record<string, string> = {};
  for (const [path, content] of Object.entries(files)) if (path !== 'checksums.sha256') sums[path] = hash(content);
  files['checksums.sha256'] = `${Object.entries(sums).sort(([a], [b]) => a.localeCompare(b))
    .map(([path, sum]) => `${sum}  ${path}`).join('\n')}\n`;
  return { manifest: JSON.parse(files['manifest.json']), files, checksums: sums };
}

function note(id: string, extra: RecoveryRecord = {}): RecoveryRecord {
  return { id, user_id: 'owner-a', deleted_at: null, ...extra };
}

describe('K-320A deterministic package and availability', () => {
  it('is deterministic across record, key, and source enumeration order including ZIP bytes', async () => {
    const first = await buildRecoveryExportPackage({
      exportedAt,
      datasets: { notes: { availability: 'present_records', source, records: [note('b', { z: 1, a: 2 }), note('a')] } },
    });
    const second = await buildRecoveryExportPackage({
      datasets: { notes: { records: [{ a: 2, z: 1, deleted_at: null, user_id: 'owner-a', id: 'b' }, note('a')].reverse(), source: { ownerScope: 'confirmed', label: 'synthetic.json', kind: 'supplied_export' }, availability: 'present_records' } },
      exportedAt,
    });
    expect(first.files).toEqual(second.files);
    const verified = await verifyRecoveryExportPackage(first);
    expect(verified.errors).toEqual([]);
    expect(verified.conflictDiagnostics).toEqual([]);
    expect(await createRecoveryExportArchive(first)).toEqual(await createRecoveryExportArchive(second));
    const zip = await JSZip.loadAsync(await createRecoveryExportArchive(first));
    expect(zip.file('absinthe-recovery-export/manifest.json')).not.toBeNull();
  });

  it.each([
    'source_not_provided', 'unavailable', 'unsupported', 'permission_denied',
    'parse_failed', 'absent_confirmed',
  ] as const)('preserves non-data availability %s without authoritative arrays', async availability => {
    const pkg = await buildRecoveryExportPackage({ exportedAt, datasets: { recipes: { availability } } });
    const payload = JSON.parse(pkg.files['recipes/recipes.json']);
    expect(payload.availability).toBe(availability);
    expect(payload.activeRecords).toBeNull();
    expect(payload.tombstoneRecords).toBeNull();
  });

  it('distinguishes source-not-provided, unavailable, present-empty, and present-records', async () => {
    const packages = await Promise.all([
      buildRecoveryExportPackage({ exportedAt }),
      buildRecoveryExportPackage({ exportedAt, datasets: { recipes: { availability: 'unavailable' } } }),
      buildRecoveryExportPackage({ exportedAt, datasets: { recipes: { availability: 'present_empty', records: [] } } }),
      buildRecoveryExportPackage({ exportedAt, datasets: { recipes: { availability: 'present_records', records: [{ id: 'r1' }] } } }),
    ]);
    expect(new Set(packages.map(pkg => pkg.files['recipes/recipes.json'])).size).toBe(4);
  });

  it('derives complete, complete-for-supplied, partial, and invalid independently', async () => {
    const complete = await buildRecoveryExportPackage({ exportedAt, requiredDatasets: ['notes'], datasets: { notes: { availability: 'present_records', records: [note('n1')] } } });
    const supplied = await buildRecoveryExportPackage({ exportedAt, datasets: { notes: { availability: 'present_records', records: [note('n1')] } } });
    const partial = await buildRecoveryExportPackage({ exportedAt, datasets: { notes: { availability: 'permission_denied' } } });
    const invalid = await buildRecoveryExportPackage({ exportedAt, datasets: { notes: { availability: 'present_records', records: [note('n1'), note('n1')] } } });
    expect([complete.manifest.completeness, supplied.manifest.completeness, partial.manifest.completeness, invalid.manifest.completeness])
      .toEqual(['complete', 'complete_for_supplied_sources', 'partial', 'invalid']);
  });
});

describe('K-320A VaultBackupManifest adapter', () => {
  it('preserves recognized sections, tombstones, relationships and attachment references without mutation', async () => {
    const fixture = {
      schemaVersion: 3, kind: 'absinthe-vault-export', exportedAt, app: 'absinthe', appVersion: 'test',
      noteCount: 2, folderCount: 1, relationCount: 1,
      folders: [{ id: 'f1', name: 'Folder', createdAt: 1 }],
      notes: [
        { id: 'n1', title: 'Synthetic', folderId: 'f1', starred: false, updatedAt: 1, markdown: '![x](attachment://att-1)', properties: {}, relations: { links: ['n2'] }, deletedAt: null },
        { id: 'n2', title: 'Deleted', folderId: null, starred: false, updatedAt: 2, markdown: '', properties: {}, relations: {}, deletedAt: exportedAt },
      ],
      extensions: { schemaVersion: 1, settings: { mode: 'local' }, knowledge: {}, health: { drafts: { day: 'draft' }, memos: { day: 'memo' } } },
      scope: { included: ['notes'], excluded: [], cloudGaps: [], manifestDoc: 'synthetic' },
      cloud: { schemaVersion: 1, fetchedAt: exportedAt, completeness: 'partial', errors: ['synthetic_error'], planner: {}, health: {} },
      futureSection: { privateValue: 'must-not-enter-warning' },
    };
    const before = JSON.stringify(fixture);
    const text = JSON.stringify(fixture, null, 2);
    const result = adaptVaultBackupManifest(fixture as unknown as VaultBackupManifest, { kind: 'backup', label: 'backup.json' });
    const pkg = await buildRecoveryExportPackage(applyAdapterResult({ exportedAt }, result));

    expect(JSON.stringify(fixture)).toBe(before);
    expect(JSON.stringify(fixture, null, 2)).toBe(text);
    expect(JSON.parse(pkg.files['notes/active.json']).recordCount).toBe(1);
    expect(JSON.parse(pkg.files['notes/tombstones.json']).recordCount).toBe(1);
    expect(JSON.parse(pkg.files['notes/folders.json']).counts.total).toBe(1);
    expect(JSON.parse(pkg.files['notes/relationships.json']).counts.total).toBe(2);
    expect(JSON.parse(pkg.files['attachments/references.json']).activeRecords[0].id).toBe('att-1');
    expect(result.syncState.backupScope).toEqual(fixture.scope);
    expect(result.syncState.backupCloudMetadata).toMatchObject({ completeness: 'partial', errorCount: 1 });
    expect(result.warningCodes).toContain('unsupported_top_level_section:futuresection');
    expect(JSON.stringify(result.warningCodes)).not.toContain('privateValue');
    expect(JSON.parse(pkg.files['recipes/recipes.json']).availability).toBe('source_not_provided');
  });

  it('reports known absent sections without fabricating non-Notes data', () => {
    const minimal = { schemaVersion: 3, exportedAt, app: 'absinthe', appVersion: 'test', noteCount: 0, folderCount: 0, relationCount: 0, folders: [], notes: [] };
    const result = adaptVaultBackupManifest(JSON.stringify(minimal), { kind: 'backup', label: 'minimal.json' });
    expect(result.warningCodes).toEqual(expect.arrayContaining(['known_section_absent:extensions', 'known_section_absent:scope', 'known_section_absent:cloud']));
    expect(result.datasets.recipes).toBeUndefined();
  });
});

describe('K-320A canonicalization and privacy', () => {
  it.each([
    [Number.NaN, 'unsupported_non_finite_number'], [Infinity, 'unsupported_non_finite_number'],
    [-Infinity, 'unsupported_non_finite_number'], [undefined, 'unsupported_undefined'], [1n, 'unsupported_bigint'],
  ])('rejects unsupported value %s with a path-aware diagnostic', async (value, code) => {
    await expect(buildRecoveryExportPackage({ exportedAt, datasets: { recipes: { availability: 'present_records', records: [{ id: 'r1', value }] } } }))
      .rejects.toMatchObject<Partial<RecoveryCanonicalizationError>>({ code, fieldPath: expect.stringContaining('value') });
  });

  it('preserves enumerable prototype-shaped keys without prototype pollution', () => {
    const record = Object.create(null) as Record<string, unknown>;
    record.id = 'safe';
    Object.defineProperty(record, '__proto__', { value: { safe: true }, enumerable: true });
    record.constructor = 'constructor-value';
    const parsed = JSON.parse(stableRecoveryJson(record));
    expect(Object.prototype.hasOwnProperty.call(parsed, '__proto__')).toBe(true);
    expect(parsed.constructor).toBe('constructor-value');
    expect(({} as Record<string, unknown>).safe).toBeUndefined();
  });

  it('sanitizes sensitive provenance and never echoes secret-shaped adapter errors', () => {
    const sensitive = 'https://user:pass@example.test/path/backup.json?access_token=synthetic-secret#fragment';
    const sanitized = sanitizeRecoveryProvenance({ kind: 'backup', label: sensitive, sourceId: 'Bearer synthetic-token' });
    const failed = adaptSuppliedJsonArray('{bad', { kind: 'backup', label: sensitive });
    const output = JSON.stringify({ sanitized, failed });
    expect(output).not.toContain('synthetic-secret');
    expect(output).not.toContain('synthetic-token');
    expect(output).not.toContain('user:pass');
    expect(output).not.toContain('{bad');
  });

  it('sanitizes provenance, warning codes, and informational metadata at the builder boundary', async () => {
    const pkg = await buildRecoveryExportPackage({
      exportedAt,
      warningCodes: ['Bearer synthetic-warning-token'],
      syncState: { access_token: 'synthetic-access', nested: 'Bearer synthetic-session' },
      datasets: { recipes: { availability: 'unavailable', source: { kind: 'remote', label: 'C:\\profile\\backup.json?access_token=synthetic' } } },
    });
    const output = JSON.stringify(pkg.files);
    expect(output).not.toContain('synthetic-warning-token');
    expect(output).not.toContain('synthetic-access');
    expect(output).not.toContain('synthetic-session');
    expect(output).not.toContain('C:\\profile');
  });
});

describe('K-320A semantic verification and conflicts', () => {
  it('detects a rehashed manifest count change', async () => {
    const pkg = await buildRecoveryExportPackage({ exportedAt, datasets: { notes: { availability: 'present_records', records: [note('n1')] } } });
    const manifest = JSON.parse(pkg.files['manifest.json']);
    manifest.datasets[0].totalCount = 999;
    const result = await verifyRecoveryExportPackage(withRehashedFiles(pkg, { 'manifest.json': stableRecoveryJson(manifest) }));
    expect(result.valid).toBe(false);
    expect(result.errors.map(error => error.code)).toContain('manifest_dataset_mismatch');
  });

  it('detects rehashed record removal, inconsistent availability, completeness, missing and unexpected files', async () => {
    const pkg = await buildRecoveryExportPackage({ exportedAt, datasets: { recipes: { availability: 'present_records', records: [{ id: 'r1' }] } } });
    const recipe = JSON.parse(pkg.files['recipes/recipes.json']);
    recipe.activeRecords = [];
    const altered = withRehashedFiles(pkg, { 'recipes/recipes.json': stableRecoveryJson(recipe), 'unexpected.json': '{}\n' });
    delete (altered.files as Record<string, string>)['planning/todos.json'];
    const result = await verifyRecoveryExportPackage(altered);
    expect(result.errors.map(error => error.code)).toEqual(expect.arrayContaining([
      'present_records_is_empty', 'manifest_dataset_mismatch', 'unexpected_file', 'missing_file',
    ]));
  });

  it('detects duplicate checksum entries and unsafe normalized paths', async () => {
    const pkg = await buildRecoveryExportPackage({ exportedAt });
    const line = pkg.files['checksums.sha256'].split('\n')[0];
    const files = { ...pkg.files, 'checksums.sha256': `${pkg.files['checksums.sha256']}${line}\n`, '../escape': 'x' };
    const result = await verifyRecoveryExportPackage({ files });
    expect(result.errors.map(error => error.code)).toEqual(expect.arrayContaining(['duplicate_checksum_entry', 'unsafe_path']));
  });

  it('reports duplicates, missing IDs, owner conflicts, collisions, folder and attachment orphans stably', async () => {
    const input = {
      exportedAt,
      datasets: {
        notes: { availability: 'present_records' as const, records: [
          note('same', { folder_id: 'missing' }), note('same', { deleted_at: exportedAt, user_id: 'owner-b' }), { user_id: 'owner-a', deleted_at: null },
        ] },
        noteFolders: { availability: 'present_records' as const, records: [{ id: 'unused' }] },
        attachmentReferences: { availability: 'present_records' as const, records: [{ id: 'att-missing', referencedBy: ['same'], orphanCandidate: true }] },
      },
    };
    const first = await buildRecoveryExportPackage(input);
    const second = await buildRecoveryExportPackage({ ...input, datasets: { ...input.datasets, notes: { ...input.datasets.notes, records: [...input.datasets.notes.records].reverse() } } });
    const codes = JSON.parse(first.files['metadata/conflicts.json']).diagnostics.map((item: { code: string }) => item.code);
    expect(codes).toEqual(expect.arrayContaining([
      'duplicate_id', 'active_tombstone_collision', 'conflicting_owner_ids', 'missing_or_invalid_id',
      'missing_folder_target', 'orphan_folder', 'missing_attachment_target',
    ]));
    expect(first.files['metadata/conflicts.json']).toBe(second.files['metadata/conflicts.json']);
    expect(first.manifest.completeness).toBe('invalid');
  });
});

describe('K-320A read-only adapters and attachment semantics', () => {
  it('uses only storage reads and distinguishes permission failure', () => {
    const setItem = vi.fn();
    const removeItem = vi.fn();
    const storage = { getItem: vi.fn(() => '[{"id":"a"}]'), setItem, removeItem };
    expect(readJsonArrayFromStorage(storage, 'key', { kind: 'local', label: 'localStorage' }).availability).toBe('present_records');
    expect(readJsonValueFromStorage(storage, 'key', { kind: 'local', label: 'localStorage' }).availability).toBe('present_records');
    expect(setItem).not.toHaveBeenCalled();
    expect(removeItem).not.toHaveBeenCalled();
    expect(readJsonArrayFromStorage({ getItem: () => { throw new Error('denied'); } }, 'key', source).availability).toBe('permission_denied');
  });

  it('reads prefixes without mutation', () => {
    const values = new Map([['draft:a', 'text'], ['other', 'ignored']]);
    const keys = [...values.keys()];
    const storage = { get length() { return keys.length; }, key: (i: number) => keys[i] ?? null, getItem: (key: string) => values.get(key) ?? null };
    const result = readStoragePrefixForRecovery(storage, 'draft:', { kind: 'local', label: 'drafts' });
    expect(result.records).toEqual([{ id: 'a', key: 'draft:a', value: 'text' }]);
    expect(values.size).toBe(2);
  });

  it('deduplicates references and referencedBy while preserving unknown states', () => {
    const result = buildAttachmentReferenceDataset([
      { id: 'att', referencedBy: ['n2', 'n1'] }, { id: 'att', referencedBy: ['n1'] },
    ], { kind: 'backup', label: 'backup.json' });
    expect(result.records).toEqual([expect.objectContaining({
      id: 'att', referencedBy: ['n1', 'n2'], referenceOnly: true,
      localAvailability: 'unknown', remoteAvailability: 'unknown', blobAvailability: 'unknown', checksumStatus: 'unknown', orphanCandidate: false,
    })]);
    expect(buildAttachmentReferenceDataset(null, source).availability).toBe('source_not_provided');
  });

  it('derives local/remote/checksum metadata without reading blobs', async () => {
    const listAttachments = vi.fn(async () => [{
      id: 'att', fileName: 'safe.png', mimeType: 'image/png', size: 1,
      createdAt: exportedAt, updatedAt: exportedAt, localBlobKey: 'blobs/att', remoteFileId: 'remote-1',
      remoteVerification: { sizeVerified: true, checksumVerified: false },
    }]);
    const result = await readAttachmentInventoryForRecovery({ listAttachments }, { kind: 'local', label: 'attachment-metadata' });
    expect(result.records?.[0]).toMatchObject({
      localAvailability: 'present', remoteAvailability: 'present', blobAvailability: 'present', checksumStatus: 'mismatch',
    });
    expect(listAttachments).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['local', { localBlobKey: 'blobs/a' }, 'present', 'unknown'],
    ['remote', { remoteFileId: 'remote-a' }, 'unknown', 'present'],
    ['both', { localBlobKey: 'blobs/a', remoteFileId: 'remote-a' }, 'present', 'present'],
    ['neither', {}, 'unknown', 'unknown'],
  ])('keeps attachment availability states distinct: %s', async (_label, fields, local, remote) => {
    const result = await readAttachmentInventoryForRecovery({
      listAttachments: async () => [{ id: 'att', fileName: 'a', mimeType: 'text/plain', size: 1, createdAt: exportedAt, updatedAt: exportedAt, ...fields }],
    }, { kind: 'local', label: 'metadata' });
    expect(result.records?.[0]).toMatchObject({ localAvailability: local, remoteAvailability: remote });
  });
});

describe('K-320A developer CLI', () => {
  it('exports and independently verifies a synthetic backup without changing the input', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'absinthe-k320a-'));
    try {
      const input = path.join(root, 'synthetic-backup.json');
      const output = path.join(root, 'output');
      const sourceText = `${JSON.stringify({
        schemaVersion: 3, exportedAt, app: 'absinthe', appVersion: 'test',
        noteCount: 0, folderCount: 0, relationCount: 0, folders: [], notes: [],
      }, null, 2)}\n`;
      await writeFile(input, sourceText, 'utf8');
      const cli = path.resolve('scripts/recovery-package-cli.mjs');
      const exported = spawnSync(process.execPath, [cli, 'export', '--input', input, '--output', output], { cwd: process.cwd(), encoding: 'utf8' });
      expect(exported.status, exported.stderr).toBe(0);
      expect(await readFile(input, 'utf8')).toBe(sourceText);
      const verifiedDirectory = spawnSync(process.execPath, [cli, 'verify', '--package', output], { cwd: process.cwd(), encoding: 'utf8' });
      const verifiedZip = spawnSync(process.execPath, [cli, 'verify', '--package', path.join(output, 'absinthe-recovery-export.zip')], { cwd: process.cwd(), encoding: 'utf8' });
      expect(verifiedDirectory.status, verifiedDirectory.stderr).toBe(0);
      expect(verifiedZip.status, verifiedZip.stderr).toBe(0);
      expect(JSON.parse(verifiedDirectory.stdout).valid).toBe(true);
      expect(JSON.parse(verifiedZip.stdout).valid).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 30_000);
});
