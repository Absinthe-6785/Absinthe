// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  activateSavedView,
  createSavedView,
  deleteSavedView,
  findSavedView,
  isValidSavedViewQuery,
  normalizeSavedViews,
  renameSavedView,
} from './savedViews';
import { loadSavedViews, saveSavedViews, SAVED_VIEWS_KEY } from './savedViewsStorage';

describe('isValidSavedViewQuery', () => {
  it('accepts valid knowledge queries', () => {
    expect(isValidSavedViewQuery('tag:japanese')).toBe(true);
    expect(isValidSavedViewQuery('tag:japanese status:active')).toBe(true);
  });

  it('rejects plain text and invalid syntax', () => {
    expect(isValidSavedViewQuery('hello')).toBe(false);
    expect(isValidSavedViewQuery('tag:japanese invalid')).toBe(false);
  });
});

describe('normalizeSavedViews', () => {
  it('filters invalid entries and sorts by name', () => {
    const views = normalizeSavedViews([
      { id: '2', name: 'Beta', query: 'status:active' },
      { id: '1', name: 'Alpha', query: 'tag:japanese' },
      { id: 'bad', name: '', query: 'tag:x' },
      { id: 'bad2', name: 'Bad', query: 'not valid' },
      'invalid',
    ]);

    expect(views).toEqual([
      { id: '1', name: 'Alpha', query: 'tag:japanese' },
      { id: '2', name: 'Beta', query: 'status:active' },
    ]);
  });

  it('returns empty array for non-array input', () => {
    expect(normalizeSavedViews(null)).toEqual([]);
  });
});

describe('saved view CRUD', () => {
  const seed = [{ id: 'a', name: 'Alpha', query: 'tag:japanese' }];

  it('creates a saved view', () => {
    const next = createSavedView(seed, 'Active Notes', 'status:active');
    expect(next).toHaveLength(2);
    expect(findSavedView(next, next.find(v => v.name === 'Active Notes')!.id)).toMatchObject({
      name: 'Active Notes',
      query: 'status:active',
    });
  });

  it('rejects invalid queries on create', () => {
    expect(createSavedView(seed, 'Bad', 'hello')).toEqual(seed);
  });

  it('renames a saved view', () => {
    const next = renameSavedView(seed, 'a', 'Japanese Notes');
    expect(findSavedView(next, 'a')?.name).toBe('Japanese Notes');
  });

  it('deletes a saved view', () => {
    expect(deleteSavedView(seed, 'a')).toEqual([]);
  });

  it('activates by returning the stored query', () => {
    expect(activateSavedView(seed[0])).toBe('tag:japanese');
  });
});

describe('savedViewsStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('persists and loads saved views', () => {
    const views = [{ id: '1', name: 'JLPT Study', query: 'tag:japanese status:active' }];
    saveSavedViews(views);
    expect(loadSavedViews()).toEqual(views);
  });

  it('returns empty list when storage is missing', () => {
    expect(loadSavedViews()).toEqual([]);
  });

  it('ignores corrupted storage', () => {
    localStorage.setItem(SAVED_VIEWS_KEY, '{not json');
    expect(loadSavedViews()).toEqual([]);
  });

  it('round-trips through JSON serialization', () => {
    saveSavedViews([
      { id: '1', name: 'Textbooks', query: 'tag:textbook' },
      { id: '2', name: 'High Priority', query: 'priority:high' },
    ]);
    const raw = localStorage.getItem(SAVED_VIEWS_KEY);
    expect(JSON.parse(raw!)).toHaveLength(2);
    expect(loadSavedViews().map(view => view.name).sort()).toEqual(['High Priority', 'Textbooks']);
  });
});

describe('query synchronization', () => {
  it('keeps saved query strings compatible with parseQuery', async () => {
    const { parseQuery } = await import('../query/parseQuery');
    const view = createSavedView([], 'Active Japanese Notes', 'tag:japanese status:active')[0];
    const parsed = parseQuery(activateSavedView(view));
    expect(parsed.error).toBeUndefined();
    expect(parsed.clauses).toHaveLength(2);
  });
});

describe('backward compatibility', () => {
  it('migrates legacy objects without throwing', () => {
    expect(normalizeSavedViews(undefined)).toEqual([]);
    expect(normalizeSavedViews([{ id: 'x', name: 'Old', query: 'tag:legacy' }])).toHaveLength(1);
  });
});
