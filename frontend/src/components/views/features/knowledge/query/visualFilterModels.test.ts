import { describe, it, expect } from 'vitest';
import { parseQuery } from './parseQuery';
import {
  compileFilterConditionToClause,
  compileVisualFilterToQueryString,
  isVisualFilterModel,
  mergeQueryWithVisualFilter,
  normalizeVisualFilterModel,
  type VisualFilterModel,
} from './visualFilterModels';

describe('visualFilterModels', () => {
  it('compiles property and tag conditions to query clauses', () => {
    expect(compileFilterConditionToClause({
      kind: 'property',
      field: 'status',
      operator: '=',
      value: 'active',
    })).toEqual({ type: 'property', key: 'status', value: 'active' });

    expect(compileFilterConditionToClause({
      kind: 'tag',
      value: 'japanese',
    })).toEqual({ type: 'tag', value: 'japanese' });
  });

  it('compiles formula conditions with comparison operators', () => {
    expect(compileFilterConditionToClause({
      kind: 'formula',
      field: 'completionRate',
      operator: '>',
      value: 80,
    })).toEqual({
      type: 'formula',
      key: 'completionRate',
      operator: '>',
      value: 80,
    });
  });

  it('compiles a visual model to canonical query string', () => {
    const model: VisualFilterModel = {
      groups: [{
        logic: 'and',
        conditions: [
          { kind: 'tag', value: 'japanese' },
          { kind: 'property', field: 'status', operator: '=', value: 'active' },
          { kind: 'formula', field: 'progress', operator: '>', value: 80 },
        ],
      }],
    };

    expect(compileVisualFilterToQueryString(model)).toBe(
      'tag:japanese status:active formula:progress>80',
    );
    expect(parseQuery(compileVisualFilterToQueryString(model)).error).toBeUndefined();
  });

  it('normalizes and validates visual filter models', () => {
    const normalized = normalizeVisualFilterModel({
      groups: [{
        logic: 'and',
        conditions: [
          { kind: 'property', field: ' status ', operator: '=', value: 'active' },
          { kind: 'formula', field: 'score', operator: '>', value: 'not-a-number' },
        ],
      }],
    });

    expect(normalized).toEqual({
      groups: [{
        logic: 'and',
        conditions: [
          { kind: 'property', field: 'status', operator: '=', value: 'active' },
        ],
      }],
    });
    expect(isVisualFilterModel(normalized)).toBe(true);
  });

  it('merges base database query with ephemeral visual filters', () => {
    const model: VisualFilterModel = {
      groups: [{
        logic: 'and',
        conditions: [
          { kind: 'property', field: 'priority', operator: '=', value: 'high' },
        ],
      }],
    };

    expect(mergeQueryWithVisualFilter('tag:japanese', model)).toBe(
      'tag:japanese priority:high',
    );
  });
});
