import JSZip from 'jszip';
import type { NoteBase } from '@/components/views/noteUtils';
import type { NoteFolder } from '@/store/useNotesStore';
import type { AppSettings } from '@/types';
import { findAttachmentReferencesInText, type AttachmentMetadata } from './attachmentRepository';
import { createLocalAttachmentBlobAdapter } from './attachmentBlobIndexedDb';
import { createLocalAttachmentMetadataRepository } from './attachmentMetadataIndexedDb';
import { type LocalHealthImportState } from './healthLocalRepository';
import { createLocalHealthRepository } from './healthLocalRuntime';
import {
  HEALTH_RECOVERY_DATASETS,
  type HealthRecoveryDatasetName,
  type HealthRecoveryDatasets,
  type HealthRecoveryRecord,
} from './healthRecoveryExport';
import {
  buildRecoveryExportPackage,
  stableRecoveryJson,
  verifyRecoveryExportPackage,
  type RecoveryDatasetInput,
  type RecoveryDatasetKey,
  type RecoveryExportManifest,
  type RecoveryExportPackage,
  type RecoveryRecord,
} from './recoveryExportPackage';
import { enumerateVaultSnapshots, type VaultSnapshotSummary } from './vaultSnapshotStore';

export const TEMPORARY_RTU_RECOVERY_KIND = 'absinthe-temporary-return-to-use-recovery' as const;
export const TEMPORARY_RTU_RECOVERY_VERSION = 1 as const;
export const TEMPORARY_RTU_INCIDENT_BOUNDARY = Object.freeze({
  confidence: 'MEDIUM',
  effectiveCutoff: '2026-06-18T11:40:00+09:00/2026-06-20T11:49:00+09:00',
  classification: 'MULTIPLE_FACTORS',
});

const ROOT = 'absinthe-temporary-return-to-use';
const RECOVERY_PREFIX = 'recovery/';
const FIXED_ZIP_DATE = new Date('1980-01-01T00:00:00.000Z');

const HEALTH_DATASET_TO_RECOVERY_KEY = Object.freeze({
  exercise_blocks: 'exerciseBlocks',
  workout_logs: 'workoutLogs',
  inbody_logs: 'inbodyLogs',
  health_routines: 'healthRoutines',
  routines: 'routines',
  routine_logs: 'routineLogs',
  protein_profiles: 'proteinProfiles',
  protein_sources: 'proteinSources',
  protein_intake_logs: 'proteinIntakeLogs',
  workout_memos: 'workoutMemos',
} satisfies Record<HealthRecoveryDatasetName, RecoveryDatasetKey>);

const REQUIRED_DATASETS: readonly RecoveryDatasetKey[] = Object.freeze([
  'notes', 'noteFolders', 'noteRelationships',
  ...HEALTH_RECOVERY_DATASETS.map(name => HEALTH_DATASET_TO_RECOVERY_KEY[name]),
  'attachmentInventory', 'attachmentReferences',
]);

type BlobStatus = 'included' | 'missing' | 'not_available' | 'unreadable';

export interface TemporaryRtuAttachmentManifestEntry {
  attachmentId: string;
  noteId: string | null;
  fileName: string;
  mimeType: string;
  declaredSize: number;
  localBlobKey: string | null;
  status: BlobStatus;
  archivePath: string | null;
  sha256: string | null;
  archivedSize: number | null;
  metadataPresent: boolean;
}

export interface TemporaryRtuRecoveryManifest {
  kind: typeof TEMPORARY_RTU_RECOVERY_KIND;
  formatVersion: typeof TEMPORARY_RTU_RECOVERY_VERSION;
  createdAt: string;
  deterministicGivenCreatedAt: true;
  account: { id: string; name: string };
  safePreferences: {
    darkMode: boolean;
    defaultCategory: string;
    defaultColor: string;
    language: AppSettings['language'];
    notesFontFamily: AppSettings['notesFontFamily'] | null;
    notesFontSize: number | null;
    notesTextColor: string | null;
    notesAccentColor: string | null;
  };
  incidentBoundary: typeof TEMPORARY_RTU_INCIDENT_BOUNDARY;
  recoveryAuthority: LocalHealthImportState | null;
  snapshotMetadata: VaultSnapshotSummary[];
  counts: {
    notesActive: number;
    notesTombstones: number;
    folders: number;
    noteRelationships: number;
    health: Record<HealthRecoveryDatasetName, number>;
    healthTotal: number;
    attachmentMetadata: number;
    attachmentReferences: number;
    attachmentBlobsIncluded: number;
    attachmentBlobsMissing: number;
  };
  attachments: TemporaryRtuAttachmentManifestEntry[];
  coreRecoveryManifestSha256: string;
  payloadFiles: Array<{ path: string; sha256: string; bytes: number }>;
  fileCount: number;
  secretMaterialIncluded: false;
  remoteMutationPerformed: false;
}

export interface TemporaryRtuRecoveryVerification {
  valid: boolean;
  verifiedFileCount: number;
  coreRecoveryValid: boolean;
  manifest: TemporaryRtuRecoveryManifest;
  errors: string[];
}

export interface TemporaryRtuRecoveryArchive {
  bytes: Uint8Array;
  manifest: TemporaryRtuRecoveryManifest;
  verification: TemporaryRtuRecoveryVerification;
}

export interface TemporaryRtuRecoveryInput {
  account: { id: string; name: string };
  notes: readonly NoteBase[];
  folders: readonly NoteFolder[];
  appSettings: AppSettings;
  createdAt?: string;
}

export interface TemporaryRtuRecoverySources {
  readHealth?: (accountId: string) => Promise<{
    datasets: HealthRecoveryDatasets;
    importState: LocalHealthImportState | null;
  }>;
  listAttachments?: () => Promise<AttachmentMetadata[]>;
  readAttachmentBlob?: (key: string) => Promise<Blob | null>;
  listSnapshots?: () => VaultSnapshotSummary[];
}

function jsonRecord(value: unknown): RecoveryRecord {
  return JSON.parse(JSON.stringify(value)) as RecoveryRecord;
}

function dataset(records: readonly RecoveryRecord[], label: string, deletedField: string | null = 'deleted_at'): RecoveryDatasetInput {
  return {
    availability: records.length === 0 ? 'present_empty' : 'present_records',
    records,
    deletedField,
    source: { kind: 'local', label, ownerScope: 'confirmed' },
  };
}

function safeAttachmentId(value: string): string {
  return encodeURIComponent(value).replace(/%/g, '_');
}

async function sha256Bytes(value: Uint8Array): Promise<string> {
  const copy = new Uint8Array(value.byteLength);
  copy.set(value);
  const digest = await crypto.subtle.digest('SHA-256', copy.buffer);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

async function sha256Text(value: string): Promise<string> {
  return sha256Bytes(new TextEncoder().encode(value));
}

function canonicalChecksum(value: string | undefined): string | null {
  if (!value) return null;
  const normalized = value.toLowerCase().replace(/^sha256:/, '');
  return /^[a-f0-9]{64}$/.test(normalized) ? normalized : null;
}

const LOCAL_BLOB_LOCATOR_MAX_LENGTH = 256;
const LOCAL_BLOB_LOCATOR_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export function safeLocalBlobLocator(value: string | undefined, attachmentId: string): string | null {
  if (!value || value.length > LOCAL_BLOB_LOCATOR_MAX_LENGTH || !LOCAL_BLOB_LOCATOR_ID_PATTERN.test(attachmentId)) {
    return null;
  }
  if (/\s|[\u0000-\u001F\u007F]/.test(value)) return null;
  if (value.includes('://') || value.includes('?') || value.includes('#') || value.includes('\\')) return null;

  const allowedForms = new Set([
    `local/${attachmentId}`,
    `local-image/${attachmentId}`,
    `local-attachment/${attachmentId}`,
    `local-attachment/recovered-${attachmentId}`,
  ]);
  return allowedForms.has(value) ? value : null;
}

function safeAttachmentRecoveryRecord(item: AttachmentMetadata, localBlobKey: string | null): RecoveryRecord {
  return jsonRecord({
    id: item.id,
    noteId: item.noteId ?? null,
    fileName: item.fileName,
    mimeType: item.mimeType,
    size: item.size,
    checksum: canonicalChecksum(item.checksum),
    localBlobKey,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    deletedAt: item.deletedAt ?? null,
    keepOffline: item.keepOffline ?? false,
    lastAccessedAt: item.lastAccessedAt ?? null,
    lastOpenedAt: item.lastOpenedAt ?? null,
    syncStatus: item.syncStatus ?? 'unknown',
  });
}

function checksumFile(checksums: Readonly<Record<string, string>>): string {
  return `${Object.entries(checksums).sort(([left], [right]) => left.localeCompare(right))
    .map(([path, checksum]) => `${checksum}  ${path}`).join('\n')}\n`;
}

function parseChecksumFile(value: string): Record<string, string> {
  const checksums: Record<string, string> = {};
  for (const line of value.split('\n').filter(Boolean)) {
    const match = /^([a-f0-9]{64})  ([^\\]+)$/.exec(line);
    if (!match) throw new Error('temporary_recovery_invalid_checksum_line');
    if (checksums[match[2]]) throw new Error('temporary_recovery_duplicate_checksum_path');
    checksums[match[2]] = match[1];
  }
  return checksums;
}

async function defaultReadHealth(accountId: string) {
  const repository = await createLocalHealthRepository(accountId);
  const [datasets, importState] = await Promise.all([repository.readAll(), repository.readImportState()]);
  return { datasets, importState };
}

async function resolveAttachmentState(
  metadata: AttachmentMetadata[],
  references: ReadonlyMap<string, Set<string>>,
  readBlob: (key: string) => Promise<Blob | null>,
): Promise<{
  inventoryRecords: RecoveryRecord[];
  referenceRecords: RecoveryRecord[];
  manifestEntries: TemporaryRtuAttachmentManifestEntry[];
  blobFiles: Record<string, Uint8Array>;
}> {
  const byId = new Map(metadata.map(item => [item.id, item]));
  for (const [id, noteIds] of references) if (!byId.has(id)) {
    byId.set(id, {
      id,
      noteId: [...noteIds].sort()[0],
      fileName: `missing-metadata-${id}`,
      mimeType: 'application/octet-stream',
      size: 0,
      createdAt: '1970-01-01T00:00:00.000Z',
      updatedAt: '1970-01-01T00:00:00.000Z',
      deletedAt: null,
      syncStatus: 'failed',
    });
  }

  const inventoryRecords: RecoveryRecord[] = [];
  const referenceRecords: RecoveryRecord[] = [];
  const manifestEntries: TemporaryRtuAttachmentManifestEntry[] = [];
  const blobFiles: Record<string, Uint8Array> = {};

  for (const [id, item] of [...byId].sort(([left], [right]) => left.localeCompare(right))) {
    const metadataPresent = metadata.some(candidate => candidate.id === id);
    const localBlobKey = safeLocalBlobLocator(item.localBlobKey, item.id);
    let status: BlobStatus = localBlobKey
      ? 'missing'
      : item.localBlobKey
        ? 'unreadable'
        : 'not_available';
    let archivePath: string | null = null;
    let checksum: string | null = null;
    let archivedSize: number | null = null;
    if (localBlobKey) {
      try {
        const blob = await readBlob(localBlobKey);
        if (blob) {
          const bytes = new Uint8Array(await blob.arrayBuffer());
          checksum = await sha256Bytes(bytes);
          const expected = canonicalChecksum(item.checksum);
          if (expected && expected !== checksum) throw new Error(`attachment_blob_checksum_mismatch:${id}`);
          archivePath = `attachments/blobs/${safeAttachmentId(id)}/${checksum}.bin`;
          blobFiles[archivePath] = bytes;
          archivedSize = bytes.byteLength;
          status = 'included';
        }
      } catch (error) {
        if (error instanceof Error && error.message.startsWith('attachment_blob_checksum_mismatch:')) throw error;
        status = 'unreadable';
      }
    }
    const referencedBy = [...(references.get(id) ?? new Set<string>())].sort();
    const missing = status === 'missing' || status === 'unreadable' || !metadataPresent;
    inventoryRecords.push(jsonRecord({
      ...safeAttachmentRecoveryRecord(item, localBlobKey),
      localMissingConfirmed: status === 'missing',
      localSourceProvided: true,
      remoteSourceProvided: false,
      blobMissingConfirmed: missing,
      metadataMissingConfirmed: !metadataPresent,
      localAvailability: status === 'included' ? 'local_present' : status === 'not_available' ? 'local_unknown' : 'local_missing_confirmed',
      remoteAvailability: 'remote_source_not_provided',
      blobAvailability: status === 'included' ? 'blob_present' : missing ? 'blob_missing_confirmed' : 'blob_unknown',
      checksumStatus: checksum ? 'checksum_known' : 'checksum_unknown',
      locatorRetainedForRecovery: missing && Boolean(localBlobKey),
    }));
    referenceRecords.push(jsonRecord({ id, referencedBy }));
    manifestEntries.push({
      attachmentId: id,
      noteId: item.noteId ?? null,
      fileName: item.fileName,
      mimeType: item.mimeType,
      declaredSize: item.size,
      localBlobKey,
      status,
      archivePath,
      sha256: checksum,
      archivedSize,
      metadataPresent,
    });
  }
  return { inventoryRecords, referenceRecords, manifestEntries, blobFiles };
}

function safePreferences(settings: AppSettings): TemporaryRtuRecoveryManifest['safePreferences'] {
  return {
    darkMode: settings.darkMode,
    defaultCategory: settings.defaultCategory,
    defaultColor: settings.defaultColor,
    language: settings.language,
    notesFontFamily: settings.notesFontFamily ?? null,
    notesFontSize: settings.notesFontSize ?? null,
    notesTextColor: settings.notesTextColor ?? null,
    notesAccentColor: settings.notesAccentColor ?? null,
  };
}

function normalizedSnapshots(snapshots: readonly VaultSnapshotSummary[]): VaultSnapshotSummary[] {
  return snapshots.map(snapshot => ({
    snapshotId: snapshot.snapshotId,
    slot: snapshot.slot,
    slotKey: snapshot.slotKey,
    createdAt: snapshot.createdAt,
    payloadBytes: snapshot.payloadBytes,
    noteCount: snapshot.noteCount,
    folderCount: snapshot.folderCount,
  })).sort((left, right) => left.snapshotId.localeCompare(right.snapshotId));
}

async function buildCorePackage(
  input: TemporaryRtuRecoveryInput,
  createdAt: string,
  health: { datasets: HealthRecoveryDatasets; importState: LocalHealthImportState | null },
  attachments: Awaited<ReturnType<typeof resolveAttachmentState>>,
  snapshots: VaultSnapshotSummary[],
): Promise<{ core: RecoveryExportPackage; relationshipCount: number }> {
  const notes = input.notes.map(jsonRecord);
  const folders = input.folders.map(jsonRecord);
  const relationships = input.notes
    .filter(note => note.relations && Object.keys(note.relations).length > 0)
    .map(note => jsonRecord({ id: note.id, relations: note.relations }));
  const datasets: Partial<Record<RecoveryDatasetKey, RecoveryDatasetInput>> = {
    notes: dataset(notes, 'indexeddb:notes', 'deletedAt'),
    noteFolders: dataset(folders, 'local:note-folders', null),
    noteRelationships: dataset(relationships, 'local:note-relationships', null),
    attachmentInventory: dataset(attachments.inventoryRecords, 'indexeddb:attachment-metadata', 'deletedAt'),
    attachmentReferences: dataset(attachments.referenceRecords, 'local:note-attachment-references', null),
  };
  for (const name of HEALTH_RECOVERY_DATASETS) {
    datasets[HEALTH_DATASET_TO_RECOVERY_KEY[name]] = dataset(
      health.datasets[name].map((record: HealthRecoveryRecord) => jsonRecord(record)),
      `indexeddb:health:${name}`,
      'deleted_at',
    );
  }
  const core = await buildRecoveryExportPackage({
    exportedAt: createdAt,
    datasets,
    requiredDatasets: REQUIRED_DATASETS,
    syncState: {
      account: { id: input.account.id, name: input.account.name },
      safePreferences: safePreferences(input.appSettings),
      recoveryAuthority: health.importState,
      snapshotMetadata: snapshots,
      incidentBoundary: TEMPORARY_RTU_INCIDENT_BOUNDARY,
      remoteMutationPerformed: false,
    },
  });
  return { core, relationshipCount: relationships.length };
}

async function createArchive(
  core: RecoveryExportPackage,
  manifestBase: Omit<TemporaryRtuRecoveryManifest, 'coreRecoveryManifestSha256' | 'payloadFiles' | 'fileCount'>,
  blobFiles: Readonly<Record<string, Uint8Array>>,
): Promise<{ bytes: Uint8Array; manifest: TemporaryRtuRecoveryManifest }> {
  const textFiles: Record<string, string> = {};
  for (const [path, content] of Object.entries(core.files)) textFiles[`${RECOVERY_PREFIX}${path}`] = content;
  const checksums: Record<string, string> = {};
  for (const [path, content] of Object.entries(textFiles)) checksums[path] = await sha256Text(content);
  for (const [path, bytes] of Object.entries(blobFiles)) checksums[path] = await sha256Bytes(bytes);
  const payloadFiles = [
    ...Object.entries(textFiles).map(([path, content]) => ({ path, sha256: checksums[path], bytes: new TextEncoder().encode(content).byteLength })),
    ...Object.entries(blobFiles).map(([path, bytes]) => ({ path, sha256: checksums[path], bytes: bytes.byteLength })),
  ].sort((left, right) => left.path.localeCompare(right.path));
  const manifest: TemporaryRtuRecoveryManifest = {
    ...manifestBase,
    coreRecoveryManifestSha256: checksums[`${RECOVERY_PREFIX}manifest.json`],
    payloadFiles,
    fileCount: payloadFiles.length + 2,
  };
  const manifestText = stableRecoveryJson(manifest);
  checksums['manifest.json'] = await sha256Text(manifestText);
  const checksumText = checksumFile(checksums);
  const zip = new JSZip();
  for (const [path, content] of Object.entries(textFiles).sort(([left], [right]) => left.localeCompare(right))) {
    zip.file(`${ROOT}/${path}`, content, { date: FIXED_ZIP_DATE, createFolders: true });
  }
  for (const [path, bytes] of Object.entries(blobFiles).sort(([left], [right]) => left.localeCompare(right))) {
    zip.file(`${ROOT}/${path}`, bytes, { date: FIXED_ZIP_DATE, createFolders: true, binary: true });
  }
  zip.file(`${ROOT}/manifest.json`, manifestText, { date: FIXED_ZIP_DATE, createFolders: true });
  zip.file(`${ROOT}/checksums.sha256`, checksumText, { date: FIXED_ZIP_DATE, createFolders: true });
  for (const entry of Object.values(zip.files)) entry.date = FIXED_ZIP_DATE;
  return {
    bytes: await zip.generateAsync({ type: 'uint8array', compression: 'STORE', platform: 'DOS' }),
    manifest,
  };
}

export async function verifyTemporaryReturnToUseRecoveryArchive(
  bytes: Uint8Array,
): Promise<TemporaryRtuRecoveryVerification> {
  const errors: string[] = [];
  const zip = await JSZip.loadAsync(bytes);
  const fileNames = Object.values(zip.files).filter(file => !file.dir).map(file => file.name).sort();
  const relativeNames = fileNames.map(name => name.startsWith(`${ROOT}/`) ? name.slice(ROOT.length + 1) : name);
  if (relativeNames.some((name, index) => name === fileNames[index])) errors.push('temporary_recovery_unexpected_root');
  const manifestFile = zip.file(`${ROOT}/manifest.json`);
  const checksumFileEntry = zip.file(`${ROOT}/checksums.sha256`);
  if (!manifestFile || !checksumFileEntry) throw new Error('temporary_recovery_manifest_missing');
  const manifest = JSON.parse(await manifestFile.async('string')) as TemporaryRtuRecoveryManifest;
  if (manifest.kind !== TEMPORARY_RTU_RECOVERY_KIND || manifest.formatVersion !== TEMPORARY_RTU_RECOVERY_VERSION) {
    errors.push('temporary_recovery_manifest_identity_invalid');
  }
  if (manifest.fileCount !== relativeNames.length) errors.push('temporary_recovery_file_count_mismatch');
  const checksums = parseChecksumFile(await checksumFileEntry.async('string'));
  const expectedChecksummed = relativeNames.filter(name => name !== 'checksums.sha256').sort();
  if (stableRecoveryJson(Object.keys(checksums).sort()) !== stableRecoveryJson(expectedChecksummed)) {
    errors.push('temporary_recovery_checksum_inventory_mismatch');
  }
  let verifiedFileCount = 0;
  const actualFiles = new Map<string, { sha256: string; bytes: number }>();
  for (const path of expectedChecksummed) {
    const file = zip.file(`${ROOT}/${path}`);
    const content = file ? await file.async('uint8array') : null;
    const checksum = content ? await sha256Bytes(content) : null;
    if (!content || checksum !== checksums[path]) {
      errors.push(`temporary_recovery_checksum_mismatch:${path}`);
    } else {
      verifiedFileCount += 1;
      actualFiles.set(path, { sha256: checksum, bytes: content.byteLength });
    }
  }
  const actualPayloadFiles = [...actualFiles.entries()]
    .filter(([path]) => path !== 'manifest.json')
    .map(([path, value]) => ({ path, ...value }))
    .sort((left, right) => left.path.localeCompare(right.path));
  if (!Array.isArray(manifest.payloadFiles)
    || stableRecoveryJson(manifest.payloadFiles) !== stableRecoveryJson(actualPayloadFiles)) {
    errors.push('temporary_recovery_payload_manifest_mismatch');
  }
  const coreFiles: Record<string, string> = {};
  for (const path of relativeNames.filter(name => name.startsWith(RECOVERY_PREFIX))) {
    coreFiles[path.slice(RECOVERY_PREFIX.length)] = await zip.file(`${ROOT}/${path}`)!.async('string');
  }
  const coreVerification = await verifyRecoveryExportPackage({ files: coreFiles });
  if (!coreVerification.valid) errors.push(...coreVerification.errors.map(error => `core:${error.code}:${error.path}`));
  if (manifest.coreRecoveryManifestSha256 !== checksums[`${RECOVERY_PREFIX}manifest.json`]) {
    errors.push('temporary_recovery_core_manifest_binding_mismatch');
  }
  const coreManifest = JSON.parse(coreFiles['manifest.json'] ?? '{}') as RecoveryExportManifest;
  const coreEntryCount = (path: string): number | null | undefined =>
    coreManifest.datasets?.find(entry => entry.path === path)?.totalCount;
  const healthCounts = Object.fromEntries(HEALTH_RECOVERY_DATASETS.map(name => [
    name,
    coreEntryCount(`health/${name}.json`) ?? -1,
  ])) as Record<HealthRecoveryDatasetName, number>;
  const expectedCounts = {
    notesActive: coreEntryCount('notes/active.json') ?? -1,
    notesTombstones: coreEntryCount('notes/tombstones.json') ?? -1,
    folders: coreEntryCount('notes/folders.json') ?? -1,
    noteRelationships: coreEntryCount('notes/relationships.json') ?? -1,
    health: Object.fromEntries(HEALTH_RECOVERY_DATASETS.map(name => [name, healthCounts[name]])),
    healthTotal: HEALTH_RECOVERY_DATASETS.reduce((sum, name) => sum + healthCounts[name], 0),
    attachmentMetadata: Array.isArray(manifest.attachments)
      ? manifest.attachments.filter(item => item.metadataPresent).length : -1,
    attachmentReferences: coreEntryCount('attachments/references.json') ?? -1,
    attachmentBlobsIncluded: Array.isArray(manifest.attachments)
      ? manifest.attachments.filter(item => item.status === 'included').length : -1,
    attachmentBlobsMissing: Array.isArray(manifest.attachments)
      ? manifest.attachments.filter(item => item.status === 'missing' || item.status === 'unreadable').length : -1,
  };
  if (stableRecoveryJson(manifest.counts) !== stableRecoveryJson(expectedCounts)) {
    errors.push('temporary_recovery_count_binding_mismatch');
  }
  const syncState = JSON.parse(coreFiles['metadata/sync-state.json'] ?? '{}') as { state?: Record<string, unknown> };
  const expectedSyncState = {
    account: manifest.account,
    safePreferences: manifest.safePreferences,
    recoveryAuthority: manifest.recoveryAuthority,
    snapshotMetadata: manifest.snapshotMetadata,
    incidentBoundary: manifest.incidentBoundary,
    remoteMutationPerformed: false,
  };
  if (coreManifest.exportedAt !== manifest.createdAt
    || stableRecoveryJson(syncState.state ?? null) !== stableRecoveryJson(expectedSyncState)) {
    errors.push('temporary_recovery_metadata_binding_mismatch');
  }
  if (manifest.deterministicGivenCreatedAt !== true || manifest.secretMaterialIncluded !== false
    || manifest.remoteMutationPerformed !== false) {
    errors.push('temporary_recovery_safety_claim_invalid');
  }
  const includedBlobPaths: string[] = [];
  for (const attachment of Array.isArray(manifest.attachments) ? manifest.attachments : []) {
    if (attachment.status === 'included') {
      if (!attachment.archivePath || !attachment.sha256 || checksums[attachment.archivePath] !== attachment.sha256) {
        errors.push(`temporary_recovery_attachment_binding_mismatch:${attachment.attachmentId}`);
      } else {
        includedBlobPaths.push(attachment.archivePath);
        const actual = actualFiles.get(attachment.archivePath);
        if (!actual || actual.bytes !== attachment.archivedSize) {
          errors.push(`temporary_recovery_attachment_size_mismatch:${attachment.attachmentId}`);
        }
      }
    } else if (attachment.archivePath !== null || attachment.sha256 !== null || attachment.archivedSize !== null) {
      errors.push(`temporary_recovery_missing_attachment_claim_mismatch:${attachment.attachmentId}`);
    }
  }
  const actualBlobPaths = relativeNames.filter(path => path.startsWith('attachments/blobs/')).sort();
  if (stableRecoveryJson([...new Set(includedBlobPaths)].sort()) !== stableRecoveryJson(actualBlobPaths)
    || includedBlobPaths.length !== new Set(includedBlobPaths).size) {
    errors.push('temporary_recovery_attachment_inventory_mismatch');
  }
  return {
    valid: errors.length === 0,
    verifiedFileCount,
    coreRecoveryValid: coreVerification.valid,
    manifest,
    errors,
  };
}

export async function buildTemporaryReturnToUseRecoveryArchive(
  input: TemporaryRtuRecoveryInput,
  sources: TemporaryRtuRecoverySources = {},
): Promise<TemporaryRtuRecoveryArchive> {
  if (!input.account.id.trim()) throw new Error('temporary_recovery_account_required');
  const createdAt = input.createdAt ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(createdAt))) throw new Error('temporary_recovery_created_at_invalid');
  const readHealth = sources.readHealth ?? defaultReadHealth;
  const listAttachments = sources.listAttachments ?? (() => createLocalAttachmentMetadataRepository().listAttachments());
  const readBlob = sources.readAttachmentBlob ?? (key => createLocalAttachmentBlobAdapter().getBlob(key).then(record => record?.blob ?? null));
  const listSnapshots = sources.listSnapshots ?? enumerateVaultSnapshots;
  const [health, metadata] = await Promise.all([readHealth(input.account.id), listAttachments()]);
  const references = new Map<string, Set<string>>();
  for (const note of input.notes) for (const id of findAttachmentReferencesInText(note.body ?? '')) {
    const owners = references.get(id) ?? new Set<string>();
    owners.add(note.id);
    references.set(id, owners);
  }
  const attachments = await resolveAttachmentState(metadata, references, readBlob);
  const snapshots = normalizedSnapshots(listSnapshots());
  const { core, relationshipCount } = await buildCorePackage(input, createdAt, health, attachments, snapshots);
  if (core.manifest.completeness !== 'complete' || core.manifest.conflictCount !== 0) {
    throw new Error('temporary_recovery_core_package_incomplete');
  }
  const healthCounts = Object.fromEntries(HEALTH_RECOVERY_DATASETS.map(name => [name, health.datasets[name].length])) as Record<HealthRecoveryDatasetName, number>;
  const result = await createArchive(core, {
    kind: TEMPORARY_RTU_RECOVERY_KIND,
    formatVersion: TEMPORARY_RTU_RECOVERY_VERSION,
    createdAt,
    deterministicGivenCreatedAt: true,
    account: { id: input.account.id, name: input.account.name },
    safePreferences: safePreferences(input.appSettings),
    incidentBoundary: TEMPORARY_RTU_INCIDENT_BOUNDARY,
    recoveryAuthority: health.importState,
    snapshotMetadata: snapshots,
    counts: {
      notesActive: input.notes.filter(note => !note.deletedAt).length,
      notesTombstones: input.notes.filter(note => Boolean(note.deletedAt)).length,
      folders: input.folders.length,
      noteRelationships: relationshipCount,
      health: healthCounts,
      healthTotal: HEALTH_RECOVERY_DATASETS.reduce((sum, name) => sum + healthCounts[name], 0),
      attachmentMetadata: attachments.manifestEntries.filter(item => item.metadataPresent).length,
      attachmentReferences: references.size,
      attachmentBlobsIncluded: attachments.manifestEntries.filter(item => item.status === 'included').length,
      attachmentBlobsMissing: attachments.manifestEntries.filter(item => item.status === 'missing' || item.status === 'unreadable').length,
    },
    attachments: attachments.manifestEntries,
    secretMaterialIncluded: false,
    remoteMutationPerformed: false,
  }, attachments.blobFiles);
  const verification = await verifyTemporaryReturnToUseRecoveryArchive(result.bytes);
  if (!verification.valid) throw new Error(`temporary_recovery_readback_failed:${verification.errors.join(',')}`);
  return { ...result, verification };
}

export async function downloadTemporaryReturnToUseRecoveryArchive(input: TemporaryRtuRecoveryInput): Promise<TemporaryRtuRecoveryArchive> {
  const result = await buildTemporaryReturnToUseRecoveryArchive(input);
  const blob = new Blob([result.bytes], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `absinthe-temporary-return-to-use-${result.manifest.createdAt.slice(0, 10)}.zip`;
    anchor.click();
  } finally {
    URL.revokeObjectURL(url);
  }
  return result;
}
