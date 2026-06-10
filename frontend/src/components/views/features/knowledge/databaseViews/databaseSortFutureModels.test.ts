import { describe, it, expect } from 'vitest';
import {
  isDatabaseViewSortRule,
  migrateLegacySortToSortRules,
  normalizeDatabaseViewSortRules,
  primarySortRule,
} from './databaseSortFutureModels';

describe('databaseSortFutureModels', () => {
  it('normalizes multi-sort rules', () => {
    expect(normalizeDatabaseViewSortRules([
      { key: ' status ', direction: 'asc' },
      { key: 'priority', direction: 'desc' },
      { key: '', direction: 'asc' },
    ])).toEqual([
      { key: 'status', direction: 'asc' },
      { key: 'priority', direction: 'desc' },
    ]);
  });

  it('migrates legacy single sort to sortRules', () => {
    expect(migrateLegacySortToSortRules({ key: 'title', direction: 'asc' })).toEqual([
      { key: 'title', direction: 'asc' },
    ]);
  });

  it('prefers explicit sortRules over legacy sort', () => {
    expect(migrateLegacySortToSortRules(
      { key: 'title', direction: 'asc' },
      [{ key: 'status', direction: 'desc' }, { key: 'updatedAt', direction: 'desc' }],
    )).toEqual([
      { key: 'status', direction: 'desc' },
      { key: 'updatedAt', direction: 'desc' },
    ]);
  });

  it('derives primary sort shorthand from rules', () => {
    expect(primarySortRule([
      { key: 'status', direction: 'asc' },
      { key: 'updatedAt', direction: 'desc' },
    ])).toEqual({ key: 'status', direction: 'asc' });
  });

  it('narrows sort rule objects', () => {
    expect(isDatabaseViewSortRule({ key: 'status', direction: 'asc' })).toBe(true);
    expect(isDatabaseViewSortRule({ key: '', direction: 'asc' })).toBe(false);
  });
});
