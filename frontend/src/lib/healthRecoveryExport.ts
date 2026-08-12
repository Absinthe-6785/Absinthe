import { stableRecoveryJson } from './recoveryExportPackage';

export const HEALTH_RECOVERY_EXPORT_FORMAT = 'absinthe-health-recovery-export';
export const HEALTH_RECOVERY_EXPORT_VERSION = 1;

export const HEALTH_RECOVERY_DATASETS = [
  'exercise_blocks',
  'workout_logs',
  'inbody_logs',
  'health_routines',
  'routines',
  'routine_logs',
  'protein_profiles',
  'protein_sources',
  'protein_intake_logs',
  'workout_memos',
] as const;

export type HealthRecoveryDatasetName = typeof HEALTH_RECOVERY_DATASETS[number];
export type HealthRecoveryRecord = Record<string, unknown>;
export type HealthRecoveryDatasets = Record<HealthRecoveryDatasetName, HealthRecoveryRecord[]>;

type DatasetDefinition = {
  schemaVersion: string;
  ownershipField: 'user_id';
  identityField: 'id' | 'user_id';
  ordering: readonly string[];
  dateField: string | null;
  relationships: readonly string[];
};

export const HEALTH_RECOVERY_DATASET_DEFINITIONS: Record<HealthRecoveryDatasetName, DatasetDefinition> = {
  exercise_blocks: {
    schemaVersion: 'absinthe-health-exercise-blocks-v1', ownershipField: 'user_id', identityField: 'id',
    ordering: ['id'], dateField: null, relationships: [],
  },
  workout_logs: {
    schemaVersion: 'absinthe-health-workout-logs-v1', ownershipField: 'user_id', identityField: 'id',
    ordering: ['date', 'id'], dateField: 'date', relationships: ['block_id -> exercise_blocks.id'],
  },
  inbody_logs: {
    schemaVersion: 'absinthe-health-inbody-logs-v1', ownershipField: 'user_id', identityField: 'id',
    ordering: ['date', 'id'], dateField: 'date', relationships: [],
  },
  health_routines: {
    schemaVersion: 'absinthe-health-routines-v1', ownershipField: 'user_id', identityField: 'id',
    ordering: ['day_name', 'id'], dateField: null, relationships: ['blocks[] -> exercise_blocks.id'],
  },
  routines: {
    schemaVersion: 'absinthe-routines-v1', ownershipField: 'user_id', identityField: 'id',
    ordering: ['created_date', 'created_timestamp', 'id'], dateField: 'created_date', relationships: [],
  },
  routine_logs: {
    schemaVersion: 'absinthe-routine-logs-v1', ownershipField: 'user_id', identityField: 'id',
    ordering: ['date', 'routine_id', 'id'], dateField: 'date', relationships: ['routine_id -> routines.id'],
  },
  protein_profiles: {
    schemaVersion: 'absinthe-protein-profiles-v1', ownershipField: 'user_id', identityField: 'user_id',
    ordering: ['user_id'], dateField: null, relationships: [],
  },
  protein_sources: {
    schemaVersion: 'absinthe-protein-sources-v1', ownershipField: 'user_id', identityField: 'id',
    ordering: ['created_at', 'id'], dateField: 'created_at', relationships: [],
  },
  protein_intake_logs: {
    schemaVersion: 'absinthe-protein-intake-logs-v1', ownershipField: 'user_id', identityField: 'id',
    ordering: ['date', 'created_at', 'id'], dateField: 'date', relationships: ['source_id -> protein_sources.id'],
  },
  workout_memos: {
    schemaVersion: 'absinthe-workout-memos-v1', ownershipField: 'user_id', identityField: 'id',
    ordering: ['date', 'id'], dateField: 'date', relationships: [],
  },
};

export const LOCAL_HEALTH_IMPORT_CONTRACT = {
  status: 'DESIGN_ONLY_NOT_IMPLEMENTED',
  repositoryBoundary: 'HealthRepository',
  driverBoundary: 'LocalHealthDriver',
  preferredDurableStore: 'IndexedDB',
  requiredStores: [...HEALTH_RECOVERY_DATASETS, 'health_recovery_anomalies'],
  requirements: [
    'verify export checksum before import',
    'validate every record before a durable transaction',
    'preserve source identifiers and source row multiplicity',
    'preserve unresolved-reference and ambiguity diagnostics',
    'commit all datasets atomically or leave local state unchanged',
  ],
} as const;

export type HealthRecoveryValidationIssue = {
  dataset: HealthRecoveryDatasetName;
  rowIndex: number;
  field: string;
  code: string;
};

export type HealthRelationshipDiagnostics = {
  workoutBlockReferences: { checked: number; missing: Array<{ workoutLogId: string; blockId: string }>; };
  healthRoutineBlockReferences: {
    checked: number;
    missing: Array<{
      healthRoutineId: string;
      dayName: string;
      referenceOrdinal: number;
      blockId: string;
      classification: 'PRESERVABLE_UNRESOLVED_REFERENCE';
    }>;
  };
  routineLogRoutineReferences: {
    checked: number;
    nullReferences: Array<{ routineLogId: string; date: string }>;
    missing: Array<{ routineLogId: string; routineId: string }>;
  };
  proteinIntakeSourceReferences: { checked: number; missing: Array<{ intakeLogId: string; sourceId: string }>; };
};

export type RoutineLogMultirowGroup = {
  routineId: string | null;
  date: string;
  groupCount: number;
  additionalRowCount: number;
  rowIds: string[];
  meaningfulVariants: Array<{ done: boolean | null; isCompleted: boolean | null }>;
  timestampOrderingAvailable: false;
  classification: 'TRUE_SEMANTIC_DUPLICATES' | 'UNCLEAR';
};

export type HealthRecoveryPayload = {
  format: typeof HEALTH_RECOVERY_EXPORT_FORMAT;
  version: typeof HEALTH_RECOVERY_EXPORT_VERSION;
  sourceAccount: { userId: string; email: string };
  exportedAt: string;
  datasets: HealthRecoveryDatasets;
  inventory: Array<DatasetDefinition & { dataset: HealthRecoveryDatasetName; sourceRowCount: number; exportedRowCount: number }>;
  diagnostics: {
    fieldValidation: { status: 'PASS'; issues: [] };
    relationships: HealthRelationshipDiagnostics;
    anomalies: {
      healthRoutineMissingBlockClassification: 'PRESERVABLE_UNRESOLVED_REFERENCE' | 'NOT_PRESENT';
      routineLogMultiplicityClassification: 'TRUE_SEMANTIC_DUPLICATES' | 'UNCLEAR' | 'NOT_PRESENT';
      routineLogMultirowGroupCount: number;
      routineLogAdditionalRowCount: number;
      routineLogGroups: RoutineLogMultirowGroup[];
      preservationRule: 'PRESERVE_EVERY_SOURCE_ROW_NO_WINNER_SELECTION';
    };
  };
  localImportContract: typeof LOCAL_HEALTH_IMPORT_CONTRACT;
  safety: {
    remoteAccess: 'SELECT_ONLY';
    remoteMutationCount: 0;
    startupOrLoginMutationIntroduced: false;
    localImportPerformed: false;
  };
};

export type HealthRecoveryExport = HealthRecoveryPayload & {
  checksum: {
    algorithm: 'SHA-256';
    canonicalization: 'stableRecoveryJson-v1';
    value: string;
  };
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function text(value: unknown): value is string { return typeof value === 'string' && value.length > 0; }
function uuid(value: unknown): value is string { return text(value) && UUID.test(value); }
function date(value: unknown): value is string {
  if (!text(value) || !DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}
function finite(value: unknown): boolean { return typeof value === 'number' && Number.isFinite(value); }
function finitePersisted(value: unknown, allowEmpty = false): boolean {
  if (finite(value)) return true;
  if (allowEmpty && value === '') return true;
  return typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value));
}
function nullableText(value: unknown): boolean { return value === null || typeof value === 'string'; }
function nullableUuid(value: unknown): value is string | null { return value === null || uuid(value); }

function issue(dataset: HealthRecoveryDatasetName, rowIndex: number, field: string, code: string): HealthRecoveryValidationIssue {
  return { dataset, rowIndex, field, code };
}
function validateSet(dataset: HealthRecoveryDatasetName, rowIndex: number, value: unknown, setIndex: number): HealthRecoveryValidationIssue[] {
  const prefix = `sets[${setIndex}]`;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [issue(dataset, rowIndex, prefix, 'set_must_be_object')];
  const set = value as HealthRecoveryRecord;
  const out: HealthRecoveryValidationIssue[] = [];
  if (!Number.isInteger(set.set) || (set.set as number) < 1) out.push(issue(dataset, rowIndex, `${prefix}.set`, 'positive_integer_required'));
  if (typeof set.done !== 'boolean') out.push(issue(dataset, rowIndex, `${prefix}.done`, 'boolean_required'));
  if (set.type === 'strength' || set.type === 'bodyweight') {
    if (!finitePersisted(set.kg, true)) out.push(issue(dataset, rowIndex, `${prefix}.kg`, 'finite_numeric_or_empty_required'));
    if (!finitePersisted(set.reps, true)) out.push(issue(dataset, rowIndex, `${prefix}.reps`, 'finite_numeric_or_empty_required'));
  } else if (set.type === 'cardio') {
    if (typeof set.time !== 'string') out.push(issue(dataset, rowIndex, `${prefix}.time`, 'string_required'));
    if (!finitePersisted(set.distance, true)) out.push(issue(dataset, rowIndex, `${prefix}.distance`, 'finite_numeric_or_empty_required'));
    if (typeof set.pace !== 'string') out.push(issue(dataset, rowIndex, `${prefix}.pace`, 'string_required'));
  } else out.push(issue(dataset, rowIndex, `${prefix}.type`, 'known_set_type_required'));
  return out;
}

export function validateHealthRecoveryDatasets(datasets: HealthRecoveryDatasets, userId: string): HealthRecoveryValidationIssue[] {
  const out: HealthRecoveryValidationIssue[] = [];
  for (const dataset of HEALTH_RECOVERY_DATASETS) {
    const rows = datasets[dataset];
    if (!Array.isArray(rows)) {
      out.push(issue(dataset, -1, dataset, 'dataset_array_required'));
      continue;
    }
    rows.forEach((row, rowIndex) => {
      if (!row || typeof row !== 'object' || Array.isArray(row)) {
        out.push(issue(dataset, rowIndex, '$', 'record_object_required'));
        return;
      }
      if (row.user_id !== userId) out.push(issue(dataset, rowIndex, 'user_id', 'source_owner_mismatch'));
      const identity = HEALTH_RECOVERY_DATASET_DEFINITIONS[dataset].identityField;
      if (!uuid(row[identity])) out.push(issue(dataset, rowIndex, identity, 'uuid_required'));
      if (dataset === 'exercise_blocks') {
        if (!text(row.name)) out.push(issue(dataset, rowIndex, 'name', 'nonempty_string_required'));
        if (!text(row.type)) out.push(issue(dataset, rowIndex, 'type', 'nonempty_string_required'));
        if (!Array.isArray(row.tags) || !row.tags.every(value => typeof value === 'string')) out.push(issue(dataset, rowIndex, 'tags', 'string_array_required'));
        if (!nullableText(row.cardio_mode)) out.push(issue(dataset, rowIndex, 'cardio_mode', 'nullable_string_required'));
      } else if (dataset === 'workout_logs') {
        if (!date(row.date)) out.push(issue(dataset, rowIndex, 'date', 'iso_date_required'));
        if (!nullableUuid(row.block_id)) out.push(issue(dataset, rowIndex, 'block_id', 'nullable_uuid_required'));
        if (!Array.isArray(row.sets)) out.push(issue(dataset, rowIndex, 'sets', 'array_required'));
        else row.sets.forEach((set, setIndex) => out.push(...validateSet(dataset, rowIndex, set, setIndex)));
        if (!Number.isInteger(row.sort_order)) out.push(issue(dataset, rowIndex, 'sort_order', 'integer_required'));
      } else if (dataset === 'inbody_logs') {
        if (!date(row.date)) out.push(issue(dataset, rowIndex, 'date', 'iso_date_required'));
        for (const field of ['weight', 'smm', 'pbf']) if (row[field] !== null && !finitePersisted(row[field])) out.push(issue(dataset, rowIndex, field, 'nullable_finite_numeric_required'));
      } else if (dataset === 'health_routines') {
        if (!text(row.day_name)) out.push(issue(dataset, rowIndex, 'day_name', 'nonempty_string_required'));
        if (!Array.isArray(row.blocks) || !row.blocks.every(uuid)) out.push(issue(dataset, rowIndex, 'blocks', 'uuid_array_required'));
      } else if (dataset === 'routines') {
        if (typeof row.text !== 'string') out.push(issue(dataset, rowIndex, 'text', 'string_required'));
        if (typeof row.is_active !== 'boolean') out.push(issue(dataset, rowIndex, 'is_active', 'boolean_required'));
        for (const field of ['created_at', 'created_date', 'deleted_at']) if (!nullableText(row[field])) out.push(issue(dataset, rowIndex, field, 'nullable_string_required'));
      } else if (dataset === 'routine_logs') {
        if (!nullableUuid(row.routine_id)) out.push(issue(dataset, rowIndex, 'routine_id', 'nullable_uuid_required'));
        if (!date(row.date)) out.push(issue(dataset, rowIndex, 'date', 'iso_date_required'));
        if (typeof row.done !== 'boolean') out.push(issue(dataset, rowIndex, 'done', 'boolean_required'));
        if (typeof row.is_completed !== 'boolean') out.push(issue(dataset, rowIndex, 'is_completed', 'boolean_required'));
      } else if (dataset === 'protein_profiles') {
        for (const field of ['weight', 'daily_target_g']) if (!finitePersisted(row[field])) out.push(issue(dataset, rowIndex, field, 'finite_numeric_required'));
        for (const field of ['goal', 'activity']) if (!text(row[field])) out.push(issue(dataset, rowIndex, field, 'nonempty_string_required'));
      } else if (dataset === 'protein_sources') {
        for (const field of ['name', 'source_type', 'category']) if (!text(row[field])) out.push(issue(dataset, rowIndex, field, 'nonempty_string_required'));
        for (const field of ['protein_per_serving', 'protein_per_100g']) if (row[field] !== null && !finitePersisted(row[field])) out.push(issue(dataset, rowIndex, field, 'nullable_finite_numeric_required'));
      } else if (dataset === 'protein_intake_logs') {
        if (!date(row.date)) out.push(issue(dataset, rowIndex, 'date', 'iso_date_required'));
        if (!nullableUuid(row.source_id)) out.push(issue(dataset, rowIndex, 'source_id', 'nullable_uuid_required'));
        for (const field of ['amount_g', 'protein_g']) if (!finitePersisted(row[field])) out.push(issue(dataset, rowIndex, field, 'finite_numeric_required'));
        if (!nullableText(row.note)) out.push(issue(dataset, rowIndex, 'note', 'nullable_string_required'));
      } else if (dataset === 'workout_memos') {
        if (!date(row.date)) out.push(issue(dataset, rowIndex, 'date', 'iso_date_required'));
        if (typeof row.memo !== 'string') out.push(issue(dataset, rowIndex, 'memo', 'string_required'));
      }
    });
  }
  return out;
}

function orderValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return stableRecoveryJson(value);
}

function compareBy(fields: readonly string[]) {
  return (left: HealthRecoveryRecord, right: HealthRecoveryRecord): number => {
    for (const field of fields) {
      const result = orderValue(left[field]).localeCompare(orderValue(right[field]));
      if (result !== 0) return result;
    }
    return stableRecoveryJson(left).localeCompare(stableRecoveryJson(right));
  };
}

export function orderHealthRecoveryDatasets(input: HealthRecoveryDatasets): HealthRecoveryDatasets {
  return Object.fromEntries(HEALTH_RECOVERY_DATASETS.map(dataset => [
    dataset,
    [...input[dataset]].sort(compareBy(HEALTH_RECOVERY_DATASET_DEFINITIONS[dataset].ordering)),
  ])) as HealthRecoveryDatasets;
}

function stringId(record: HealthRecoveryRecord, field: string): string { return String(record[field] ?? ''); }

export function deriveHealthRelationshipDiagnostics(datasets: HealthRecoveryDatasets): HealthRelationshipDiagnostics {
  const blocks = new Set(datasets.exercise_blocks.map(row => stringId(row, 'id')));
  const routines = new Set(datasets.routines.map(row => stringId(row, 'id')));
  const proteinSources = new Set(datasets.protein_sources.map(row => stringId(row, 'id')));
  const workoutMissing: Array<{ workoutLogId: string; blockId: string }> = [];
  let workoutChecked = 0;
  for (const row of datasets.workout_logs) {
    if (row.block_id === null) continue;
    workoutChecked += 1;
    const blockId = String(row.block_id);
    if (!blocks.has(blockId)) workoutMissing.push({ workoutLogId: String(row.id), blockId });
  }
  const healthMissing: HealthRelationshipDiagnostics['healthRoutineBlockReferences']['missing'] = [];
  let healthChecked = 0;
  for (const row of datasets.health_routines) {
    (row.blocks as unknown[]).forEach((rawId, index) => {
      healthChecked += 1;
      const blockId = String(rawId);
      if (!blocks.has(blockId)) healthMissing.push({
        healthRoutineId: String(row.id), dayName: String(row.day_name), referenceOrdinal: index + 1,
        blockId, classification: 'PRESERVABLE_UNRESOLVED_REFERENCE',
      });
    });
  }
  const routineMissing: Array<{ routineLogId: string; routineId: string }> = [];
  const routineNull: Array<{ routineLogId: string; date: string }> = [];
  let routineChecked = 0;
  for (const row of datasets.routine_logs) {
    if (row.routine_id === null) {
      routineNull.push({ routineLogId: String(row.id), date: String(row.date) });
      continue;
    }
    routineChecked += 1;
    const routineId = String(row.routine_id);
    if (!routines.has(routineId)) routineMissing.push({ routineLogId: String(row.id), routineId });
  }
  const proteinMissing: Array<{ intakeLogId: string; sourceId: string }> = [];
  let proteinChecked = 0;
  for (const row of datasets.protein_intake_logs) {
    if (row.source_id === null) continue;
    proteinChecked += 1;
    const sourceId = String(row.source_id);
    if (!proteinSources.has(sourceId)) proteinMissing.push({ intakeLogId: String(row.id), sourceId });
  }
  return {
    workoutBlockReferences: { checked: workoutChecked, missing: workoutMissing },
    healthRoutineBlockReferences: { checked: healthChecked, missing: healthMissing },
    routineLogRoutineReferences: { checked: routineChecked, nullReferences: routineNull, missing: routineMissing },
    proteinIntakeSourceReferences: { checked: proteinChecked, missing: proteinMissing },
  };
}

function statePair(row: HealthRecoveryRecord): { done: boolean | null; isCompleted: boolean | null } {
  return {
    done: typeof row.done === 'boolean' ? row.done : null,
    isCompleted: typeof row.is_completed === 'boolean' ? row.is_completed : null,
  };
}

export function deriveRoutineLogGroups(rows: HealthRecoveryRecord[]): RoutineLogMultirowGroup[] {
  const grouped = new Map<string, HealthRecoveryRecord[]>();
  for (const row of rows) {
    const key = `${row.routine_id === null ? '<null>' : String(row.routine_id)}\u0000${String(row.date)}`;
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }
  return [...grouped.values()].filter(group => group.length > 1).map((group): RoutineLogMultirowGroup => {
    const pairs = new Map(group.map(row => [stableRecoveryJson(statePair(row)), statePair(row)]));
    const routineId = group[0].routine_id === null ? null : String(group[0].routine_id);
    return {
      routineId,
      date: String(group[0].date),
      groupCount: group.length,
      additionalRowCount: group.length - 1,
      rowIds: group.map(row => String(row.id)).sort(),
      meaningfulVariants: [...pairs.values()].sort((a, b) => stableRecoveryJson(a).localeCompare(stableRecoveryJson(b))),
      timestampOrderingAvailable: false,
      classification: routineId === null ? 'UNCLEAR' : 'TRUE_SEMANTIC_DUPLICATES',
    };
  }).sort((a, b) => `${a.date}\u0000${a.routineId ?? ''}`.localeCompare(`${b.date}\u0000${b.routineId ?? ''}`));
}

async function sha256(textValue: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(textValue));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function buildHealthRecoveryExport(input: {
  sourceAccount: { userId: string; email: string };
  exportedAt: string;
  datasets: HealthRecoveryDatasets;
}): Promise<HealthRecoveryExport> {
  if (!uuid(input.sourceAccount.userId)) throw new Error('source_account_user_id_invalid');
  if (!text(input.sourceAccount.email) || !input.sourceAccount.email.includes('@')) throw new Error('source_account_email_invalid');
  if (Number.isNaN(Date.parse(input.exportedAt))) throw new Error('export_timestamp_invalid');
  for (const dataset of HEALTH_RECOVERY_DATASETS) if (!Array.isArray(input.datasets[dataset])) throw new Error(`dataset_missing:${dataset}`);
  const datasets = orderHealthRecoveryDatasets(input.datasets);
  const issues = validateHealthRecoveryDatasets(datasets, input.sourceAccount.userId);
  if (issues.length > 0) throw new Error(`health_field_validation_failed:${stableRecoveryJson(issues)}`);
  const relationships = deriveHealthRelationshipDiagnostics(datasets);
  const routineLogGroups = deriveRoutineLogGroups(datasets.routine_logs);
  const classifications = new Set(routineLogGroups.map(group => group.classification));
  const routineClassification = routineLogGroups.length === 0
    ? 'NOT_PRESENT' as const
    : classifications.has('UNCLEAR') ? 'UNCLEAR' as const : 'TRUE_SEMANTIC_DUPLICATES' as const;
  const payload: HealthRecoveryPayload = {
    format: HEALTH_RECOVERY_EXPORT_FORMAT,
    version: HEALTH_RECOVERY_EXPORT_VERSION,
    sourceAccount: { ...input.sourceAccount },
    exportedAt: new Date(input.exportedAt).toISOString(),
    datasets,
    inventory: HEALTH_RECOVERY_DATASETS.map(dataset => ({
      dataset,
      ...HEALTH_RECOVERY_DATASET_DEFINITIONS[dataset],
      sourceRowCount: datasets[dataset].length,
      exportedRowCount: datasets[dataset].length,
    })),
    diagnostics: {
      fieldValidation: { status: 'PASS', issues: [] },
      relationships,
      anomalies: {
        healthRoutineMissingBlockClassification: relationships.healthRoutineBlockReferences.missing.length > 0
          ? 'PRESERVABLE_UNRESOLVED_REFERENCE' : 'NOT_PRESENT',
        routineLogMultiplicityClassification: routineClassification,
        routineLogMultirowGroupCount: routineLogGroups.length,
        routineLogAdditionalRowCount: routineLogGroups.reduce((sum, group) => sum + group.additionalRowCount, 0),
        routineLogGroups,
        preservationRule: 'PRESERVE_EVERY_SOURCE_ROW_NO_WINNER_SELECTION',
      },
    },
    localImportContract: LOCAL_HEALTH_IMPORT_CONTRACT,
    safety: {
      remoteAccess: 'SELECT_ONLY', remoteMutationCount: 0,
      startupOrLoginMutationIntroduced: false, localImportPerformed: false,
    },
  };
  return {
    ...payload,
    checksum: {
      algorithm: 'SHA-256', canonicalization: 'stableRecoveryJson-v1',
      value: await sha256(stableRecoveryJson(payload)),
    },
  };
}

export function serializeHealthRecoveryExport(value: HealthRecoveryExport): string {
  return stableRecoveryJson(value);
}

export async function verifyHealthRecoveryExportText(source: string): Promise<{
  export: HealthRecoveryExport;
  datasetCount: number;
  totalRowCount: number;
}> {
  const parsed = JSON.parse(source) as HealthRecoveryExport;
  if (parsed.format !== HEALTH_RECOVERY_EXPORT_FORMAT || parsed.version !== HEALTH_RECOVERY_EXPORT_VERSION) throw new Error('health_export_contract_mismatch');
  if (!parsed.checksum || parsed.checksum.algorithm !== 'SHA-256' || parsed.checksum.canonicalization !== 'stableRecoveryJson-v1') throw new Error('health_export_checksum_contract_mismatch');
  const { checksum, ...payload } = parsed;
  if (await sha256(stableRecoveryJson(payload)) !== checksum.value) throw new Error('health_export_checksum_mismatch');
  const rebuilt = await buildHealthRecoveryExport({
    sourceAccount: parsed.sourceAccount,
    exportedAt: parsed.exportedAt,
    datasets: parsed.datasets,
  });
  if (stableRecoveryJson(rebuilt) !== stableRecoveryJson(parsed)) throw new Error('health_export_derived_metadata_mismatch');
  return {
    export: parsed,
    datasetCount: HEALTH_RECOVERY_DATASETS.length,
    totalRowCount: HEALTH_RECOVERY_DATASETS.reduce((sum, dataset) => sum + parsed.datasets[dataset].length, 0),
  };
}

type ReadOnlyFetch = (input: string, init?: RequestInit) => Promise<Pick<Response, 'ok' | 'status' | 'json'>>;

export async function collectHealthRecoveryDatasetsReadOnly(input: {
  endpoint: string;
  apiKey: string;
  userId: string;
  fetchImpl?: ReadOnlyFetch;
  pageSize?: number;
}): Promise<HealthRecoveryDatasets> {
  if (!/^https:\/\//.test(input.endpoint)) throw new Error('supabase_https_endpoint_required');
  if (!text(input.apiKey)) throw new Error('supabase_api_key_required');
  if (!uuid(input.userId)) throw new Error('source_account_user_id_invalid');
  const fetchImpl = input.fetchImpl ?? fetch;
  const pageSize = input.pageSize ?? 500;
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 1000) throw new Error('page_size_invalid');
  const output = {} as HealthRecoveryDatasets;
  for (const dataset of HEALTH_RECOVERY_DATASETS) {
    const records: HealthRecoveryRecord[] = [];
    for (let offset = 0; ; offset += pageSize) {
      const url = new URL(`/rest/v1/${dataset}`, input.endpoint);
      url.searchParams.set('select', '*');
      url.searchParams.set('user_id', `eq.${input.userId}`);
      url.searchParams.set('limit', String(pageSize));
      url.searchParams.set('offset', String(offset));
      const response = await fetchImpl(url.toString(), {
        method: 'GET',
        headers: {
          apikey: input.apiKey,
          Authorization: `Bearer ${input.apiKey}`,
          Accept: 'application/json',
        },
        redirect: 'error',
      });
      if (!response.ok) throw new Error(`health_select_failed:${dataset}:http_${response.status}`);
      const page = await response.json();
      if (!Array.isArray(page)) throw new Error(`health_select_invalid_response:${dataset}`);
      records.push(...page as HealthRecoveryRecord[]);
      if (page.length < pageSize) break;
    }
    output[dataset] = records;
  }
  const ownerIssues = validateHealthRecoveryDatasets(output, input.userId).filter(entry => entry.code === 'source_owner_mismatch');
  if (ownerIssues.length > 0) throw new Error('health_select_owner_scope_violation');
  return output;
}
