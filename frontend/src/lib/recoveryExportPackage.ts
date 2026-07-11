import JSZip from 'jszip';

export const RECOVERY_EXPORT_SCHEMA_VERSION = 2 as const;
export const RECOVERY_EXPORT_KIND = 'absinthe-recovery-export' as const;

export type RecoverySourceKind = 'local' | 'remote' | 'supplied_export' | 'snapshot' | 'backup';
export type RecoveryAvailability =
  | 'source_not_provided'
  | 'present_empty'
  | 'present_records'
  | 'absent_confirmed'
  | 'unavailable'
  | 'unsupported'
  | 'parse_failed'
  | 'permission_denied';
export type RecoveryCompleteness = 'complete' | 'complete_for_supplied_sources' | 'partial' | 'invalid';
export type RecoveryRecord = Readonly<Record<string, unknown>>;

export interface RecoverySourceProvenance {
  kind: RecoverySourceKind;
  label: string;
  capturedAt?: string;
  ownerScope?: 'confirmed' | 'unconfirmed' | 'not_applicable';
  schemaVersion?: number;
  sourceId?: string;
}

export interface RecoveryDatasetInput {
  availability: RecoveryAvailability;
  records?: readonly RecoveryRecord[];
  recordSources?: readonly RecoverySourceProvenance[];
  source?: RecoverySourceProvenance;
  deletedField?: string | null;
  warningCodes?: readonly string[];
}

export type RecoveryDatasetKey =
  | 'notes' | 'noteFolders' | 'noteRelationships'
  | 'workoutLogs' | 'inbodyLogs' | 'exerciseBlocks' | 'healthRoutines'
  | 'proteinProfiles' | 'proteinSources' | 'proteinIntakeLogs'
  | 'healthLocalDrafts' | 'healthLocalMemos' | 'healthPreferences'
  | 'recipes' | 'recipeLocalMetadata' | 'schedules' | 'todos'
  | 'attachmentInventory' | 'attachmentReferences';

export interface RecoveryExportInput {
  exportedAt: string;
  datasets?: Partial<Record<RecoveryDatasetKey, RecoveryDatasetInput>>;
  syncState?: RecoveryRecord | null;
  warningCodes?: readonly string[];
  requiredDatasets?: readonly RecoveryDatasetKey[];
}

export interface RecoveryDiagnostic {
  code: string;
  domain: RecoveryDatasetKey | 'package';
  path: string;
  recordId?: string;
  fieldPath?: string;
  count?: number;
}

export interface RecoveryDatasetManifestEntry {
  key: RecoveryDatasetKey;
  path: string;
  availability: RecoveryAvailability;
  totalCount: number | null;
  activeCount: number | null;
  tombstoneCount: number | null;
  sha256: string;
  source: RecoverySourceProvenance | null;
}

export interface RecoveryExportManifest {
  schemaVersion: typeof RECOVERY_EXPORT_SCHEMA_VERSION;
  kind: typeof RECOVERY_EXPORT_KIND;
  exportedAt: string;
  deterministic: true;
  authoritativeReconciliationPerformed: false;
  completeness: RecoveryCompleteness;
  requiredDatasets: RecoveryDatasetKey[];
  datasets: RecoveryDatasetManifestEntry[];
  fileCount: number;
  warningCount: number;
  conflictCount: number;
}

export interface RecoveryExportPackage {
  manifest: RecoveryExportManifest;
  files: Readonly<Record<string, string>>;
  checksums: Readonly<Record<string, string>>;
}

export interface RecoveryVerificationResult {
  valid: boolean;
  completeness: RecoveryCompleteness;
  verifiedFiles: string[];
  errors: RecoveryDiagnostic[];
  warnings: RecoveryDiagnostic[];
  conflictDiagnostics: RecoveryDiagnostic[];
}

interface DatasetDescriptor { key: RecoveryDatasetKey; path: string; partition?: 'active' | 'tombstones' }

export const RECOVERY_DATASET_DESCRIPTORS: readonly DatasetDescriptor[] = [
  { key: 'notes', path: 'notes/active.json', partition: 'active' },
  { key: 'notes', path: 'notes/tombstones.json', partition: 'tombstones' },
  { key: 'noteFolders', path: 'notes/folders.json' },
  { key: 'noteRelationships', path: 'notes/relationships.json' },
  { key: 'workoutLogs', path: 'health/workout_logs.json' },
  { key: 'inbodyLogs', path: 'health/inbody_logs.json' },
  { key: 'exerciseBlocks', path: 'health/exercise_blocks.json' },
  { key: 'healthRoutines', path: 'health/health_routines.json' },
  { key: 'proteinProfiles', path: 'health/protein_profiles.json' },
  { key: 'proteinSources', path: 'health/protein_sources.json' },
  { key: 'proteinIntakeLogs', path: 'health/protein_intake_logs.json' },
  { key: 'healthLocalDrafts', path: 'health/local_drafts.json' },
  { key: 'healthLocalMemos', path: 'health/local_memos.json' },
  { key: 'healthPreferences', path: 'health/preferences.json' },
  { key: 'recipes', path: 'recipes/recipes.json' },
  { key: 'recipeLocalMetadata', path: 'recipes/local_metadata.json' },
  { key: 'schedules', path: 'planning/schedules.json' },
  { key: 'todos', path: 'planning/todos.json' },
  { key: 'attachmentInventory', path: 'attachments/inventory.json' },
  { key: 'attachmentReferences', path: 'attachments/references.json' },
] as const;

const METADATA_PATHS = [
  'metadata/source-inventory.json', 'metadata/sync-state.json',
  'metadata/warnings.json', 'metadata/conflicts.json',
] as const;
const EXPECTED_PATHS = new Set([
  ...RECOVERY_DATASET_DESCRIPTORS.map(item => item.path), ...METADATA_PATHS,
  'manifest.json', 'checksums.sha256',
]);
const PRESENT = new Set<RecoveryAvailability>(['present_empty', 'present_records']);
const NON_DATA = new Set<RecoveryAvailability>([
  'source_not_provided', 'absent_confirmed', 'unavailable', 'unsupported', 'parse_failed', 'permission_denied',
]);
const PARTIAL = new Set<RecoveryAvailability>(['unavailable', 'unsupported', 'parse_failed', 'permission_denied']);
const SENSITIVE_METADATA = /bearer\s+|access[_-]?token|refresh[_-]?token|session[_-]?token|authorization|cookie|password|secret|eyJ[A-Za-z0-9_-]{8,}/i;

function sanitizedCode(value: string): string {
  if (SENSITIVE_METADATA.test(value)) return 'redacted_warning';
  return value.toLowerCase().replace(/[^a-z0-9:_-]/g, '_').slice(0, 120) || 'unspecified_warning';
}

function sanitizedSource(source: RecoverySourceProvenance | undefined): RecoverySourceProvenance | null {
  if (!source) return null;
  const raw = SENSITIVE_METADATA.test(source.label) ? 'redacted-source' : source.label.split(/[?#]/, 1)[0].replace(/\\/g, '/');
  const parts = raw.split('/').filter(Boolean);
  const label = (parts[parts.length - 1] ?? 'source').replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 96) || 'source';
  const result: RecoverySourceProvenance = { kind: source.kind, label };
  if (source.capturedAt && Number.isFinite(Date.parse(source.capturedAt))) result.capturedAt = source.capturedAt;
  if (source.ownerScope) result.ownerScope = source.ownerScope;
  if (typeof source.schemaVersion === 'number' && Number.isFinite(source.schemaVersion)) result.schemaVersion = source.schemaVersion;
  if (source.sourceId && /^[A-Za-z0-9._:-]{1,96}$/.test(source.sourceId) && !SENSITIVE_METADATA.test(source.sourceId)) result.sourceId = source.sourceId;
  return result;
}

function sanitizedMetadata(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizedMetadata);
  if (!value || typeof value !== 'object') {
    return typeof value === 'string' && SENSITIVE_METADATA.test(value) ? '[redacted]' : value;
  }
  const out = Object.create(null) as Record<string, unknown>;
  for (const key of Object.keys(value as Record<string, unknown>)) {
    out[key] = SENSITIVE_METADATA.test(key) ? '[redacted]' : sanitizedMetadata((value as Record<string, unknown>)[key]);
  }
  return out;
}

export class RecoveryCanonicalizationError extends Error {
  constructor(readonly code: string, readonly fieldPath: string) {
    super(`${code}:${fieldPath}`);
    this.name = 'RecoveryCanonicalizationError';
  }
}

function canonicalize(value: unknown, path = '$', seen = new WeakSet<object>()): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new RecoveryCanonicalizationError('unsupported_non_finite_number', path);
    return value;
  }
  if (value === undefined) throw new RecoveryCanonicalizationError('unsupported_undefined', path);
  if (typeof value === 'bigint') throw new RecoveryCanonicalizationError('unsupported_bigint', path);
  if (typeof value === 'symbol') throw new RecoveryCanonicalizationError('unsupported_symbol', path);
  if (typeof value === 'function') throw new RecoveryCanonicalizationError('unsupported_function', path);
  if (seen.has(value as object)) throw new RecoveryCanonicalizationError('unsupported_cycle', path);
  const prototype = Object.getPrototypeOf(value as object);
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) {
    throw new RecoveryCanonicalizationError('unsupported_object_type', path);
  }
  seen.add(value as object);
  try {
    if (Array.isArray(value)) return value.map((item, index) => canonicalize(item, `${path}[${index}]`, seen));
    const symbols = Object.getOwnPropertySymbols(value as object).filter(symbol =>
      Object.prototype.propertyIsEnumerable.call(value, symbol));
    if (symbols.length > 0) throw new RecoveryCanonicalizationError('unsupported_symbol_key', path);
    const out = Object.create(null) as Record<string, unknown>;
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      Object.defineProperty(out, key, {
        value: canonicalize((value as Record<string, unknown>)[key], `${path}.${key}`, seen),
        enumerable: true, configurable: false, writable: false,
      });
    }
    return out;
  } finally {
    seen.delete(value as object);
  }
}

export function stableRecoveryJson(value: unknown): string {
  return `${JSON.stringify(canonicalize(value), null, 2)}\n`;
}

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

function sourceRef(source: RecoverySourceProvenance | null): string {
  if (!source) return 'source:unspecified';
  return [source.kind, source.label, source.sourceId ?? 'default'].join(':');
}

function sortRecords(
  records: readonly RecoveryRecord[],
  sources: readonly RecoverySourceProvenance[] | undefined,
  fallbackSource: RecoverySourceProvenance | null,
): Array<{ record: RecoveryRecord; sourceRef: string }> {
  if (sources && sources.length !== records.length) throw new Error('record_source_count_mismatch');
  return records.map((record, index) => ({
    record: canonicalize(record) as RecoveryRecord,
    sourceRef: sourceRef(sanitizedSource(sources?.[index] ?? fallbackSource ?? undefined)),
  })).sort((a, b) => {
    const ai = typeof a.record.id === 'string' ? a.record.id : '';
    const bi = typeof b.record.id === 'string' ? b.record.id : '';
    return `${ai}\0${JSON.stringify(a.record)}\0${a.sourceRef}`.localeCompare(`${bi}\0${JSON.stringify(b.record)}\0${b.sourceRef}`);
  });
}

function validRecordsForAvailability(input: RecoveryDatasetInput): readonly RecoveryRecord[] | null {
  if (PRESENT.has(input.availability)) {
    if (!Array.isArray(input.records)) throw new Error(`availability_requires_records:${input.availability}`);
    if (input.availability === 'present_empty' && input.records.length !== 0) throw new Error('present_empty_requires_zero_records');
    if (input.availability === 'present_records' && input.records.length === 0) throw new Error('present_records_requires_records');
    return input.records;
  }
  if (input.records !== undefined) throw new Error(`availability_forbids_records:${input.availability}`);
  return null;
}

interface NormalizedDataset {
  availability: RecoveryAvailability;
  source: RecoverySourceProvenance | null;
  active: RecoveryRecord[] | null;
  tombstones: RecoveryRecord[] | null;
  activeSourceRefs: string[] | null;
  tombstoneSourceRefs: string[] | null;
  warningCodes: string[];
}

function normalizeDataset(input: RecoveryDatasetInput | undefined): NormalizedDataset {
  const resolved = input ?? { availability: 'source_not_provided' as const };
  const records = validRecordsForAvailability(resolved);
  if (records === null) return {
    availability: resolved.availability, source: sanitizedSource(resolved.source),
    active: null, tombstones: null, warningCodes: [...(resolved.warningCodes ?? [])].map(sanitizedCode).sort(),
    activeSourceRefs: null, tombstoneSourceRefs: null,
  };
  const deletedField = resolved.deletedField === undefined ? 'deleted_at' : resolved.deletedField;
  const source = sanitizedSource(resolved.source);
  const sorted = sortRecords(records, resolved.recordSources, source);
  const deleted = (record: RecoveryRecord) => deletedField !== null
    && record[deletedField] !== null && record[deletedField] !== undefined && record[deletedField] !== '';
  const active = sorted.filter(item => !deleted(item.record));
  const tombstones = sorted.filter(item => deleted(item.record));
  return {
    availability: resolved.availability, source,
    active: active.map(item => item.record), tombstones: tombstones.map(item => item.record),
    activeSourceRefs: active.map(item => item.sourceRef), tombstoneSourceRefs: tombstones.map(item => item.sourceRef),
    warningCodes: [...(resolved.warningCodes ?? [])].map(sanitizedCode).sort(),
  };
}

export function deriveRecoveryCompleteness(
  availabilityByKey: ReadonlyMap<RecoveryDatasetKey, RecoveryAvailability>,
  requiredDatasets: readonly RecoveryDatasetKey[],
  invalid = false,
): RecoveryCompleteness {
  if (invalid) return 'invalid';
  if ([...availabilityByKey.values()].some(status => PARTIAL.has(status))) return 'partial';
  const requiredComplete = requiredDatasets.every(key => {
    const status = availabilityByKey.get(key) ?? 'source_not_provided';
    return PRESENT.has(status) || status === 'absent_confirmed';
  });
  if (requiredComplete && requiredDatasets.length > 0) return 'complete';
  return 'complete_for_supplied_sources';
}

function safeId(value: unknown): string | undefined {
  return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value) ? value : undefined;
}

function diagSort(items: RecoveryDiagnostic[]): RecoveryDiagnostic[] {
  return items.sort((a, b) => stableRecoveryJson(a).localeCompare(stableRecoveryJson(b)));
}

function minimumRecordIssue(key: RecoveryDatasetKey, record: RecoveryRecord): string | null {
  if (!safeId(record.id)) return null;
  if ('user_id' in record && typeof record.user_id !== 'string') return 'user_id';
  for (const field of ['deleted_at', 'deletedAt']) if (field in record) {
    const value = record[field];
    if (value !== null && typeof value !== 'string' && typeof value !== 'number') return field;
  }
  switch (key) {
    case 'notes': return typeof record.body === 'string' || typeof record.markdown === 'string' ? null : 'body_or_markdown';
    case 'noteFolders': return typeof record.name === 'string' ? null : 'name';
    case 'noteRelationships': return record.relations && typeof record.relations === 'object' && !Array.isArray(record.relations) ? null : 'relations';
    case 'recipes': return typeof record.name === 'string' || typeof record.title === 'string' ? null : 'name_or_title';
    case 'schedules': return typeof record.start_time === 'string' && typeof record.end_time === 'string' ? null : 'start_time_or_end_time';
    case 'todos': return typeof record.done === 'boolean' ? null : 'done';
    case 'workoutLogs': return typeof record.block_id === 'string' || Array.isArray(record.sets) ? null : 'block_id_or_sets';
    case 'inbodyLogs': return ['weight', 'smm', 'pbf'].some(field => typeof record[field] === 'number') ? null : 'measurement';
    case 'exerciseBlocks': return typeof record.name === 'string' && typeof record.type === 'string' ? null : 'name_or_type';
    case 'healthRoutines': return typeof record.day_name === 'string' && Array.isArray(record.blocks) ? null : 'day_name_or_blocks';
    case 'proteinProfiles': return typeof record.daily_target_g === 'number' || typeof record.goal === 'string' ? null : 'profile_field';
    case 'proteinSources': return typeof record.name === 'string' ? null : 'name';
    case 'proteinIntakeLogs': return typeof record.protein_g === 'number' ? null : 'protein_g';
    case 'attachmentInventory': return typeof record.fileName === 'string' && typeof record.mimeType === 'string' ? null : 'file_name_or_mime_type';
    case 'attachmentReferences': return Array.isArray(record.referencedBy) && record.referencedBy.every(value => typeof value === 'string') ? null : 'referencedBy';
    case 'healthLocalDrafts': case 'healthLocalMemos': case 'healthPreferences': case 'recipeLocalMetadata': return null;
    default: return 'unsupported_schema_detail';
  }
}

function analyzeConflicts(datasets: Map<RecoveryDatasetKey, NormalizedDataset>): RecoveryDiagnostic[] {
  const out: RecoveryDiagnostic[] = [];
  const idsByKey = new Map<RecoveryDatasetKey, Set<string>>();
  for (const [key, dataset] of datasets) {
    if (!dataset.active || !dataset.tombstones) continue;
    const all = [...dataset.active, ...dataset.tombstones];
    const ids = new Set<string>();
    const occurrences = new Map<string, Array<{ record: RecoveryRecord; sourceRef: string }>>();
    const owners = new Set<string>();
    const sourceRefs = [...(dataset.activeSourceRefs ?? []), ...(dataset.tombstoneSourceRefs ?? [])];
    for (const [index, record] of all.entries()) {
      const id = safeId(record.id);
      if (!id) out.push({ code: 'missing_or_invalid_id', domain: key, path: key, fieldPath: 'id' });
      else {
        ids.add(id);
        const values = occurrences.get(id) ?? [];
        values.push({ record, sourceRef: sourceRefs[index] ?? 'source:unspecified' });
        occurrences.set(id, values);
      }
      const malformed = minimumRecordIssue(key, record);
      if (malformed) out.push({ code: malformed === 'unsupported_schema_detail' ? malformed : 'malformed_record', domain: key, path: key, recordId: id, fieldPath: malformed });
      if (typeof record.user_id === 'string' && record.user_id) owners.add(record.user_id);
      for (const [field, value] of Object.entries(record)) {
        if ((field.endsWith('_at') || field.endsWith('At')) && value != null
          && typeof value === 'string' && !Number.isFinite(Date.parse(value))) {
          out.push({ code: 'invalid_timestamp', domain: key, path: key, recordId: id, fieldPath: field });
        }
      }
    }
    for (const [id, values] of occurrences) if (values.length > 1) {
      const sources = new Set(values.map(value => value.sourceRef));
      if (sources.size === 1) out.push({ code: 'duplicate_id_within_source', domain: key, path: key, recordId: id, count: values.length });
      else {
        const content = new Set(values.map(value => stableRecoveryJson(value.record)));
        out.push({ code: content.size === 1 ? 'cross_source_duplicate_id' : 'cross_source_record_conflict', domain: key, path: key, recordId: id, count: sources.size });
      }
    }
    const activeIds = new Set(dataset.active.map(record => safeId(record.id)).filter(Boolean) as string[]);
    for (const record of dataset.tombstones) {
      const id = safeId(record.id);
      if (id && activeIds.has(id)) out.push({ code: 'active_tombstone_collision', domain: key, path: key, recordId: id });
    }
    if (owners.size > 1) out.push({ code: 'conflicting_owner_ids', domain: key, path: key, count: owners.size });
    idsByKey.set(key, ids);
  }
  const notes = datasets.get('notes');
  const folders = idsByKey.get('noteFolders') ?? new Set<string>();
  if (notes?.active && notes.tombstones) {
    const referencedFolders = new Set<string>();
    for (const note of [...notes.active, ...notes.tombstones]) {
      const folder = typeof note.folderId === 'string' ? note.folderId
        : typeof note.folder_id === 'string' ? note.folder_id : null;
      if (folder) {
        referencedFolders.add(folder);
        if (!folders.has(folder)) out.push({ code: 'missing_folder_target', domain: 'notes', path: 'notes', recordId: safeId(note.id), fieldPath: 'folderId' });
      }
    }
  }
  const folderData = datasets.get('noteFolders');
  if (folderData?.active) {
    const parents = new Map<string, string>();
    for (const folder of folderData.active) {
      const id = safeId(folder.id);
      const parent = typeof folder.parentId === 'string' ? folder.parentId : typeof folder.parent_id === 'string' ? folder.parent_id : null;
      if (!id || !parent) continue;
      if (id === parent) out.push({ code: 'folder_self_reference', domain: 'noteFolders', path: 'notes/folders.json', recordId: id, fieldPath: 'parentId' });
      else if (!folders.has(parent)) out.push({ code: 'missing_folder_parent', domain: 'noteFolders', path: 'notes/folders.json', recordId: id, fieldPath: 'parentId' });
      else parents.set(id, parent);
    }
    for (const id of parents.keys()) {
      const visited = new Set<string>();
      let current: string | undefined = id;
      while (current && parents.has(current)) {
        if (visited.has(current)) { out.push({ code: 'folder_parent_cycle', domain: 'noteFolders', path: 'notes/folders.json', recordId: id, fieldPath: 'parentId' }); break; }
        visited.add(current); current = parents.get(current);
      }
    }
  }
  const inventory = idsByKey.get('attachmentInventory') ?? new Set<string>();
  const noteIds = idsByKey.get('notes') ?? new Set<string>();
  const inventoryData = datasets.get('attachmentInventory');
  if (inventoryData?.active) for (const record of inventoryData.active) {
    if (record.localAvailability === 'unsafe' || record.remoteAvailability === 'unsafe') {
      out.push({ code: 'unsafe_attachment_path', domain: 'attachmentInventory', path: 'attachments/inventory.json', recordId: safeId(record.id) });
    }
    if (record.localAvailability === 'local_present' && record.localMissingConfirmed === true
      || record.localAvailability === 'local_missing_confirmed' && typeof record.localBlobKey === 'string') {
      out.push({ code: 'contradictory_local_attachment_state', domain: 'attachmentInventory', path: 'attachments/inventory.json', recordId: safeId(record.id) });
    }
    if (record.remoteAvailability === 'remote_present' && record.remoteMissingConfirmed === true
      || record.remoteAvailability === 'remote_missing_confirmed' && (typeof record.remoteBlobKey === 'string' || typeof record.remoteFileId === 'string')) {
      out.push({ code: 'contradictory_remote_attachment_state', domain: 'attachmentInventory', path: 'attachments/inventory.json', recordId: safeId(record.id) });
    }
    if (record.checksumStatus === 'checksum_mismatch' && !(typeof record.checksum === 'string' && typeof record.remoteChecksum === 'string')) {
      out.push({ code: 'incomplete_checksum_mismatch_evidence', domain: 'attachmentInventory', path: 'attachments/inventory.json', recordId: safeId(record.id) });
    }
    if (record.blobAvailability === 'blob_present' && record.blobMissingConfirmed === true
      || record.blobAvailability === 'blob_missing_confirmed' && (typeof record.localBlobKey === 'string' || typeof record.remoteBlobKey === 'string' || typeof record.remoteFileId === 'string')) {
      out.push({ code: 'contradictory_blob_attachment_state', domain: 'attachmentInventory', path: 'attachments/inventory.json', recordId: safeId(record.id) });
    }
  }
  const references = datasets.get('attachmentReferences');
  if (references?.active) {
    for (const record of references.active) {
      const id = safeId(record.id);
      if (Array.isArray(record.referencedBy)) {
        const values = record.referencedBy.filter(item => typeof item === 'string') as string[];
        if (new Set(values).size !== values.length) out.push({ code: 'duplicate_attachment_reference', domain: 'attachmentReferences', path: 'attachments/references.json', recordId: id });
        const notesAvailable = notes?.availability === 'present_empty' || notes?.availability === 'present_records' || notes?.availability === 'absent_confirmed';
        if (notesAvailable) for (const target of values) if (!noteIds.has(target)) {
          out.push({ code: 'missing_attachment_reference_target', domain: 'attachmentReferences', path: 'attachments/references.json', recordId: id, fieldPath: 'referencedBy' });
        }
      }
      if (id && !inventory.has(id) && record.orphanCandidate === true) {
        out.push({ code: 'missing_attachment_target', domain: 'attachmentReferences', path: 'attachments/references.json', recordId: id });
      }
    }
  }
  const relationships = datasets.get('noteRelationships');
  if (relationships?.active) for (const record of relationships.active) {
    const relations = record.relations;
    if (!relations || typeof relations !== 'object' || Array.isArray(relations)) continue;
    for (const [field, targets] of Object.entries(relations as Record<string, unknown>)) {
      if (!Array.isArray(targets)) continue;
      for (const target of targets) if (typeof target === 'string' && !noteIds.has(target)) {
        out.push({ code: 'missing_relationship_target', domain: 'noteRelationships', path: 'notes/relationships.json', recordId: safeId(record.id), fieldPath: field });
      }
    }
  }
  return diagSort(out);
}

function analyzeWarnings(datasets: Map<RecoveryDatasetKey, NormalizedDataset>): RecoveryDiagnostic[] {
  const notes = datasets.get('notes');
  const references = datasets.get('attachmentReferences');
  if (!references?.active?.length || notes?.availability === 'present_empty' || notes?.availability === 'present_records' || notes?.availability === 'absent_confirmed') return [];
  return [{ code: 'attachment_reference_unresolved_due_to_unavailable_notes', domain: 'attachmentReferences', path: 'attachments/references.json', count: references.active.length }];
}

function payloadFor(descriptor: DatasetDescriptor, data: NormalizedDataset): Record<string, unknown> {
  const common = {
    schemaVersion: RECOVERY_EXPORT_SCHEMA_VERSION, dataset: descriptor.key,
    availability: data.availability, source: data.source, warningCodes: data.warningCodes,
  };
  if (descriptor.partition) {
    const records = descriptor.partition === 'active' ? data.active : data.tombstones;
    const recordSourceRefs = descriptor.partition === 'active' ? data.activeSourceRefs : data.tombstoneSourceRefs;
    return { ...common, partition: descriptor.partition, recordCount: records?.length ?? null, records, recordSourceRefs };
  }
  return {
    ...common,
    counts: data.active === null ? null : {
      total: data.active.length + (data.tombstones?.length ?? 0),
      active: data.active.length, tombstones: data.tombstones?.length ?? 0,
    },
    activeRecords: data.active, tombstoneRecords: data.tombstones,
    activeSourceRefs: data.activeSourceRefs, tombstoneSourceRefs: data.tombstoneSourceRefs,
  };
}

function checksumLines(checksums: Readonly<Record<string, string>>): string {
  return `${Object.entries(checksums).sort(([a], [b]) => a.localeCompare(b))
    .map(([path, checksum]) => `${checksum}  ${path}`).join('\n')}\n`;
}

export async function buildRecoveryExportPackage(input: RecoveryExportInput): Promise<RecoveryExportPackage> {
  if (!Number.isFinite(Date.parse(input.exportedAt))) throw new Error('invalid_exported_at');
  const normalized = new Map<RecoveryDatasetKey, NormalizedDataset>();
  const availability = new Map<RecoveryDatasetKey, RecoveryAvailability>();
  for (const descriptor of RECOVERY_DATASET_DESCRIPTORS) if (!normalized.has(descriptor.key)) {
    const value = normalizeDataset(input.datasets?.[descriptor.key]);
    normalized.set(descriptor.key, value); availability.set(descriptor.key, value.availability);
  }
  const required = [...new Set(input.requiredDatasets ?? [])].sort();
  const conflicts = analyzeConflicts(normalized);
  const semanticWarnings = analyzeWarnings(normalized);
  const completeness = deriveRecoveryCompleteness(availability, required, conflicts.length > 0);
  const warningCodes = new Set((input.warningCodes ?? []).map(sanitizedCode));
  for (const [key, value] of normalized) for (const code of value.warningCodes) warningCodes.add(`${key}:${code}`);
  for (const warning of semanticWarnings) warningCodes.add(warning.code);
  const files: Record<string, string> = {};
  const checksums: Record<string, string> = {};
  const entries: RecoveryDatasetManifestEntry[] = [];
  const inventory: Array<Record<string, unknown>> = [];
  for (const descriptor of RECOVERY_DATASET_DESCRIPTORS) {
    const data = normalized.get(descriptor.key)!;
    const payload = payloadFor(descriptor, data);
    files[descriptor.path] = stableRecoveryJson(payload);
    checksums[descriptor.path] = await sha256(files[descriptor.path]);
    const active = data.active?.length ?? null;
    const tombstones = data.tombstones?.length ?? null;
    const total = descriptor.partition === 'active' ? active : descriptor.partition === 'tombstones' ? tombstones
      : active === null ? null : active + (tombstones ?? 0);
    const entry = {
      key: descriptor.key, path: descriptor.path, availability: data.availability,
      totalCount: total,
      activeCount: descriptor.partition === 'tombstones' ? 0 : active,
      tombstoneCount: descriptor.partition === 'active' ? 0 : tombstones,
      sha256: checksums[descriptor.path], source: data.source,
    } satisfies RecoveryDatasetManifestEntry;
    entries.push(entry);
    inventory.push({ key: entry.key, path: entry.path, availability: entry.availability,
      totalCount: entry.totalCount, activeCount: entry.activeCount, tombstoneCount: entry.tombstoneCount,
      source: entry.source });
  }
  files['metadata/source-inventory.json'] = stableRecoveryJson({ schemaVersion: 2, datasets: inventory });
  files['metadata/sync-state.json'] = stableRecoveryJson({ schemaVersion: 2, informationalOnly: true, state: sanitizedMetadata(input.syncState ?? null) });
  files['metadata/warnings.json'] = stableRecoveryJson({ schemaVersion: 2, warningCodes: [...warningCodes].sort() });
  files['metadata/conflicts.json'] = stableRecoveryJson({ schemaVersion: 2, diagnostics: conflicts });
  for (const path of METADATA_PATHS) checksums[path] = await sha256(files[path]);
  const manifest: RecoveryExportManifest = {
    schemaVersion: 2, kind: RECOVERY_EXPORT_KIND, exportedAt: input.exportedAt,
    deterministic: true, authoritativeReconciliationPerformed: false,
    completeness, requiredDatasets: required, datasets: entries,
    fileCount: Object.keys(files).length + 2, warningCount: warningCodes.size, conflictCount: conflicts.length,
  };
  files['manifest.json'] = stableRecoveryJson(manifest);
  checksums['manifest.json'] = await sha256(files['manifest.json']);
  files['checksums.sha256'] = checksumLines(checksums);
  return { manifest, files: Object.freeze({ ...files }), checksums: Object.freeze({ ...checksums }) };
}

function safePackagePath(path: string): boolean {
  return path.length > 0 && !path.includes('\\') && !path.startsWith('/') && !/^[A-Za-z]:/.test(path)
    && path.split('/').every(part => part !== '' && part !== '.' && part !== '..');
}

function parseChecksumFile(text: string, errors: RecoveryDiagnostic[]): Record<string, string> {
  const out: Record<string, string> = Object.create(null);
  for (const line of text.split('\n').filter(Boolean)) {
    const match = /^([a-f0-9]{64})  (.+)$/.exec(line);
    if (!match) { errors.push({ code: 'invalid_checksum_line', domain: 'package', path: 'checksums.sha256' }); continue; }
    const [, sum, path] = match;
    if (!safePackagePath(path)) errors.push({ code: 'unsafe_path', domain: 'package', path: 'checksums.sha256' });
    if (out[path]) errors.push({ code: 'duplicate_checksum_entry', domain: 'package', path });
    out[path] = sum;
  }
  return out;
}

function parsedDataset(
  descriptor: DatasetDescriptor, value: Record<string, unknown>, errors: RecoveryDiagnostic[],
): NormalizedDataset {
  const status = value.availability as RecoveryAvailability;
  const validStatus: RecoveryAvailability[] = [
    'source_not_provided', 'present_empty', 'present_records', 'absent_confirmed',
    'unavailable', 'unsupported', 'parse_failed', 'permission_denied',
  ];
  if (!validStatus.includes(status)) errors.push({ code: 'invalid_availability', domain: descriptor.key, path: descriptor.path });
  const partitionRecords = descriptor.partition ? value.records : null;
  const partitionSourceRefs = descriptor.partition ? value.recordSourceRefs : null;
  const active = descriptor.partition === 'active' ? partitionRecords : descriptor.partition ? null : value.activeRecords;
  const tombstones = descriptor.partition === 'tombstones' ? partitionRecords : descriptor.partition ? null : value.tombstoneRecords;
  const activeSourceRefs = descriptor.partition === 'active' ? partitionSourceRefs : descriptor.partition ? null : value.activeSourceRefs;
  const tombstoneSourceRefs = descriptor.partition === 'tombstones' ? partitionSourceRefs : descriptor.partition ? null : value.tombstoneSourceRefs;
  const arraysAllowed = PRESENT.has(status);
  const invalidShape = arraysAllowed
    ? (descriptor.partition ? !Array.isArray(partitionRecords) : !Array.isArray(active) || !Array.isArray(tombstones))
    : (descriptor.partition ? partitionRecords !== null : active !== null || tombstones !== null);
  if (invalidShape) errors.push({ code: 'availability_data_mismatch', domain: descriptor.key, path: descriptor.path });
  if (arraysAllowed) {
    const refsValid = descriptor.partition
      ? Array.isArray(partitionSourceRefs) && Array.isArray(partitionRecords) && partitionSourceRefs.length === partitionRecords.length
      : Array.isArray(activeSourceRefs) && Array.isArray(tombstoneSourceRefs)
        && Array.isArray(active) && Array.isArray(tombstones)
        && activeSourceRefs.length === active.length && tombstoneSourceRefs.length === tombstones.length;
    if (!refsValid) errors.push({ code: 'record_source_index_mismatch', domain: descriptor.key, path: descriptor.path });
    const refs = [...(Array.isArray(activeSourceRefs) ? activeSourceRefs : []), ...(Array.isArray(tombstoneSourceRefs) ? tombstoneSourceRefs : [])];
    if (refs.some(ref => typeof ref !== 'string' || !/^[A-Za-z0-9._:-]{1,320}$/.test(ref) || SENSITIVE_METADATA.test(ref))) {
      errors.push({ code: 'unsafe_record_source_ref', domain: descriptor.key, path: descriptor.path });
    }
  }
  const allCount = (Array.isArray(active) ? active.length : 0) + (Array.isArray(tombstones) ? tombstones.length : 0);
  if (!descriptor.partition && status === 'present_empty' && allCount !== 0) errors.push({ code: 'present_empty_has_records', domain: descriptor.key, path: descriptor.path });
  if (!descriptor.partition && status === 'present_records' && allCount === 0) errors.push({ code: 'present_records_is_empty', domain: descriptor.key, path: descriptor.path });
  return {
    availability: validStatus.includes(status) ? status : 'parse_failed',
    source: (value.source as RecoverySourceProvenance | null) ?? null,
    active: Array.isArray(active) ? active as RecoveryRecord[] : descriptor.partition === 'tombstones' ? [] : null,
    tombstones: Array.isArray(tombstones) ? tombstones as RecoveryRecord[] : descriptor.partition === 'active' ? [] : null,
    activeSourceRefs: Array.isArray(activeSourceRefs) ? activeSourceRefs.filter(item => typeof item === 'string') as string[] : descriptor.partition === 'tombstones' ? [] : null,
    tombstoneSourceRefs: Array.isArray(tombstoneSourceRefs) ? tombstoneSourceRefs.filter(item => typeof item === 'string') as string[] : descriptor.partition === 'active' ? [] : null,
    warningCodes: Array.isArray(value.warningCodes) ? value.warningCodes.filter(item => typeof item === 'string') as string[] : [],
  };
}

export async function verifyRecoveryExportPackage(pkg: Pick<RecoveryExportPackage, 'files'>): Promise<RecoveryVerificationResult> {
  const errors: RecoveryDiagnostic[] = [];
  const warnings: RecoveryDiagnostic[] = [];
  const verifiedFiles: string[] = [];
  const filePaths = Object.keys(pkg.files);
  for (const path of filePaths) {
    if (!safePackagePath(path)) errors.push({ code: 'unsafe_path', domain: 'package', path: 'package' });
    if (!EXPECTED_PATHS.has(path)) errors.push({ code: 'unexpected_file', domain: 'package', path });
  }
  for (const path of EXPECTED_PATHS) if (!(path in pkg.files)) errors.push({ code: 'missing_file', domain: 'package', path });
  const checksumMap = parseChecksumFile(pkg.files['checksums.sha256'] ?? '', errors);
  for (const path of EXPECTED_PATHS) {
    if (path === 'checksums.sha256') continue;
    if (!(path in checksumMap)) errors.push({ code: 'missing_checksum', domain: 'package', path });
    else if (pkg.files[path] !== undefined && await sha256(pkg.files[path]) !== checksumMap[path]) {
      errors.push({ code: 'checksum_mismatch', domain: 'package', path });
    } else if (pkg.files[path] !== undefined) verifiedFiles.push(path);
  }
  for (const path of Object.keys(checksumMap)) if (!EXPECTED_PATHS.has(path) || path === 'checksums.sha256') {
    errors.push({ code: 'unexpected_checksum', domain: 'package', path });
  }
  let manifest: RecoveryExportManifest | null = null;
  try { manifest = JSON.parse(pkg.files['manifest.json']) as RecoveryExportManifest; }
  catch { errors.push({ code: 'invalid_manifest_json', domain: 'package', path: 'manifest.json' }); }
  if (manifest && (manifest.kind !== RECOVERY_EXPORT_KIND || manifest.schemaVersion !== 2)) {
    errors.push({ code: 'manifest_schema_mismatch', domain: 'package', path: 'manifest.json' });
  }
  const parsedByKey = new Map<RecoveryDatasetKey, NormalizedDataset>();
  const parsedEntries: RecoveryDatasetManifestEntry[] = [];
  for (const descriptor of RECOVERY_DATASET_DESCRIPTORS) {
    let value: Record<string, unknown> = {};
    try { value = JSON.parse(pkg.files[descriptor.path]) as Record<string, unknown>; }
    catch { errors.push({ code: 'invalid_dataset_json', domain: descriptor.key, path: descriptor.path }); }
    const parsed = parsedDataset(descriptor, value, errors);
    const current = parsedByKey.get(descriptor.key);
    if (descriptor.partition && current) {
      if (current.availability !== parsed.availability) errors.push({ code: 'partition_availability_mismatch', domain: descriptor.key, path: descriptor.path });
      if (descriptor.partition === 'tombstones') {
        current.tombstones = parsed.tombstones;
        current.tombstoneSourceRefs = parsed.tombstoneSourceRefs;
      }
    } else parsedByKey.set(descriptor.key, parsed);
    const activeCount = descriptor.partition === 'tombstones' ? 0 : parsed.active?.length ?? null;
    const tombstoneCount = descriptor.partition === 'active' ? 0 : parsed.tombstones?.length ?? null;
    parsedEntries.push({
      key: descriptor.key, path: descriptor.path, availability: parsed.availability,
      totalCount: descriptor.partition === 'active' ? activeCount : descriptor.partition === 'tombstones' ? tombstoneCount
        : activeCount === null ? null : activeCount + (tombstoneCount ?? 0),
      activeCount, tombstoneCount, sha256: checksumMap[descriptor.path] ?? '', source: parsed.source,
    });
  }
  for (const [key, dataset] of parsedByKey) {
    const count = (dataset.active?.length ?? 0) + (dataset.tombstones?.length ?? 0);
    if (dataset.availability === 'present_empty' && count !== 0) errors.push({ code: 'present_empty_has_records', domain: key, path: key });
    if (dataset.availability === 'present_records' && count === 0) errors.push({ code: 'present_records_is_empty', domain: key, path: key });
  }
  if (manifest) {
    if (manifest.fileCount !== filePaths.length) errors.push({ code: 'manifest_file_count_mismatch', domain: 'package', path: 'manifest.json' });
    if (manifest.datasets.length !== parsedEntries.length) errors.push({ code: 'manifest_dataset_count_mismatch', domain: 'package', path: 'manifest.json' });
    for (const expected of parsedEntries) {
      const actual = manifest.datasets.find(item => item.path === expected.path);
      if (!actual || stableRecoveryJson(actual) !== stableRecoveryJson(expected)) {
        errors.push({ code: 'manifest_dataset_mismatch', domain: expected.key, path: expected.path });
      }
    }
  }
  try {
    const sourceInventory = JSON.parse(pkg.files['metadata/source-inventory.json']) as { datasets?: Array<Record<string, unknown>> };
    const recomputed = parsedEntries.map(entry => ({
      key: entry.key, path: entry.path, availability: entry.availability,
      totalCount: entry.totalCount, activeCount: entry.activeCount, tombstoneCount: entry.tombstoneCount,
      source: entry.source,
    }));
    if (stableRecoveryJson(sourceInventory.datasets ?? []) !== stableRecoveryJson(recomputed)) {
      errors.push({ code: 'source_inventory_mismatch', domain: 'package', path: 'metadata/source-inventory.json' });
    }
  } catch { errors.push({ code: 'invalid_source_inventory_json', domain: 'package', path: 'metadata/source-inventory.json' }); }
  try {
    const warningFile = JSON.parse(pkg.files['metadata/warnings.json']) as { warningCodes?: unknown[] };
    if (manifest && (warningFile.warningCodes?.length ?? 0) !== manifest.warningCount) {
      errors.push({ code: 'manifest_warning_count_mismatch', domain: 'package', path: 'metadata/warnings.json' });
    }
    const storedCodes = new Set((warningFile.warningCodes ?? []).filter(value => typeof value === 'string'));
    for (const warning of analyzeWarnings(parsedByKey)) if (!storedCodes.has(warning.code)) {
      errors.push({ code: 'semantic_warning_missing', domain: warning.domain, path: 'metadata/warnings.json' });
    }
  } catch { errors.push({ code: 'invalid_warnings_json', domain: 'package', path: 'metadata/warnings.json' }); }
  const conflicts = analyzeConflicts(parsedByKey);
  const semanticWarnings = analyzeWarnings(parsedByKey);
  try {
    const conflictFile = JSON.parse(pkg.files['metadata/conflicts.json']) as { diagnostics?: RecoveryDiagnostic[] };
    if (stableRecoveryJson(conflictFile.diagnostics ?? []) !== stableRecoveryJson(conflicts)) {
      errors.push({ code: 'conflict_diagnostics_mismatch', domain: 'package', path: 'metadata/conflicts.json' });
    }
  } catch { errors.push({ code: 'invalid_conflicts_json', domain: 'package', path: 'metadata/conflicts.json' }); }
  const availability = new Map([...parsedByKey].map(([key, value]) => [key, value.availability] as const));
  const derived = deriveRecoveryCompleteness(availability, manifest?.requiredDatasets ?? [], errors.length > 0 || conflicts.length > 0);
  if (manifest && derived !== 'invalid' && manifest.completeness !== derived) {
    errors.push({ code: 'completeness_mismatch', domain: 'package', path: 'manifest.json' });
  }
  if (manifest && manifest.conflictCount !== conflicts.length) errors.push({ code: 'manifest_conflict_count_mismatch', domain: 'package', path: 'manifest.json' });
  return {
    valid: errors.length === 0 && conflicts.length === 0,
    completeness: errors.length > 0 || conflicts.length > 0 ? 'invalid' : derived,
    verifiedFiles: verifiedFiles.sort(), errors: diagSort(errors), warnings: diagSort([...warnings, ...semanticWarnings]),
    conflictDiagnostics: conflicts,
  };
}

export async function createRecoveryExportArchive(pkg: RecoveryExportPackage): Promise<Uint8Array> {
  const zip = new JSZip();
  const fixedDate = new Date('1980-01-01T00:00:00.000Z');
  for (const [path, content] of Object.entries(pkg.files).sort(([a], [b]) => a.localeCompare(b))) {
    if (!safePackagePath(path)) throw new Error('unsafe_package_path');
    zip.file(`absinthe-recovery-export/${path}`, content, {
      date: fixedDate, createFolders: true, unixPermissions: 0o100644, dosPermissions: 0,
    });
  }
  return zip.generateAsync({ type: 'uint8array', compression: 'STORE', platform: 'DOS' });
}
