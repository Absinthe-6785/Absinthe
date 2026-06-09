import { describe, expect, it } from 'vitest';
import type { ViolationCode } from './blockTreeValidator';
import {
  REPAIR_RECOMMENDATIONS,
  getRepairRecommendation,
  hasRepairRecommendation,
} from './repairAnalysis';

const ALL_CODES: ViolationCode[] = [
  'MISSING_ID',
  'DUPLICATE_ID',
  'UNKNOWN_TYPE',
  'EMPTY_DOCUMENT',
  'NEGATIVE_INDENT',
  'INVALID_TABLE_SHAPE',
  'NON_NESTABLE_IN_TOGGLE',
  'NON_TOGGLE_HAS_CHILDREN',
  'STALE_LIST_FIELDS',
  'LIST_CONTINUITY',
  'TYPE_FIELD_MISMATCH',
  'INVALID_INDENT_RELATIONSHIP',
];

describe('repairAnalysis', () => {
  it('defines a repair recommendation for every violation code', () => {
    for (const code of ALL_CODES) {
      expect(hasRepairRecommendation(code)).toBe(true);
      expect(REPAIR_RECOMMENDATIONS[code].code).toBe(code);
      expect(REPAIR_RECOMMENDATIONS[code].action).not.toBe('unknown');
      expect(REPAIR_RECOMMENDATIONS[code].description.length).toBeGreaterThan(0);
    }
  });

  it('maps DUPLICATE_ID to regenerate_ids', () => {
    expect(getRepairRecommendation('DUPLICATE_ID')).toEqual({
      code: 'DUPLICATE_ID',
      action: 'regenerate_ids',
      description: 'Regenerate duplicate block ids',
    });
  });

  it('maps NON_TOGGLE_HAS_CHILDREN to hoist_children', () => {
    expect(getRepairRecommendation('NON_TOGGLE_HAS_CHILDREN').action).toBe('hoist_children');
  });

  it('maps LIST_CONTINUITY to renumber_lists', () => {
    expect(getRepairRecommendation('LIST_CONTINUITY')).toEqual({
      code: 'LIST_CONTINUITY',
      action: 'renumber_lists',
      description: 'Renumber numbered list runs per indent level',
    });
  });

  it('maps TYPE_FIELD_MISMATCH to strip_field', () => {
    expect(getRepairRecommendation('TYPE_FIELD_MISMATCH').action).toBe('strip_field');
  });

  it('maps INVALID_INDENT_RELATIONSHIP to reset_indent', () => {
    expect(getRepairRecommendation('INVALID_INDENT_RELATIONSHIP').action).toBe('reset_indent');
  });

  it('returns unknown fallback for unrecognized codes', () => {
    expect(getRepairRecommendation('NOT_A_REAL_CODE' as ViolationCode)).toEqual({
      code: 'NOT_A_REAL_CODE',
      action: 'unknown',
      description: 'No repair recommendation available',
    });
  });
});
