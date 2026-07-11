import type { VaultBackupManifest } from './exportVaultBackup';
import type { AttachmentMetadata, AttachmentRepository } from './attachmentRepository';
import type {
  RecoveryDatasetInput, RecoveryDatasetKey, RecoveryExportInput,
  RecoveryRecord, RecoverySourceProvenance,
} from './recoveryExportPackage';

const SENSITIVE = /bearer\s+|access[_-]?token|refresh[_-]?token|session[_-]?token|authorization|cookie|password|secret|eyJ[A-Za-z0-9_-]{8,}/i;

function safeLabel(value: string): string {
  if (SENSITIVE.test(value)) return 'redacted-source';
  const withoutQuery = value.split(/[?#]/, 1)[0].replace(/\\/g, '/');
  const parts = withoutQuery.split('/').filter(Boolean);
  const leaf = parts[parts.length - 1] ?? 'source';
  const clean = leaf.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 96);
  return clean || 'source';
}

export function sanitizeRecoveryProvenance(source: RecoverySourceProvenance): RecoverySourceProvenance {
  const result: RecoverySourceProvenance = { kind: source.kind, label: safeLabel(source.label) };
  if (source.capturedAt && Number.isFinite(Date.parse(source.capturedAt))) result.capturedAt = source.capturedAt;
  if (source.ownerScope) result.ownerScope = source.ownerScope;
  if (typeof source.schemaVersion === 'number' && Number.isFinite(source.schemaVersion)) result.schemaVersion = source.schemaVersion;
  if (source.sourceId && /^[A-Za-z0-9._:-]{1,96}$/.test(source.sourceId) && !SENSITIVE.test(source.sourceId)) {
    result.sourceId = source.sourceId;
  }
  return result;
}

function warningCode(value: string): string {
  if (SENSITIVE.test(value)) return 'redacted_warning';
  return value.toLowerCase().replace(/[^a-z0-9:_-]/g, '_').slice(0, 120) || 'unspecified_warning';
}

function asRecords(value: unknown): RecoveryRecord[] | null {
  if (!Array.isArray(value)) return null;
  const records: RecoveryRecord[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    records.push(item as RecoveryRecord);
  }
  return records;
}

function recordsDataset(
  records: readonly RecoveryRecord[], source: RecoverySourceProvenance, deletedField?: string | null,
  recordSources?: readonly RecoverySourceProvenance[],
): RecoveryDatasetInput {
  return {
    availability: records.length === 0 ? 'present_empty' : 'present_records',
    records, source: sanitizeRecoveryProvenance(source), deletedField,
    recordSources: recordSources?.map(sanitizeRecoveryProvenance),
  };
}

export function combineRecoveryDatasetSources(
  inputs: readonly RecoveryDatasetInput[],
  source: RecoverySourceProvenance,
  deletedField?: string | null,
): RecoveryDatasetInput {
  const records: RecoveryRecord[] = [];
  const recordSources: RecoverySourceProvenance[] = [];
  for (const input of inputs) {
    if (input.availability !== 'present_empty' && input.availability !== 'present_records') continue;
    for (const [index, record] of (input.records ?? []).entries()) {
      records.push(record);
      recordSources.push(input.recordSources?.[index] ?? input.source ?? source);
    }
  }
  return recordsDataset(records, source, deletedField, recordSources);
}

export function adaptSuppliedJsonArray(
  json: string,
  source: RecoverySourceProvenance,
  options: {
    deletedField?: string | null;
    sourceIdForRecord?: (record: RecoveryRecord) => string | undefined;
  } = {},
): RecoveryDatasetInput {
  let parsed: unknown;
  try { parsed = JSON.parse(json); }
  catch { return { availability: 'parse_failed', source: sanitizeRecoveryProvenance(source), warningCodes: ['invalid_json'] }; }
  const records = asRecords(parsed);
  if (!records) return { availability: 'unsupported', source: sanitizeRecoveryProvenance(source), warningCodes: ['expected_record_array'] };
  const recordSources = options.sourceIdForRecord
    ? records.map(record => ({ ...source, sourceId: options.sourceIdForRecord?.(record) }))
    : undefined;
  return recordsDataset(records, source, options.deletedField, recordSources);
}

export function readJsonArrayFromStorage(
  storage: Pick<Storage, 'getItem'>,
  key: string,
  source: RecoverySourceProvenance,
  options: {
    deletedField?: string | null;
    sourceIdForRecord?: (record: RecoveryRecord) => string | undefined;
  } = {},
): RecoveryDatasetInput {
  let raw: string | null;
  try { raw = storage.getItem(key); }
  catch { return { availability: 'permission_denied', source: sanitizeRecoveryProvenance(source), warningCodes: ['storage_read_denied'] }; }
  if (raw === null) return { availability: 'unavailable', source: sanitizeRecoveryProvenance(source), warningCodes: ['storage_key_unavailable'] };
  return adaptSuppliedJsonArray(raw, source, options);
}

function inbodyDateSourceId(record: RecoveryRecord): string | undefined {
  const date = record.date;
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return undefined;
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date ? `date:${date}` : undefined;
}

export function adaptInbodyJsonArray(
  json: string,
  source: RecoverySourceProvenance,
): RecoveryDatasetInput {
  return adaptSuppliedJsonArray(json, source, { sourceIdForRecord: inbodyDateSourceId });
}

export function readInbodyJsonArrayFromStorage(
  storage: Pick<Storage, 'getItem'>,
  key: string,
  source: RecoverySourceProvenance,
): RecoveryDatasetInput {
  return readJsonArrayFromStorage(storage, key, source, { sourceIdForRecord: inbodyDateSourceId });
}

export function readJsonValueFromStorage(
  storage: Pick<Storage, 'getItem'>, key: string, source: RecoverySourceProvenance,
): RecoveryDatasetInput {
  let raw: string | null;
  try { raw = storage.getItem(key); }
  catch { return { availability: 'permission_denied', source: sanitizeRecoveryProvenance(source), warningCodes: ['storage_read_denied'] }; }
  if (raw === null) return { availability: 'unavailable', source: sanitizeRecoveryProvenance(source), warningCodes: ['storage_key_unavailable'] };
  try { return recordsDataset([{ id: key, value: JSON.parse(raw) as unknown }], source, null); }
  catch { return { availability: 'parse_failed', source: sanitizeRecoveryProvenance(source), warningCodes: ['invalid_json'] }; }
}

export function readStoragePrefixForRecovery(
  storage: Pick<Storage, 'length' | 'key' | 'getItem'>,
  prefix: string,
  source: RecoverySourceProvenance,
): RecoveryDatasetInput {
  const records: RecoveryRecord[] = [];
  try {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (!key?.startsWith(prefix)) continue;
      const value = storage.getItem(key);
      if (value !== null) records.push({ id: key.slice(prefix.length), key, value });
    }
  } catch {
    return { availability: 'permission_denied', source: sanitizeRecoveryProvenance(source), warningCodes: ['storage_read_denied'] };
  }
  return recordsDataset(records, source, null);
}

function safeBlobKey(value: unknown): boolean {
  return typeof value !== 'string' || (
    !value.includes('..') && !value.includes('\\') && !value.startsWith('/') && !/^[A-Za-z]:/.test(value)
  );
}

function attachmentInventoryRecord(metadata: AttachmentMetadata): RecoveryRecord {
  const supplied = metadata as AttachmentMetadata & {
    localMissingConfirmed?: boolean; remoteMissingConfirmed?: boolean; blobMissingConfirmed?: boolean;
    localSourceProvided?: boolean; remoteSourceProvided?: boolean;
  };
  const localSafe = safeBlobKey(metadata.localBlobKey);
  const remoteSafe = safeBlobKey(metadata.remoteBlobKey);
  const localMissingConfirmed = supplied.localMissingConfirmed === true || metadata.remoteSyncStatus === 'missing_local';
  const localAvailability = metadata.localBlobKey ? (localSafe ? 'local_present' : 'unsafe')
    : localMissingConfirmed ? 'local_missing_confirmed'
      : supplied.localSourceProvided === false ? 'local_source_not_provided' : 'local_unknown';
  const remoteAvailability = metadata.remoteBlobKey || metadata.remoteFileId ? (remoteSafe ? 'remote_present' : 'unsafe')
    : supplied.remoteMissingConfirmed === true ? 'remote_missing_confirmed'
      : supplied.remoteSourceProvided === false ? 'remote_source_not_provided' : 'remote_unknown';
  const checksumStatus = metadata.remoteVerification?.checksumVerified === false ? 'checksum_mismatch'
    : metadata.checksum || metadata.remoteChecksum ? 'checksum_known' : 'checksum_unknown';
  const blobAvailability = metadata.localBlobKey || metadata.remoteBlobKey || metadata.remoteFileId ? 'blob_present'
    : supplied.blobMissingConfirmed === true ? 'blob_missing_confirmed' : 'blob_unknown';
  return {
    ...metadata,
    localMissingConfirmed: supplied.localMissingConfirmed ?? false,
    remoteMissingConfirmed: supplied.remoteMissingConfirmed ?? false,
    localAvailability,
    remoteAvailability,
    blobAvailability,
    checksumStatus,
  };
}

export async function readAttachmentInventoryForRecovery(
  repository: Pick<AttachmentRepository, 'listAttachments'>,
  source: RecoverySourceProvenance,
): Promise<RecoveryDatasetInput> {
  try {
    const records = (await repository.listAttachments()).map(attachmentInventoryRecord);
    return recordsDataset(records, source, 'deletedAt');
  } catch {
    return { availability: 'unavailable', source: sanitizeRecoveryProvenance(source), warningCodes: ['attachment_metadata_read_failed'] };
  }
}

export interface AttachmentReferenceInput {
  id: string;
  referencedBy: readonly string[];
  inventory?: RecoveryRecord | null;
  inventoryConfirmedAbsent?: boolean;
}

export function buildAttachmentReferenceDataset(
  references: readonly AttachmentReferenceInput[] | null,
  source: RecoverySourceProvenance,
): RecoveryDatasetInput {
  if (references === null) return { availability: 'source_not_provided', source: sanitizeRecoveryProvenance(source) };
  const byId = new Map<string, { referencedBy: Set<string>; inventory: RecoveryRecord | null; inventoryConfirmedAbsent: boolean }>();
  for (const reference of references) {
    const id = reference.id.trim();
    if (!id) continue;
    const current = byId.get(id) ?? { referencedBy: new Set<string>(), inventory: reference.inventory ?? null, inventoryConfirmedAbsent: reference.inventoryConfirmedAbsent === true };
    for (const owner of reference.referencedBy) if (owner.trim()) current.referencedBy.add(owner.trim());
    if (!current.inventory && reference.inventory) current.inventory = reference.inventory;
    if (reference.inventoryConfirmedAbsent === true) current.inventoryConfirmedAbsent = true;
    byId.set(id, current);
  }
  const records: RecoveryRecord[] = [...byId].sort(([a], [b]) => a.localeCompare(b)).map(([id, value]) => {
    const local = value.inventory?.localAvailability ?? 'local_source_not_provided';
    const remote = value.inventory?.remoteAvailability ?? 'remote_source_not_provided';
    const checksum = value.inventory?.checksumStatus ?? 'checksum_unknown';
    return {
      id, referencedBy: [...value.referencedBy].sort(), referenceOnly: value.inventory === null,
      localAvailability: local, remoteAvailability: remote,
      blobAvailability: value.inventory?.blobAvailability ?? 'blob_unknown',
      checksumStatus: checksum, orphanCandidate: value.inventory === null && value.inventoryConfirmedAbsent,
    };
  });
  return recordsDataset(records, source, null);
}

const BACKUP_KNOWN_KEYS = new Set([
  'schemaVersion', 'kind', 'exportedAt', 'app', 'appVersion', 'noteCount', 'folderCount',
  'relationCount', 'folders', 'notes', 'extensions', 'scope', 'contentFingerprint', 'cloud',
]);

export interface VaultBackupRecoveryAdapterResult {
  datasets: Partial<Record<RecoveryDatasetKey, RecoveryDatasetInput>>;
  syncState: RecoveryRecord;
  warningCodes: string[];
}

function keyValueRecords(value: unknown): RecoveryRecord[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  return Object.entries(value as Record<string, unknown>).map(([id, item]) => ({ id, value: item }));
}

export function adaptVaultBackupManifest(
  sourceValue: string | VaultBackupManifest,
  source: RecoverySourceProvenance,
): VaultBackupRecoveryAdapterResult {
  const parsed = typeof sourceValue === 'string' ? JSON.parse(sourceValue) as Record<string, unknown>
    : sourceValue as unknown as Record<string, unknown>;
  if (!parsed || typeof parsed !== 'object' || parsed.app !== 'absinthe' || typeof parsed.schemaVersion !== 'number') {
    throw new Error('unsupported_vault_backup_manifest');
  }
  if (typeof parsed.exportedAt !== 'string' || !Number.isFinite(Date.parse(parsed.exportedAt))) {
    throw new Error('invalid_vault_backup_exported_at');
  }
  const notes = asRecords(parsed.notes);
  const folders = asRecords(parsed.folders);
  if (!notes || !folders) throw new Error('invalid_vault_backup_manifest');
  const safeSource = sanitizeRecoveryProvenance({ ...source, schemaVersion: parsed.schemaVersion });
  const relationships = notes
    .filter(note => note.relations && typeof note.relations === 'object')
    .map(note => ({ id: note.id, relations: note.relations }));
  const attachmentInputs: AttachmentReferenceInput[] = [];
  const pattern = /attachment:\/\/([A-Za-z0-9][A-Za-z0-9._:-]{0,127})/g;
  for (const note of notes) {
    const markdown = typeof note.markdown === 'string' ? note.markdown : '';
    for (const match of markdown.matchAll(pattern)) attachmentInputs.push({ id: match[1], referencedBy: [String(note.id ?? '')] });
  }
  const extensions = parsed.extensions && typeof parsed.extensions === 'object'
    ? parsed.extensions as Record<string, unknown> : null;
  const health = extensions?.health && typeof extensions.health === 'object'
    ? extensions.health as Record<string, unknown> : null;
  const unknown = Object.keys(parsed).filter(key => !BACKUP_KNOWN_KEYS.has(key)).sort();
  const absent = ['extensions', 'scope', 'cloud'].filter(key => !(key in parsed));
  const warningCodes = [
    ...unknown.map(key => `unsupported_top_level_section:${warningCode(key)}`),
    ...absent.map(key => `known_section_absent:${key}`),
  ].sort();
  const cloud = parsed.cloud && typeof parsed.cloud === 'object' ? parsed.cloud as Record<string, unknown> : null;
  const datasets: Partial<Record<RecoveryDatasetKey, RecoveryDatasetInput>> = {
    notes: recordsDataset(notes, safeSource, 'deletedAt'),
    noteFolders: recordsDataset(folders, safeSource, null),
    noteRelationships: recordsDataset(relationships, safeSource, null),
    attachmentReferences: buildAttachmentReferenceDataset(attachmentInputs, safeSource),
  };
  if (extensions) datasets.healthPreferences = recordsDataset([{ id: 'vault-extensions', value: extensions }], safeSource, null);
  if (health?.drafts) datasets.healthLocalDrafts = recordsDataset(keyValueRecords(health.drafts), safeSource, null);
  if (health?.memos) datasets.healthLocalMemos = recordsDataset(keyValueRecords(health.memos), safeSource, null);
  return {
    datasets,
    syncState: {
      backupScope: parsed.scope ?? null,
      backupCloudMetadata: cloud ? {
        schemaVersion: cloud.schemaVersion ?? null,
        fetchedAt: cloud.fetchedAt ?? null,
        completeness: cloud.completeness ?? null,
        errorCount: Array.isArray(cloud.errors) ? cloud.errors.length : 0,
      } : null,
      unknownSections: unknown.map(warningCode), knownAbsentSections: absent,
    },
    warningCodes,
  };
}

export function applyAdapterResult(
  input: Omit<RecoveryExportInput, 'datasets' | 'syncState' | 'warningCodes'>,
  result: VaultBackupRecoveryAdapterResult,
): RecoveryExportInput {
  return { ...input, datasets: result.datasets, syncState: result.syncState, warningCodes: result.warningCodes };
}
