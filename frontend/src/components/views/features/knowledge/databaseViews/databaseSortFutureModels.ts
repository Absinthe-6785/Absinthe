/**
 * Knowledge-18.0 — Multi-column sort architecture types (normalization only).
 *
 * Runtime table sort remains single-rule until K-18+ implementation.
 */

import type { DatabaseViewSort } from './databaseViewModels';
import type { DatabaseViewSortRule } from './databasePresentationFutureModels';

export type { DatabaseViewSortRule };

const SORT_DIRECTIONS: readonly DatabaseViewSortRule['direction'][] = ['asc', 'desc'];

export function isDatabaseViewSortRule(value: unknown): value is DatabaseViewSortRule {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<DatabaseViewSortRule>;
  return typeof record.key === 'string'
    && record.key.trim().length > 0
    && record.direction !== undefined
    && (SORT_DIRECTIONS as readonly string[]).includes(record.direction);
}

/** Normalize sort rule list — drops invalid entries, preserves order */
export function normalizeDatabaseViewSortRules(raw: unknown): DatabaseViewSortRule[] | null {
  if (!Array.isArray(raw)) return null;
  const rules: DatabaseViewSortRule[] = [];
  for (const item of raw) {
    if (!isDatabaseViewSortRule(item)) continue;
    rules.push({
      key: item.key.trim(),
      direction: item.direction,
    });
  }
  return rules.length > 0 ? rules : null;
}

/** Bridge legacy single sort to multi-sort list — primary backward-compat path */
export function migrateLegacySortToSortRules(
  sort?: DatabaseViewSort,
  sortRules?: readonly DatabaseViewSortRule[],
): DatabaseViewSortRule[] {
  const normalized = sortRules ? normalizeDatabaseViewSortRules([...sortRules]) : null;
  if (normalized && normalized.length > 0) return normalized;

  if (sort && isDatabaseViewSortRule(sort)) {
    return [{ key: sort.key.trim(), direction: sort.direction }];
  }

  return [{ key: 'updatedAt', direction: 'desc' }];
}

/** Shorthand for first rule — mirrors planned sortRules[0] ↔ sort sync */
export function primarySortRule(rules: readonly DatabaseViewSortRule[]): DatabaseViewSort {
  const first = rules[0] ?? { key: 'updatedAt', direction: 'desc' as const };
  return { key: first.key, direction: first.direction };
}
