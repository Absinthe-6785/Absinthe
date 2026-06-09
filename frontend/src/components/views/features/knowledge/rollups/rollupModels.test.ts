import { describe, it, expect } from 'vitest';
import {
  isRollupColumnDefinition,
  isRollupDefinition,
  rollupDefinitionFromLegacy,
  type RollupColumnDefinition,
  type RollupDefinition,
} from './rollupModels';

describe('rollupModels', () => {
  it('narrows valid rollup definitions', () => {
    const definition: RollupDefinition = {
      relationKey: 'course',
      direction: 'incoming',
      function: 'count',
    };
    expect(isRollupDefinition(definition)).toBe(true);
    expect(isRollupDefinition({ relationKey: 'course', direction: 'incoming' })).toBe(false);
  });

  it('narrows valid rollup column definitions', () => {
    const column: RollupColumnDefinition = {
      key: 'lectureCount',
      label: 'Lectures',
      visible: true,
      rollup: {
        relationKey: 'course',
        direction: 'incoming',
        function: 'count',
      },
    };
    expect(isRollupColumnDefinition(column)).toBe(true);
    expect(isRollupColumnDefinition({ key: 'x', visible: true, rollup: {} })).toBe(false);
  });

  it('maps legacy relation rollup config to canonical definition', () => {
    expect(rollupDefinitionFromLegacy({
      relationKey: 'lecture',
      aggregate: 'sum',
      field: 'hours',
    })).toEqual({
      relationKey: 'lecture',
      direction: 'incoming',
      function: 'sum',
      targetField: 'hours',
    });
  });

  it('documents phase 1 function set', () => {
    const functions: RollupDefinition['function'][] = [
      'count',
      'list',
      'latest',
      'sum',
      'first',
      'last',
    ];
    expect(functions).toHaveLength(6);
  });
});
