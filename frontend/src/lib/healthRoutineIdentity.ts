import { hashCanonicalPayload } from './localDatabase/canonicalPayload';
import { sha256Hex } from './localDatabase/outboxIdentity';

export const DEFAULT_HEALTH_ROUTINE_PRESET_ID = '00000000-0000-5000-8000-000000000001';
export const HEALTH_ROUTINE_PROFILE_ID = '00000000-0000-5000-8000-000000000002';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isHealthRoutineUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}

function derivedPresetId(accountId: string, legacyId: string, disambiguator: string | null): string {
  const digest = sha256Hex(JSON.stringify([
    'absinthe-health-routine-preset-v2', accountId, legacyId, disambiguator,
  ]));
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-5${digest.slice(13, 16)}-8${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
}

/** Stable UUIDv5-shaped identity for a unique legacy preset ID. */
export function stableHealthRoutinePresetId(accountId: string, legacyId: string): string {
  if (legacyId === 'health-default' || legacyId === DEFAULT_HEALTH_ROUTINE_PRESET_ID) {
    return DEFAULT_HEALTH_ROUTINE_PRESET_ID;
  }
  if (isHealthRoutineUuid(legacyId)) return legacyId.toLowerCase();
  return derivedPresetId(accountId, legacyId, null);
}

export type LegacyPresetIdentityInput = Readonly<{
  legacyId: string;
  logicalRecord: unknown;
}>;

/**
 * Assigns a permutation-invariant ID set. Unique legacy IDs never depend on
 * array position; actual duplicate IDs are ordered by canonical record content.
 */
export function assignStableHealthRoutinePresetIds(
  accountId: string,
  inputs: readonly LegacyPresetIdentityInput[],
): { ids: string[]; primaryByLegacyId: ReadonlyMap<string, string> } {
  const descriptors = inputs.map((input, index) => ({
    index,
    legacyId: input.legacyId,
    fingerprint: hashCanonicalPayload(input.logicalRecord),
  }));
  const groups = new Map<string, typeof descriptors>();
  for (const descriptor of descriptors) {
    const group = groups.get(descriptor.legacyId) ?? [];
    group.push(descriptor);
    groups.set(descriptor.legacyId, group);
  }

  const ids = Array<string>(inputs.length);
  const primaryByLegacyId = new Map<string, string>();
  for (const [legacyId, group] of groups) {
    const ordered = [...group].sort((left, right) => (
      left.fingerprint.localeCompare(right.fingerprint) || left.index - right.index
    ));
    const baseId = stableHealthRoutinePresetId(accountId, legacyId);
    primaryByLegacyId.set(legacyId, baseId);
    ordered.forEach((descriptor, duplicateIndex) => {
      ids[descriptor.index] = duplicateIndex === 0
        ? baseId
        : derivedPresetId(accountId, legacyId, `duplicate:${descriptor.fingerprint}:${duplicateIndex}`);
    });
  }
  return { ids, primaryByLegacyId };
}
