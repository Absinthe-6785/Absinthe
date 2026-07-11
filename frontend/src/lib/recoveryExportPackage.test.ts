import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { validateZipBytes, validateZipEntryNames } from '../../scripts/recovery-zip-safety.mjs';
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
  adaptInbodyJsonArray,
  adaptVaultBackupManifest,
  applyAdapterResult,
  buildAttachmentReferenceDataset,
  readAttachmentInventoryForRecovery,
  readJsonArrayFromStorage,
  readInbodyJsonArrayFromStorage,
  readJsonValueFromStorage,
  readStoragePrefixForRecovery,
  sanitizeRecoveryProvenance,
  combineRecoveryDatasetSources,
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
  return { id, user_id: 'owner-a', body: '', deleted_at: null, ...extra };
}

describe('K-320A deterministic package and availability', () => {
  it('is deterministic across record, key, and source enumeration order including ZIP bytes', async () => {
    const first = await buildRecoveryExportPackage({
      exportedAt,
      datasets: { notes: { availability: 'present_records', source, records: [note('b', { z: 1, a: 2 }), note('a')] } },
    });
    const second = await buildRecoveryExportPackage({
      datasets: { notes: { records: [{ a: 2, z: 1, body: '', deleted_at: null, user_id: 'owner-a', id: 'b' }, note('a')].reverse(), source: { ownerScope: 'confirmed', label: 'synthetic.json', kind: 'supplied_export' }, availability: 'present_records' } },
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
    const pkg = await buildRecoveryExportPackage({ exportedAt, datasets: { recipes: { availability: 'present_records', records: [{ id: 'r1', name: 'Synthetic' }] } } });
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
        noteFolders: { availability: 'present_records' as const, records: [{ id: 'unused', name: 'Empty' }] },
        attachmentReferences: { availability: 'present_records' as const, records: [{ id: 'att-missing', referencedBy: ['same'], orphanCandidate: true }] },
      },
    };
    const first = await buildRecoveryExportPackage(input);
    const second = await buildRecoveryExportPackage({ ...input, datasets: { ...input.datasets, notes: { ...input.datasets.notes, records: [...input.datasets.notes.records].reverse() } } });
    const codes = JSON.parse(first.files['metadata/conflicts.json']).diagnostics.map((item: { code: string }) => item.code);
    expect(codes).toEqual(expect.arrayContaining([
      'duplicate_id_within_source', 'active_tombstone_collision', 'conflicting_owner_ids', 'missing_or_invalid_id',
      'missing_folder_target', 'missing_attachment_target',
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
      localAvailability: 'local_source_not_provided', remoteAvailability: 'remote_source_not_provided', blobAvailability: 'blob_unknown', checksumStatus: 'checksum_unknown', orphanCandidate: false,
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
      localAvailability: 'local_present', remoteAvailability: 'remote_present', blobAvailability: 'blob_present', checksumStatus: 'checksum_mismatch',
    });
    expect(listAttachments).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['local', { localBlobKey: 'blobs/a' }, 'local_present', 'remote_unknown'],
    ['remote', { remoteFileId: 'remote-a' }, 'local_unknown', 'remote_present'],
    ['both', { localBlobKey: 'blobs/a', remoteFileId: 'remote-a' }, 'local_present', 'remote_present'],
    ['neither', {}, 'local_unknown', 'remote_unknown'],
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

describe('K-320B semantic closure', () => {
  it('keeps valid empty folders valid while detecting real folder integrity conflicts', async () => {
    const valid = await buildRecoveryExportPackage({
      exportedAt,
      datasets: {
        notes: { availability: 'present_empty', records: [] },
        noteFolders: { availability: 'present_records', records: [{ id: 'empty', name: 'Empty folder' }] },
      },
    });
    const verified = await verifyRecoveryExportPackage(valid);
    expect(verified.valid).toBe(true);
    expect(valid.manifest.completeness).not.toBe('invalid');
    expect(verified.conflictDiagnostics.map(item => item.code)).not.toContain('orphan_folder');

    const broken = await buildRecoveryExportPackage({
      exportedAt,
      datasets: {
        notes: { availability: 'present_records', records: [note('n1', { folderId: 'missing' })] },
        noteFolders: { availability: 'present_records', records: [
          { id: 'f1', name: 'One', parentId: 'missing-parent' },
          { id: 'f1', name: 'Duplicate' },
        ] },
      },
    });
    expect(JSON.parse(broken.files['metadata/conflicts.json']).diagnostics.map((item: { code: string }) => item.code))
      .toEqual(expect.arrayContaining(['missing_folder_target', 'missing_folder_parent', 'duplicate_id_within_source']));
  });

  it('validates attachment referencedBy targets and warns when Notes are unavailable', async () => {
    const valid = await buildRecoveryExportPackage({
      exportedAt,
      datasets: {
        notes: { availability: 'present_records', records: [note('n1')] },
        attachmentReferences: { availability: 'present_records', records: [{ id: 'a1', referencedBy: ['n1'] }] },
      },
    });
    expect((await verifyRecoveryExportPackage(valid)).valid).toBe(true);

    const missing = await buildRecoveryExportPackage({
      exportedAt,
      datasets: {
        notes: { availability: 'present_records', records: [note('n1')] },
        attachmentReferences: { availability: 'present_records', records: [{ id: 'a1', referencedBy: ['n1', 'missing'] }] },
      },
    });
    expect(JSON.parse(missing.files['metadata/conflicts.json']).diagnostics.map((item: { code: string }) => item.code))
      .toContain('attachment_reference_missing_active_note');

    const unresolved = await buildRecoveryExportPackage({
      exportedAt,
      datasets: {
        notes: { availability: 'unavailable' },
        attachmentReferences: { availability: 'present_records', records: [{ id: 'a1', referencedBy: ['unknown-note'] }] },
      },
    });
    const unresolvedResult = await verifyRecoveryExportPackage(unresolved);
    expect(unresolvedResult.conflictDiagnostics.map(item => item.code)).not.toContain('attachment_reference_missing_active_note');
    expect(unresolvedResult.warnings.map(item => item.code)).toContain('attachment_reference_unresolved_due_to_unavailable_notes');
  });

  it('reports conservative source-confirmed malformed records without private payloads', async () => {
    const pkg = await buildRecoveryExportPackage({
      exportedAt,
      datasets: {
        notes: { availability: 'present_records', records: [{ body: 'private-note-body', deleted_at: null }] },
        noteFolders: { availability: 'present_records', records: [{ name: 'private-folder-name' }] },
        recipes: { availability: 'present_records', records: [{ id: 'r1', arbitrary: 'private-recipe' }] },
        schedules: { availability: 'present_records', records: [{ id: 's1', start_time: '09:00', end_time: '10:00', created_at: 'not-a-date' }] },
        todos: { availability: 'present_records', records: [{ id: 't1', done: 'yes', deleted_at: true }] },
        workoutLogs: { availability: 'present_records', records: [{ id: 'w1', privateHealth: 123 }] },
        attachmentInventory: { availability: 'present_records', records: [{ privateAttachment: 'secret' }] },
      },
    });
    const diagnostics = pkg.files['metadata/conflicts.json'];
    const codes = JSON.parse(diagnostics).diagnostics.map((item: { code: string }) => item.code);
    expect(codes).toEqual(expect.arrayContaining(['missing_or_invalid_id', 'malformed_record', 'invalid_timestamp']));
    expect(diagnostics).not.toContain('private-note-body');
    expect(diagnostics).not.toContain('private-folder-name');
    expect(diagnostics).not.toContain('private-recipe');
    expect(diagnostics).not.toContain('privateHealth');
  });

  it('distinguishes within-source duplicates and cross-source duplicates/content conflicts stably', async () => {
    const sourceA = { kind: 'backup' as const, label: 'C:\\private\\a.json?access_token=secret', sourceId: 'a' };
    const sourceB = { kind: 'snapshot' as const, label: 'b.json', sourceId: 'b' };
    const combined = combineRecoveryDatasetSources([
      { availability: 'present_records', records: [{ id: 'r1', name: 'Same' }, { id: 'r2', name: 'A', user_id: 'owner-a' }], source: sourceA },
      { availability: 'present_records', records: [{ id: 'r1', name: 'Same' }, { id: 'r2', name: 'B', user_id: 'owner-b' }], source: sourceB },
    ], { kind: 'supplied_export', label: 'combined' });
    const pkg = await buildRecoveryExportPackage({ exportedAt, datasets: { recipes: combined } });
    const reversedCombined = combineRecoveryDatasetSources([
      { availability: 'present_records', records: [{ id: 'r2', name: 'B', user_id: 'owner-b' }, { id: 'r1', name: 'Same' }], source: sourceB },
      { availability: 'present_records', records: [{ id: 'r2', name: 'A', user_id: 'owner-a' }, { id: 'r1', name: 'Same' }], source: sourceA },
    ], { kind: 'supplied_export', label: 'combined' });
    const reversed = await buildRecoveryExportPackage({ exportedAt, datasets: { recipes: reversedCombined } });
    const conflicts = JSON.parse(pkg.files['metadata/conflicts.json']).diagnostics;
    expect(conflicts.map((item: { code: string }) => item.code)).toEqual(expect.arrayContaining([
      'cross_source_duplicate_id', 'cross_source_record_conflict', 'conflicting_owner_ids',
    ]));
    expect(pkg.files['recipes/recipes.json']).not.toContain('access_token');
    expect(pkg.files['recipes/recipes.json']).not.toContain('C:\\private');
    expect(reversed.files['metadata/conflicts.json']).toBe(pkg.files['metadata/conflicts.json']);

    const within = await buildRecoveryExportPackage({
      exportedAt,
      datasets: { recipes: { availability: 'present_records', records: [{ id: 'same', name: 'A' }, { id: 'same', name: 'B' }], source: sourceB } },
    });
    expect(JSON.parse(within.files['metadata/conflicts.json']).diagnostics.map((item: { code: string }) => item.code))
      .toContain('duplicate_id_within_source');
  });

  it('preserves confirmed attachment absence and rejects contradictory supplied states without blob reads', async () => {
    const listAttachments = vi.fn(async () => [{
      id: 'a1', fileName: 'a', mimeType: 'text/plain', size: 1, createdAt: exportedAt, updatedAt: exportedAt,
      localMissingConfirmed: true, remoteMissingConfirmed: true, blobMissingConfirmed: true,
    } as never]);
    const missing = await readAttachmentInventoryForRecovery({ listAttachments }, { kind: 'local', label: 'metadata' });
    expect(missing.records?.[0]).toMatchObject({
      localAvailability: 'local_missing_confirmed', remoteAvailability: 'remote_missing_confirmed',
      blobAvailability: 'blob_missing_confirmed', checksumStatus: 'checksum_unknown',
    });
    expect(listAttachments).toHaveBeenCalledTimes(1);

    const contradictory = await buildRecoveryExportPackage({
      exportedAt,
      datasets: { attachmentInventory: { availability: 'present_records', records: [{
        id: 'a1', fileName: 'a', mimeType: 'text/plain', localBlobKey: 'blob/a',
        localAvailability: 'local_missing_confirmed', remoteAvailability: 'remote_unknown',
        blobAvailability: 'blob_unknown', checksumStatus: 'checksum_mismatch',
      }] } },
    });
    expect(JSON.parse(contradictory.files['metadata/conflicts.json']).diagnostics.map((item: { code: string }) => item.code))
      .toEqual(expect.arrayContaining(['contradictory_local_attachment_state', 'incomplete_checksum_mismatch_evidence']));
  });

  it.each([
    [['manifest.json', 'manifest.json'], 'zip_duplicate_raw_path'],
    [['folder/file.json', 'folder\\file.json'], 'zip_duplicate_normalized_path'],
    [['a/../b.json', 'b.json'], 'zip_traversal_path'],
    [['Manifest.json', 'manifest.json'], 'zip_case_fold_collision'],
    [['folder/', 'folder'], 'zip_directory_file_collision'],
    [['folder', 'folder/file.json'], 'zip_directory_file_collision'],
  ])('rejects unsafe ZIP names before assignment: %j', (names, code) => {
    expect(() => validateZipEntryNames(names)).toThrow(code);
  });
});

function zipOffsets(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let offset = bytes.length - 22; offset >= 0; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) { eocd = offset; break; }
  }
  const central = view.getUint32(eocd + 16, true);
  const local = view.getUint32(central + 42, true);
  return { view, eocd, central, local };
}

async function ordinaryZip(): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file('absinthe-recovery-export/manifest.json', '{}');
  return zip.generateAsync({ type: 'uint8array', compression: 'STORE' });
}

describe('K-320C final semantic corrections', () => {
  it('accepts only structurally valid, active, unambiguous Note attachment targets', async () => {
    const cases = [
      { notes: [note('n1')], expected: [] },
      { notes: [note('n1', { deleted_at: exportedAt })], expected: ['attachment_reference_targets_tombstone'] },
      { notes: [{ id: 'n1', deleted_at: null }], expected: ['attachment_reference_targets_malformed_note'] },
      { notes: [note('n1'), note('n1')], expected: ['attachment_reference_targets_ambiguous_note'] },
    ];
    for (const item of cases) {
      const pkg = await buildRecoveryExportPackage({ exportedAt, datasets: {
        notes: { availability: 'present_records', records: item.notes },
        attachmentReferences: { availability: 'present_records', records: [{ id: 'a1', referencedBy: ['n1'] }] },
      } });
      const codes = JSON.parse(pkg.files['metadata/conflicts.json']).diagnostics.map((value: { code: string }) => value.code);
      for (const expected of item.expected) expect(codes).toContain(expected);
      if (item.expected.length === 0) expect(codes).toEqual([]);
    }
  });

  it('keeps mixed attachment target diagnostics deterministic and unavailable Notes unresolved', async () => {
    const build = (references: string[]) => buildRecoveryExportPackage({ exportedAt, datasets: {
      notes: { availability: 'present_records', records: [note('valid'), note('dead', { deleted_at: exportedAt }), { id: 'bad', deleted_at: null }] },
      attachmentReferences: { availability: 'present_records', records: [{ id: 'a1', referencedBy: references }] },
    } });
    const first = await build(['missing', 'dead', 'valid', 'bad']);
    const second = await build(['bad', 'valid', 'dead', 'missing']);
    expect(first.files['metadata/conflicts.json']).toBe(second.files['metadata/conflicts.json']);
    const unavailable = await buildRecoveryExportPackage({ exportedAt, datasets: {
      notes: { availability: 'permission_denied' },
      attachmentReferences: { availability: 'present_records', records: [{ id: 'a1', referencedBy: ['n1'] }] },
    } });
    expect((await verifyRecoveryExportPackage(unavailable)).warnings.map(item => item.code))
      .toContain('attachment_reference_unresolved_due_to_unavailable_notes');
  });

  it('uses external Inbody storage keys and a ProteinProfile singleton identity without mutating payloads', async () => {
    const inbody = { weight: 70, smm: 31, pbf: 18 };
    const profile = { daily_target_g: 120, weight: 70, goal: 'maintain', activity: 'moderate' };
    const before = JSON.stringify({ inbody, profile });
    const pkg = await buildRecoveryExportPackage({ exportedAt, datasets: {
      inbodyLogs: { availability: 'present_records', records: [inbody], recordSources: [{ ...source, sourceId: '2026-07-11' }] },
      proteinProfiles: { availability: 'present_records', records: [profile], source },
    } });
    expect(pkg.manifest.completeness).not.toBe('invalid');
    expect(pkg.files['metadata/conflicts.json']).not.toContain('missing_or_invalid_id');
    expect(JSON.stringify({ inbody, profile })).toBe(before);

    const missingKey = await buildRecoveryExportPackage({ exportedAt, datasets: {
      inbodyLogs: { availability: 'present_records', records: [inbody], source },
    } });
    expect(missingKey.files['metadata/conflicts.json']).toContain('missing_external_identity');
  });

  it('detects duplicate/cross-source external identities and owner conflicts', async () => {
    const inbody = { weight: 70, smm: 31, pbf: 18 };
    const duplicate = await buildRecoveryExportPackage({ exportedAt, datasets: {
      inbodyLogs: { availability: 'present_records', records: [inbody, inbody], recordSources: [
        { ...source, sourceId: '2026-07-11' }, { ...source, sourceId: '2026-07-11' },
      ] },
      proteinProfiles: { availability: 'present_records', records: [
        { daily_target_g: 120, user_id: 'owner-a' }, { daily_target_g: 130, user_id: 'owner-b' },
      ], recordSources: [source, { ...source, label: 'other.json' }] },
    } });
    const codes = JSON.parse(duplicate.files['metadata/conflicts.json']).diagnostics.map((value: { code: string }) => value.code);
    expect(codes).toEqual(expect.arrayContaining(['duplicate_id_within_source', 'cross_source_record_conflict', 'conflicting_owner_ids']));
  });

  it('rejects local/central filename disagreement, unsafe local names, and malformed local headers', async () => {
    const mismatch = await ordinaryZip();
    const mismatchOffsets = zipOffsets(mismatch);
    mismatch[mismatchOffsets.local + 30] ^= 1;
    expect(() => validateZipBytes(mismatch)).toThrow('zip_local_central_name_mismatch');

    const unsafe = await ordinaryZip();
    const unsafeOffsets = zipOffsets(unsafe);
    unsafe.set(new TextEncoder().encode('../'), unsafeOffsets.local + 30);
    expect(() => validateZipBytes(unsafe)).toThrow('zip_local_header_unsafe_path');

    const invalidOffset = await ordinaryZip();
    const invalidOffsets = zipOffsets(invalidOffset);
    invalidOffsets.view.setUint32(invalidOffsets.central + 42, invalidOffsets.central, true);
    expect(() => validateZipBytes(invalidOffset)).toThrow('zip_local_header_offset_invalid');

    const signature = await ordinaryZip();
    const signatureOffsets = zipOffsets(signature);
    signatureOffsets.view.setUint32(signatureOffsets.local, 0, true);
    expect(() => validateZipBytes(signature)).toThrow('zip_local_header_invalid');

    const truncated = await ordinaryZip();
    const truncatedOffsets = zipOffsets(truncated);
    truncatedOffsets.view.setUint16(truncatedOffsets.local + 26, 0xffff, true);
    expect(() => validateZipBytes(truncated)).toThrow('zip_local_header_truncated');
  });

  it('rejects ZIP64 sentinels, extra fields, and locator signatures with one safe code', async () => {
    for (const mutate of [
      (bytes: Uint8Array) => { const { view, eocd } = zipOffsets(bytes); view.setUint16(eocd + 10, 0xffff, true); },
      (bytes: Uint8Array) => { const { view, eocd } = zipOffsets(bytes); view.setUint32(eocd + 12, 0xffffffff, true); },
      (bytes: Uint8Array) => { const { view, central } = zipOffsets(bytes); view.setUint32(central + 42, 0xffffffff, true); },
    ]) {
      const bytes = await ordinaryZip(); mutate(bytes);
      expect(() => validateZipBytes(bytes)).toThrow('zip64_unsupported');
    }

    const base = await ordinaryZip();
    const { eocd } = zipOffsets(base);
    const locator = new Uint8Array(base.length + 20);
    locator.set(base.subarray(0, eocd), 0);
    new DataView(locator.buffer).setUint32(eocd, 0x07064b50, true);
    locator.set(base.subarray(eocd), eocd + 20);
    expect(() => validateZipBytes(locator)).toThrow('zip64_unsupported');

    const extraBase = await ordinaryZip();
    const extraOffsets = zipOffsets(extraBase);
    const nameLength = extraOffsets.view.getUint16(extraOffsets.central + 28, true);
    const insertion = extraOffsets.central + 46 + nameLength;
    const extra = new Uint8Array(extraBase.length + 4);
    extra.set(extraBase.subarray(0, insertion), 0);
    extra.set([1, 0, 0, 0], insertion);
    extra.set(extraBase.subarray(insertion), insertion + 4);
    const extraView = new DataView(extra.buffer);
    extraView.setUint16(extraOffsets.central + 30, 4, true);
    const shiftedEocd = extraOffsets.eocd + 4;
    extraView.setUint32(shiftedEocd + 12, extraOffsets.view.getUint32(extraOffsets.eocd + 12, true) + 4, true);
    expect(() => validateZipBytes(extra)).toThrow('zip64_unsupported');

    expect(validateZipBytes(await ordinaryZip()).length).toBeGreaterThan(0);
  });
});

describe('K-320D adapter and ZIP flag integration', () => {
  it('derives stable per-record Inbody identities from source-confirmed dates through supported adapters', async () => {
    const records = [
      { date: '2026-07-11', weight: 70, smm: 31, pbf: 18 },
      { date: '2026-07-10', weight: 69, smm: 30, pbf: 19 },
    ];
    const before = JSON.stringify(records);
    const adapted = adaptInbodyJsonArray(JSON.stringify(records), source);
    const shuffled = adaptInbodyJsonArray(JSON.stringify([...records].reverse()), source);
    expect(adapted.recordSources?.map(item => item.sourceId).sort()).toEqual(['date:2026-07-10', 'date:2026-07-11']);
    expect(shuffled.recordSources?.map(item => item.sourceId).sort()).toEqual(['date:2026-07-10', 'date:2026-07-11']);
    expect(adapted.records).toEqual(records);
    expect(JSON.stringify(records)).toBe(before);

    const first = await buildRecoveryExportPackage({ exportedAt, datasets: { inbodyLogs: adapted } });
    const second = await buildRecoveryExportPackage({ exportedAt, datasets: { inbodyLogs: shuffled } });
    expect(first.files['health/inbody_logs.json']).toBe(second.files['health/inbody_logs.json']);
    expect(first.manifest.completeness).not.toBe('invalid');

    const storage = { getItem: () => JSON.stringify(records) };
    const fromStorage = readInbodyJsonArrayFromStorage(storage, 'inbody-history', source);
    expect(fromStorage.recordSources?.map(item => item.sourceId).sort()).toEqual(['date:2026-07-10', 'date:2026-07-11']);
  });

  it('diagnoses duplicate, missing, unsafe, and cross-source Inbody date identities without changing payloads', async () => {
    const duplicateRecords = [
      { date: '2026-07-11', weight: 70, smm: 31, pbf: 18 },
      { date: '2026-07-11', weight: 71, smm: 31, pbf: 18 },
    ];
    const duplicate = await buildRecoveryExportPackage({ exportedAt, datasets: {
      inbodyLogs: adaptInbodyJsonArray(JSON.stringify(duplicateRecords), source),
    } });
    expect(duplicate.files['metadata/conflicts.json']).toContain('duplicate_id_within_source');

    const missing = await buildRecoveryExportPackage({ exportedAt, datasets: {
      inbodyLogs: adaptInbodyJsonArray(JSON.stringify([{ weight: 70, smm: 31, pbf: 18 }]), source),
    } });
    expect(missing.files['metadata/conflicts.json']).toContain('missing_external_identity');

    const unsafe = adaptInbodyJsonArray(JSON.stringify([{ date: '../secret', weight: 70, smm: 31, pbf: 18 }]), source);
    expect(unsafe.recordSources?.[0].sourceId).toBeUndefined();

    const combined = combineRecoveryDatasetSources([
      adaptInbodyJsonArray(JSON.stringify([{ date: '2026-07-11', weight: 70, smm: 31, pbf: 18 }]), { ...source, label: 'a.json' }),
      adaptInbodyJsonArray(JSON.stringify([{ date: '2026-07-11', weight: 72, smm: 31, pbf: 18 }]), { ...source, label: 'b.json' }),
    ], source);
    const conflicted = await buildRecoveryExportPackage({ exportedAt, datasets: { inbodyLogs: combined } });
    expect(conflicted.files['metadata/conflicts.json']).toContain('cross_source_record_conflict');
  });

  it('rejects local and central UTF-8 filename flag disagreement before decoding', async () => {
    for (const mutate of [
      (view: DataView, _central: number, local: number) => view.setUint16(local + 6, view.getUint16(local + 6, true) | 0x0800, true),
      (view: DataView, central: number, _local: number) => view.setUint16(central + 8, view.getUint16(central + 8, true) | 0x0800, true),
    ]) {
      const bytes = await ordinaryZip();
      const { view, central, local } = zipOffsets(bytes);
      view.setUint16(central + 8, view.getUint16(central + 8, true) & ~0x0800, true);
      view.setUint16(local + 6, view.getUint16(local + 6, true) & ~0x0800, true);
      mutate(view, central, local);
      expect(() => validateZipBytes(bytes)).toThrow('zip_filename_encoding_flag_mismatch');
    }

    const matching = await ordinaryZip();
    expect(validateZipBytes(matching).length).toBeGreaterThan(0);
    const matchingUtf8 = await ordinaryZip();
    const matchingUtf8Offsets = zipOffsets(matchingUtf8);
    matchingUtf8Offsets.view.setUint16(matchingUtf8Offsets.central + 8, matchingUtf8Offsets.view.getUint16(matchingUtf8Offsets.central + 8, true) | 0x0800, true);
    matchingUtf8Offsets.view.setUint16(matchingUtf8Offsets.local + 6, matchingUtf8Offsets.view.getUint16(matchingUtf8Offsets.local + 6, true) | 0x0800, true);
    expect(validateZipBytes(matchingUtf8).length).toBeGreaterThan(0);

    const nameMismatch = await ordinaryZip();
    const nameOffsets = zipOffsets(nameMismatch);
    nameMismatch[nameOffsets.local + 30] ^= 1;
    expect(() => validateZipBytes(nameMismatch)).toThrow('zip_local_central_name_mismatch');

    const encrypted = await ordinaryZip();
    const encryptedOffsets = zipOffsets(encrypted);
    encryptedOffsets.view.setUint16(encryptedOffsets.local + 6, encryptedOffsets.view.getUint16(encryptedOffsets.local + 6, true) | 1, true);
    expect(() => validateZipBytes(encrypted)).toThrow('zip_encrypted_unsupported');
  });
});
