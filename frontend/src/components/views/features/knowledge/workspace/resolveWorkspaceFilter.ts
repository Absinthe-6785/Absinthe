import type { NoteBase } from '../../../noteUtils';
import type { KnowledgeIndexService } from '../KnowledgeIndexService';
import { filterByRuleCollection } from '../collections/filterByRuleCollection';
import type { RuleCollection } from '../collections/ruleCollectionModels';
import { findRuleCollection } from '../collections/ruleCollections';
import type { FormulaColumnDefinition } from '../formulas/formulaModels';
import { filterBySmartCollection } from '../collections/filterBySmartCollection';
import type { SmartCollectionId } from '../collections/smartCollectionModels';
import type { WorkspaceActivation } from './workspaceModels';
import { INACTIVE_WORKSPACE, WORKSPACE_FILTER_SOURCE, type WorkspaceFilterSource } from './workspaceModels';

export interface WorkspaceFilterContext {
  service: KnowledgeIndexService;
  vaultNotes: readonly NoteBase[];
  ruleCollections: readonly RuleCollection[];
  formulaColumns?: readonly FormulaColumnDefinition[];
}

/**
 * Apply list-scoping workspace filters (smart collection, rule collection).
 * Saved views use searchQuery; database views use DatabaseViewPanel.
 */
export function applyWorkspaceListFilter(
  notes: readonly NoteBase[],
  activation: WorkspaceActivation,
  context: WorkspaceFilterContext,
): NoteBase[] {
  switch (activation.kind) {
    case 'smart-collection':
      return filterBySmartCollection(
        notes,
        context.service,
        activation.id as SmartCollectionId,
        context.vaultNotes,
      ).notes;
    case 'rule-collection': {
      const collection = findRuleCollection(context.ruleCollections, activation.id);
      if (!collection) return [...notes];
      return filterByRuleCollection(notes, context.service, collection, {
        formulaColumns: context.formulaColumns,
      }).notes;
    }
    default:
      return [...notes];
  }
}

/** Resolve the filter strategy for an activation — single dispatch metadata path */
export function getWorkspaceFilterSource(activation: WorkspaceActivation): WorkspaceFilterSource {
  if (activation.kind === 'none' || activation.kind === 'dashboard') return 'none';
  return WORKSPACE_FILTER_SOURCE[activation.kind];
}

export function isDatabaseViewActive(activation: WorkspaceActivation): boolean {
  return activation.kind === 'database-view';
}

export function isDashboardActive(activation: WorkspaceActivation): boolean {
  return activation.kind === 'dashboard';
}

export function getWorkspaceActiveId(activation: WorkspaceActivation): string | null {
  if (activation.kind === 'none' || activation.kind === 'dashboard') return null;
  return activation.id;
}

export function getWorkspaceActiveKind(activation: WorkspaceActivation): WorkspaceActivation['kind'] {
  return activation.kind;
}
