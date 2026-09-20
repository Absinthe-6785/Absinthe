import { sha256Hex } from './localDatabase/outboxIdentity';

export const DEFAULT_HEALTH_ROUTINE_PRESET_ID = '00000000-0000-5000-8000-000000000001';
export const HEALTH_ROUTINE_PROFILE_ID = '00000000-0000-5000-8000-000000000002';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isHealthRoutineUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}

/** Stable UUIDv5-shaped identity for legacy preset IDs that were never UUIDs. */
export function stableHealthRoutinePresetId(accountId: string, legacyId: string, ordinal = 0): string {
  if (legacyId === 'health-default' || legacyId === DEFAULT_HEALTH_ROUTINE_PRESET_ID) {
    return DEFAULT_HEALTH_ROUTINE_PRESET_ID;
  }
  if (isHealthRoutineUuid(legacyId)) return legacyId.toLowerCase();
  const digest = sha256Hex(JSON.stringify([
    'absinthe-health-routine-preset-v1', accountId, legacyId, ordinal,
  ]));
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-5${digest.slice(13, 16)}-8${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
}
