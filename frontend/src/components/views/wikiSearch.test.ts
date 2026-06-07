import { describe, expect, it } from 'vitest';
import { filterWikiTargets } from './wikiSearch';

describe('wikiSearch', () => {
  const targets = ['Alpha', 'Beta Note', 'Gamma'];

  it('returns all targets when query empty', () => {
    expect(filterWikiTargets('', targets)).toEqual(targets);
  });

  it('filters by prefix', () => {
    expect(filterWikiTargets('bet', targets)).toEqual(['Beta Note']);
  });

  it('is case insensitive', () => {
    expect(filterWikiTargets('ALPHA', targets)).toEqual(['Alpha']);
  });

  it('respects limit', () => {
    expect(filterWikiTargets('', targets, 2)).toHaveLength(2);
  });
});
