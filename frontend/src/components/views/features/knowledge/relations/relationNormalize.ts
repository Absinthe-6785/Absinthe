import { normalizePropertyKey } from '../properties/noteProperties';
import type { RelationEdge, RelationRecord } from './relationModels';

/** Stable edge identity: sourceId + targetId + propertyKey */
export function relationEdgeKey(sourceId: string, targetId: string, propertyKey: string): string {
  return `${sourceId}\0${targetId}\0${normalizePropertyKey(propertyKey)}`;
}

export function normalizeRelationPropertyKey(key: string): string {
  return normalizePropertyKey(key);
}

function dedupeTargetIds(targetIds: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const id of targetIds) {
    if (typeof id !== 'string') continue;
    const trimmed = id.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

/** Normalize persisted relations map — drops invalid entries */
export function normalizeNoteRelations(
  raw: unknown,
): Record<string, string[]> | undefined {
  if (!raw || typeof raw !== 'object') return undefined;

  const result: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(raw)) {
    const trimmedKey = key.trim();
    if (!trimmedKey) continue;

    let targetIds: string[] = [];
    if (Array.isArray(value)) {
      targetIds = dedupeTargetIds(value);
    } else if (typeof value === 'string' && value.trim()) {
      targetIds = dedupeTargetIds([value]);
    }
    if (targetIds.length === 0) continue;

    const normKey = normalizeRelationPropertyKey(trimmedKey);
    const existing = result[normKey];
    result[normKey] = existing
      ? dedupeTargetIds([...existing, ...targetIds])
      : targetIds;
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

export function toRelationRecords(
  sourceId: string,
  relations: Record<string, string[]> | undefined,
): RelationRecord[] {
  if (!relations) return [];
  const records: RelationRecord[] = [];
  for (const [propertyKey, targetIds] of Object.entries(relations)) {
    for (const targetId of targetIds) {
      records.push({ propertyKey, targetId });
    }
  }
  return records;
}

export function toRelationEdges(
  sourceId: string,
  relations: Record<string, string[]> | undefined,
): RelationEdge[] {
  return toRelationRecords(sourceId, relations).map(record => ({
    sourceId,
    targetId: record.targetId,
    propertyKey: record.propertyKey,
  }));
}

export function mergeRelationMaps(
  left: Record<string, string[]> | undefined,
  right: Record<string, string[]> | undefined,
): Record<string, string[]> | undefined {
  if (!left && !right) return undefined;
  const merged: Record<string, string[]> = { ...(left ?? {}) };
  for (const [key, targetIds] of Object.entries(right ?? {})) {
    const normKey = normalizeRelationPropertyKey(key);
    merged[normKey] = dedupeTargetIds([...(merged[normKey] ?? []), ...targetIds]);
  }
  return Object.keys(merged).length > 0 ? merged : undefined;
}
