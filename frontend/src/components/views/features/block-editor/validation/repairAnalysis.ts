import type { ViolationCode } from './blockTreeValidator';

export type RepairAction =
  | 'regenerate_ids'
  | 'assign_id'
  | 'normalize_type'
  | 'insert_default_block'
  | 'clamp_indent'
  | 'reset_indent'
  | 'repair_table_shape'
  | 'move_out_of_toggle'
  | 'hoist_children'
  | 'strip_field'
  | 'assign_required_field'
  | 'renumber_lists'
  | 'unknown';

export interface RepairRecommendation {
  code: ViolationCode;
  action: RepairAction;
  description: string;
}

export const REPAIR_RECOMMENDATIONS: Record<ViolationCode, RepairRecommendation> = {
  MISSING_ID: {
    code: 'MISSING_ID',
    action: 'assign_id',
    description: 'Assign a new unique block id',
  },
  DUPLICATE_ID: {
    code: 'DUPLICATE_ID',
    action: 'regenerate_ids',
    description: 'Regenerate duplicate block ids',
  },
  UNKNOWN_TYPE: {
    code: 'UNKNOWN_TYPE',
    action: 'normalize_type',
    description: 'Normalize unknown block type to paragraph',
  },
  EMPTY_DOCUMENT: {
    code: 'EMPTY_DOCUMENT',
    action: 'insert_default_block',
    description: 'Insert a default paragraph block',
  },
  NEGATIVE_INDENT: {
    code: 'NEGATIVE_INDENT',
    action: 'clamp_indent',
    description: 'Clamp indent to zero',
  },
  INVALID_TABLE_SHAPE: {
    code: 'INVALID_TABLE_SHAPE',
    action: 'repair_table_shape',
    description: 'Repair table headers and row widths',
  },
  NON_NESTABLE_IN_TOGGLE: {
    code: 'NON_NESTABLE_IN_TOGGLE',
    action: 'move_out_of_toggle',
    description: 'Move block out of toggle children',
  },
  NON_TOGGLE_HAS_CHILDREN: {
    code: 'NON_TOGGLE_HAS_CHILDREN',
    action: 'hoist_children',
    description: 'Hoist children to sibling level',
  },
  STALE_LIST_FIELDS: {
    code: 'STALE_LIST_FIELDS',
    action: 'strip_field',
    description: 'Remove list fields that do not belong to the block type',
  },
  LIST_CONTINUITY: {
    code: 'LIST_CONTINUITY',
    action: 'renumber_lists',
    description: 'Renumber numbered list runs per indent level',
  },
  TYPE_FIELD_MISMATCH: {
    code: 'TYPE_FIELD_MISMATCH',
    action: 'strip_field',
    description: 'Strip mismatched fields or assign required fields',
  },
  INVALID_INDENT_RELATIONSHIP: {
    code: 'INVALID_INDENT_RELATIONSHIP',
    action: 'reset_indent',
    description: 'Reset indent to zero for non-list block types',
  },
};

export function getRepairRecommendation(code: ViolationCode): RepairRecommendation {
  return REPAIR_RECOMMENDATIONS[code] ?? {
    code,
    action: 'unknown',
    description: 'No repair recommendation available',
  };
}

export function hasRepairRecommendation(code: ViolationCode): boolean {
  return code in REPAIR_RECOMMENDATIONS;
}
