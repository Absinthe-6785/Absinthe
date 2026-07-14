import { LocalDatabaseError } from './errors';
import { sha256Hex } from './outboxIdentity';
import { validTimestamp } from './validation';

export const LOCAL_FIRST_RUNTIME_MODE_STORAGE_ID = 'k326:runtime-mode';
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const HASH = /^[a-f0-9]{64}$/;

export type LocalFirstRuntimeMode = 'legacy' | 'local_first';

export interface LocalFirstRuntimeModeRecordV1 {
  kind: 'local_first_runtime_mode_v1';
  version: 1;
  namespaceKey: string;
  mode: LocalFirstRuntimeMode;
  activeGenerationId: string;
  cutoverSessionId: string | null;
  targetGenerationId: string | null;
  updatedAt: string;
  activatedAt: string | null;
  recordDigest: string;
}

export interface PersistedLocalFirstRuntimeModeRecordV1 extends LocalFirstRuntimeModeRecordV1 {
  migrationId: typeof LOCAL_FIRST_RUNTIME_MODE_STORAGE_ID;
}

function compareCanonicalStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort(compareCanonicalStrings)
    .map(key => `${JSON.stringify(key)}:${canonical(record[key])}`).join(',')}}`;
}

function exactKeys(value: unknown, expected: readonly string[]): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value as object).sort(compareCanonicalStrings).join(',')
      === [...expected].sort(compareCanonicalStrings).join(',');
}

function modeCore(value: Omit<PersistedLocalFirstRuntimeModeRecordV1, 'recordDigest'>): unknown[] {
  return ['absinthe-local-first-runtime-mode-v1', value];
}

export function localFirstRuntimeModeKey(namespaceKey: string): [string, string] {
  return [namespaceKey, LOCAL_FIRST_RUNTIME_MODE_STORAGE_ID];
}

export function buildLocalFirstRuntimeModeRecord(
  input: Omit<PersistedLocalFirstRuntimeModeRecordV1, 'kind' | 'version' | 'migrationId' | 'recordDigest'>,
): PersistedLocalFirstRuntimeModeRecordV1 {
  const core: Omit<PersistedLocalFirstRuntimeModeRecordV1, 'recordDigest'> = {
    kind: 'local_first_runtime_mode_v1', version: 1,
    migrationId: LOCAL_FIRST_RUNTIME_MODE_STORAGE_ID, ...input,
  };
  return { ...core, recordDigest: sha256Hex(canonical(modeCore(core))) };
}

export function validatePersistedLocalFirstRuntimeMode(
  value: unknown,
  namespaceKey: string,
): PersistedLocalFirstRuntimeModeRecordV1 {
  const keys = ['kind', 'version', 'namespaceKey', 'migrationId', 'mode', 'activeGenerationId', 'cutoverSessionId',
    'targetGenerationId', 'updatedAt', 'activatedAt', 'recordDigest'];
  if (!exactKeys(value, keys)) throw new LocalDatabaseError('CORRUPT_PERSISTED_RECORD', 'validate_cutover_runtime_mode');
  const record = value as unknown as PersistedLocalFirstRuntimeModeRecordV1;
  const { recordDigest, ...core } = record;
  const bindingValid = record.mode === 'legacy'
    ? record.cutoverSessionId === null && record.targetGenerationId === null && record.activatedAt === null
    : record.mode === 'local_first' && SAFE_ID.test(record.cutoverSessionId ?? '')
      && SAFE_ID.test(record.targetGenerationId ?? '') && validTimestamp(record.activatedAt);
  if (record.kind !== 'local_first_runtime_mode_v1' || record.version !== 1
    || record.namespaceKey !== namespaceKey || record.migrationId !== LOCAL_FIRST_RUNTIME_MODE_STORAGE_ID
    || !['legacy', 'local_first'].includes(record.mode) || !SAFE_ID.test(record.activeGenerationId)
    || !validTimestamp(record.updatedAt) || !HASH.test(record.recordDigest) || !bindingValid
    || recordDigest !== sha256Hex(canonical(modeCore(core)))) {
    throw new LocalDatabaseError('CORRUPT_PERSISTED_RECORD', 'validate_cutover_runtime_mode');
  }
  return record;
}

export function publicLocalFirstRuntimeMode(
  value: PersistedLocalFirstRuntimeModeRecordV1,
): LocalFirstRuntimeModeRecordV1 {
  const { migrationId: _storageId, ...record } = value;
  return record;
}

export function advanceLocalFirstRuntimeMode(
  value: PersistedLocalFirstRuntimeModeRecordV1,
  activeGenerationId: string,
  updatedAt: string,
): PersistedLocalFirstRuntimeModeRecordV1 {
  if (value.mode !== 'local_first') {
    throw new LocalDatabaseError('ACTIVE_GENERATION_TRANSITION_REQUIRES_PROTOCOL', 'advance_runtime_mode');
  }
  return buildLocalFirstRuntimeModeRecord({
    namespaceKey: value.namespaceKey,
    mode: value.mode,
    activeGenerationId,
    cutoverSessionId: value.cutoverSessionId,
    targetGenerationId: value.targetGenerationId,
    updatedAt,
    activatedAt: value.activatedAt,
  });
}
