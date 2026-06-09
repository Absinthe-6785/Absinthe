import { normalizeRuleCollections } from './ruleCollections';
import type { RuleCollection } from './ruleCollectionModels';

export const RULE_COLLECTIONS_KEY = 'note-rule-collections-v1';

export function loadRuleCollections(): RuleCollection[] {
  try {
    const raw = localStorage.getItem(RULE_COLLECTIONS_KEY);
    if (!raw) return [];
    return normalizeRuleCollections(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function saveRuleCollections(collections: readonly RuleCollection[]): void {
  try {
    localStorage.setItem(RULE_COLLECTIONS_KEY, JSON.stringify(collections));
  } catch {
    /** ignore quota errors */
  }
}
