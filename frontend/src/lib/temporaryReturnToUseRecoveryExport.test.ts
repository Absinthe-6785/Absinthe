import JSZip from 'jszip';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { NoteBase } from '@/components/views/noteUtils';
import type { AppSettings } from '@/types';
import type { AttachmentMetadata } from './attachmentRepository';
import {
  HEALTH_RECOVERY_DATASETS,
  type HealthRecoveryDatasets,
} from './healthRecoveryExport';
import { stableRecoveryJson } from './recoveryExportPackage';
import {
  buildTemporaryReturnToUseRecoveryArchive,
  safeLocalBlobLocator,
  verifyTemporaryReturnToUseRecoveryArchive,
} from './temporaryReturnToUseRecoveryExport';

const account = { id: '18c8ab7d-6ba7-4547-aa55-f254ce900075', name: 'historical@example.test' };
const createdAt = '2026-08-12T00:00:00.000Z';
const notes: NoteBase[] = [
  {
    id: 'note-active',
    title: 'Active',
    body: '![available](attachment://att-available)\n![missing](attachment://att-missing)',
    updatedAt: 2,
    folderId: 'folder-1',
    deletedAt: null,
    relations: { related: ['note-deleted'] },
  },
  {
    id: 'note-deleted',
    title: 'Deleted',
    body: '',
    updatedAt: 1,
    folderId: null,
    deletedAt: 3,
  },
];
const appSettings = {
  darkMode: true,
  defaultCategory: 'general',
  defaultColor: 'blue',
  language: 'ko',
  notesFontFamily: 'system',
  notesFontSize: 16,
  accessToken: 'must-not-be-exported',
} as AppSettings & { accessToken: string };

function emptyHealth(): HealthRecoveryDatasets {
  return Object.fromEntries(HEALTH_RECOVERY_DATASETS.map(name => [name, []])) as HealthRecoveryDatasets;
}

async function sha256Bytes(value: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', value);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

async function build(
  extraAttachmentFields: Partial<AttachmentMetadata> = {},
  secondAttachmentFields: Partial<AttachmentMetadata> = {},
  thirdAttachmentFields?: Partial<AttachmentMetadata>,
) {
  const attachments: AttachmentMetadata[] = [
    {
      id: 'att-available',
      noteId: 'note-active',
      fileName: 'available.pdf',
      mimeType: 'application/pdf',
      size: 4,
      localBlobKey: 'local/att-available',
      createdAt,
      updatedAt: createdAt,
      deletedAt: null,
      ...extraAttachmentFields,
    },
    {
      id: 'att-missing',
      noteId: 'note-active',
      fileName: 'missing.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      size: 99,
      localBlobKey: 'local/att-missing',
      createdAt,
      updatedAt: createdAt,
      deletedAt: null,
      ...secondAttachmentFields,
    },
  ];
  if (thirdAttachmentFields) {
    attachments.push({
      id: 'att-safe',
      noteId: 'note-active',
      fileName: 'safe.txt',
      mimeType: 'text/plain',
      size: 5,
      localBlobKey: 'local/att-safe',
      createdAt,
      updatedAt: createdAt,
      deletedAt: null,
      ...thirdAttachmentFields,
    });
  }
  const archiveNotes = thirdAttachmentFields
    ? notes.map(note => note.id === 'note-active'
      ? { ...note, body: `${note.body}\n![safe](attachment://att-safe)` }
      : note)
    : notes;
  return buildTemporaryReturnToUseRecoveryArchive({
    account,
    notes: archiveNotes,
    folders: [{ id: 'folder-1', name: 'Folder', createdAt: 1 }],
    appSettings,
    createdAt,
  }, {
    readHealth: async () => ({ datasets: emptyHealth(), importState: null }),
    listAttachments: async () => attachments,
    readAttachmentBlob: async key => {
      if (key === 'local/att-available') return new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'application/pdf' });
      if (key === 'local/att-safe') return new Blob(['safe'], { type: 'text/plain' });
      return null;
    },
    listSnapshots: () => [],
  });
}

describe('temporary Return-to-Use full recovery package', () => {
  it('retains all ten Health datasets, Notes tombstones, counts, and deterministic bytes', async () => {
    const first = await build();
    const second = await build();
    expect(first.bytes).toEqual(second.bytes);
    expect(first.verification).toMatchObject({ valid: true, coreRecoveryValid: true });
    expect(first.manifest.counts).toMatchObject({
      notesActive: 1,
      notesTombstones: 1,
      folders: 1,
      noteRelationships: 1,
      healthTotal: 0,
      attachmentMetadata: 2,
      attachmentReferences: 2,
      attachmentBlobsIncluded: 1,
      attachmentBlobsMissing: 1,
    });
    expect(Object.keys(first.manifest.counts.health).sort()).toEqual([...HEALTH_RECOVERY_DATASETS].sort());
    expect(Object.values(first.manifest.counts.health)).toEqual(HEALTH_RECOVERY_DATASETS.map(() => 0));

    const zip = await JSZip.loadAsync(first.bytes);
    for (const path of [
      'exercise_blocks', 'workout_logs', 'inbody_logs', 'health_routines', 'routines',
      'routine_logs', 'protein_profiles', 'protein_sources', 'protein_intake_logs', 'workout_memos',
    ]) {
      expect(zip.file(`absinthe-temporary-return-to-use/recovery/health/${path}.json`)).not.toBeNull();
    }
    expect(zip.file('absinthe-temporary-return-to-use/recovery/notes/active.json')).not.toBeNull();
    expect(zip.file('absinthe-temporary-return-to-use/recovery/notes/tombstones.json')).not.toBeNull();
  });

  it('archives available blobs separately and truthfully classifies missing blobs', async () => {
    const result = await build();
    const available = result.manifest.attachments.find(item => item.attachmentId === 'att-available');
    const missing = result.manifest.attachments.find(item => item.attachmentId === 'att-missing');
    expect(available).toMatchObject({ status: 'included', archivedSize: 4, metadataPresent: true });
    expect(available?.archivePath).toMatch(/^attachments\/blobs\/att-available\/[a-f0-9]{64}\.bin$/);
    expect(missing).toMatchObject({
      status: 'missing',
      archivePath: null,
      sha256: null,
      archivedSize: null,
      metadataPresent: true,
    });
  });

  it('excludes unallowlisted secrets and independently detects ZIP tampering', async () => {
    const result = await build();
    const zip = await JSZip.loadAsync(result.bytes);
    expect(await zip.file('absinthe-temporary-return-to-use/manifest.json')!.async('string'))
      .not.toContain('must-not-be-exported');
    const path = result.manifest.attachments.find(item => item.status === 'included')!.archivePath!;
    zip.file(`absinthe-temporary-return-to-use/${path}`, new Uint8Array([9, 9, 9]));
    const tampered = await zip.generateAsync({ type: 'uint8array', compression: 'STORE' });
    const verification = await verifyTemporaryReturnToUseRecoveryArchive(tampered);
    expect(verification.valid).toBe(false);
    expect(verification.errors).toContain(`temporary_recovery_checksum_mismatch:${path}`);
  });

  it('structurally excludes secret-bearing attachment diagnostics from every archive entry', async () => {
    const secretValues = [
      'Authorization: Bearer test-secret',
      'access-token-test-secret',
      'refresh-token-test-secret',
      'cookie=session-test-secret',
      'https://signed.example.test/blob?token=signed-test-secret',
      'https://upload.example.test/session/resumable-test-secret',
      'provider warning: Authorization: Bearer test-secret',
      'opaque-token-locator-test-secret',
      'local/access-token-test-secret',
    ];
    const result = await build({
      remoteError: secretValues[0],
      remoteFileId: secretValues[1],
      remoteChecksum: secretValues[2],
      remoteSize: 4,
      remoteMimeType: secretValues[3],
      remoteBlobKey: secretValues[4],
      remoteProvider: 'googleDrive',
      remoteSyncedAt: secretValues[5],
      remoteUpdatedAt: secretValues[5],
      lastRemoteSyncAttemptAt: secretValues[5],
      lastRemoteRecoveryAt: secretValues[5],
      remoteSyncStatus: 'failed',
      remoteVerification: {
        sizeVerified: false,
        checksumVerified: false,
        checksumAlgorithm: secretValues[3],
        warnings: [secretValues[6], secretValues[0], secretValues[5]],
      },
      localBlobKey: secretValues[8],
    }, {
      localBlobKey: 'local-attachment/att-other',
    }, {
      localBlobKey: 'local/att-safe',
    });
    const zip = await JSZip.loadAsync(result.bytes);
    const serializedEntries = await Promise.all(Object.values(zip.files).map(async entry => `${entry.name}\n${await entry.async('string')}`));
    const serialized = serializedEntries.join('\n');
    for (const secret of secretValues) expect(serialized).not.toContain(secret);

    const inventory = JSON.parse(await zip.file(
      'absinthe-temporary-return-to-use/recovery/attachments/inventory.json',
    )!.async('string')) as { activeRecords?: Array<Record<string, unknown>> };
    expect(inventory.activeRecords?.[0]).toMatchObject({
      id: 'att-available',
      fileName: 'available.pdf',
      mimeType: 'application/pdf',
      size: 4,
      localBlobKey: null,
    });
    expect(inventory.activeRecords?.[0]).not.toHaveProperty('remoteError');
    expect(inventory.activeRecords?.[0]).not.toHaveProperty('remoteFileId');
    expect(inventory.activeRecords?.[0]).not.toHaveProperty('remoteVerification');
    expect(inventory.activeRecords?.find(record => record.id === 'att-missing')).toMatchObject({ localBlobKey: null });
    expect(inventory.activeRecords?.find(record => record.id === 'att-safe')).toMatchObject({
      id: 'att-safe',
      noteId: 'note-active',
      fileName: 'safe.txt',
      mimeType: 'text/plain',
      size: 5,
      localBlobKey: 'local/att-safe',
      localAvailability: 'local_present',
      blobAvailability: 'blob_present',
    });

    const expectedSafeSha256 = await sha256Bytes(new TextEncoder().encode('safe'));
    const manifest = JSON.parse(await zip.file(
      'absinthe-temporary-return-to-use/manifest.json',
    )!.async('string')) as { attachments?: Array<Record<string, unknown>> };
    expect(manifest.attachments?.find(attachment => attachment.attachmentId === 'att-safe')).toMatchObject({
      fileName: 'safe.txt',
      sha256: expectedSafeSha256,
    });

    const references = JSON.parse(await zip.file(
      'absinthe-temporary-return-to-use/recovery/attachments/references.json',
    )!.async('string')) as { activeRecords?: Array<Record<string, unknown>> };
    expect(references.activeRecords).toContainEqual({ id: 'att-safe', referencedBy: ['note-active'] });
  });

  it('accepts only canonical local blob namespaces and rejects opaque or unsafe locators', () => {
    expect(safeLocalBlobLocator('local/att-available', 'att-available')).toBe('local/att-available');
    expect(safeLocalBlobLocator('local-image/att-available', 'att-available')).toBe('local-image/att-available');
    expect(safeLocalBlobLocator('local-attachment/att-available', 'att-available')).toBe('local-attachment/att-available');
    expect(safeLocalBlobLocator('local-attachment/recovered-att-available', 'att-available'))
      .toBe('local-attachment/recovered-att-available');

    for (const value of [
      'local/access-token-test-secret',
      'local-image/refresh-token-test-secret',
      'local-attachment/session-test-secret',
      'local/some-other-attachment-id',
      'local-attachment/recovered-some-other-attachment-id',
      'access-token-test-secret',
      'refresh-token-test-secret',
      'session-test-secret',
      'Authorization: Bearer test-secret',
      'Bearer test-secret',
      'https://signed.example.test/blob?token=secret',
      'http://example.test/blob',
      'local/blob?token=secret',
      'local/blob#fragment',
      'local/../secret',
      'cookie=session-secret',
      'https://upload.example.test/session/resumable-secret',
    ]) {
      expect(safeLocalBlobLocator(value, 'att-available')).toBeNull();
    }
    expect(safeLocalBlobLocator('local/att-available', 'att-other')).toBeNull();
    expect(safeLocalBlobLocator('local/att-available', 'att/unsafe')).toBeNull();
  });

  it('binds the outer manifest inventory, counts, metadata, and blob sizes during readback', async () => {
    const result = await build();
    const zip = await JSZip.loadAsync(result.bytes);
    const manifestPath = 'absinthe-temporary-return-to-use/manifest.json';
    const checksumsPath = 'absinthe-temporary-return-to-use/checksums.sha256';
    const manifest = JSON.parse(await zip.file(manifestPath)!.async('string'));
    manifest.counts.healthTotal += 1;
    manifest.payloadFiles[0].bytes += 1;
    manifest.attachments.find((item: { status: string }) => item.status === 'included').archivedSize += 1;
    zip.file(manifestPath, stableRecoveryJson(manifest));
    const manifestChecksum = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(stableRecoveryJson(manifest)),
    );
    const replacement = Array.from(new Uint8Array(manifestChecksum), byte => byte.toString(16).padStart(2, '0')).join('');
    const checksumText = (await zip.file(checksumsPath)!.async('string'))
      .replace(/^[a-f0-9]{64}  manifest\.json$/m, `${replacement}  manifest.json`);
    zip.file(checksumsPath, checksumText);
    const verification = await verifyTemporaryReturnToUseRecoveryArchive(
      await zip.generateAsync({ type: 'uint8array', compression: 'STORE' }),
    );
    expect(verification.valid).toBe(false);
    expect(verification.errors).toEqual(expect.arrayContaining([
      'temporary_recovery_payload_manifest_mismatch',
      'temporary_recovery_count_binding_mismatch',
      'temporary_recovery_attachment_size_mismatch:att-available',
    ]));
  });

  it('keeps temporary recovery entry points dormant outside the normal Recovery Center', () => {
    const panel = readFileSync(join(process.cwd(), 'src/components/views/features/settings/RecoveryCenterPanel.tsx'), 'utf8');
    const settings = readFileSync(join(process.cwd(), 'src/components/views/SettingsView.tsx'), 'utf8');
    expect(panel).not.toContain('data-settings-temporary-full-backup');
    expect(panel).not.toContain('onCreateTemporaryFullBackup');
    expect(panel).not.toContain('temporaryFullBackupAttachmentNotice');
    expect(settings).not.toContain('downloadTemporaryReturnToUseRecoveryArchive');
    expect(settings).toContain('doVaultBackupZip');
    expect(settings).toContain('useVaultRestoreFlow');
    expect(settings).toContain('VaultRestoreModal');
    expect(settings).not.toContain('doTemporaryFullBackup');
    expect(settings).not.toContain('HealthRecoveryImportPanel');
    expect(settings).not.toContain('health-recovery-export.html');
  });
});
