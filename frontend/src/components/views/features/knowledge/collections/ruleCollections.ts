import { isKnowledgeQuery, parseQuery } from '../query/parseQuery';
import type { RuleCollection } from './ruleCollectionModels';

export function isValidRuleCollectionQuery(query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed || !isKnowledgeQuery(trimmed)) return false;
  return !parseQuery(trimmed).error;
}

export function normalizeRuleCollections(raw: unknown): RuleCollection[] {
  if (!Array.isArray(raw)) return [];

  const collections: RuleCollection[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Partial<RuleCollection>;
    if (typeof record.id !== 'string' || typeof record.name !== 'string' || typeof record.query !== 'string') {
      continue;
    }
    const name = record.name.trim();
    const query = record.query.trim();
    if (!record.id || !name || !query || !isValidRuleCollectionQuery(query)) continue;
    collections.push({ id: record.id, name, query });
  }

  return collections.sort((a, b) => a.name.localeCompare(b.name));
}

export function findRuleCollection(
  collections: readonly RuleCollection[],
  id: string,
): RuleCollection | undefined {
  return collections.find(collection => collection.id === id);
}

export function createRuleCollection(
  collections: readonly RuleCollection[],
  name: string,
  query: string,
  id = `collection-${Date.now()}`,
): RuleCollection[] {
  const trimmedName = name.trim();
  const trimmedQuery = query.trim();
  if (!trimmedName || !isValidRuleCollectionQuery(trimmedQuery)) return [...collections];

  const next: RuleCollection = { id, name: trimmedName, query: trimmedQuery };
  return [...collections, next].sort((a, b) => a.name.localeCompare(b.name));
}

export function renameRuleCollection(
  collections: readonly RuleCollection[],
  id: string,
  name: string,
): RuleCollection[] {
  const trimmedName = name.trim();
  if (!trimmedName) return [...collections];

  return collections
    .map(collection => (collection.id === id ? { ...collection, name: trimmedName } : collection))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function deleteRuleCollection(
  collections: readonly RuleCollection[],
  id: string,
): RuleCollection[] {
  return collections.filter(collection => collection.id !== id);
}

/** Activate a rule collection — returns its id for sidebar state */
export function activateRuleCollection(collection: RuleCollection): string {
  return collection.id;
}
