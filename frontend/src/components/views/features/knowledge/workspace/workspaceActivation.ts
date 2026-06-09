import type { SmartCollection } from '../collections/smartCollectionModels';
import { activateSmartCollection } from '../collections/smartCollections';
import type { RuleCollection } from '../collections/ruleCollectionModels';
import { activateRuleCollection } from '../collections/ruleCollections';
import type { DatabaseView } from '../databaseViews/databaseViewModels';
import { activateDatabaseView } from '../databaseViews/databaseViews';
import type { SavedView } from '../views/savedViewModels';
import { activateSavedView } from '../views/savedViews';
import { INACTIVE_WORKSPACE, type WorkspaceActivation } from './workspaceModels';

export interface WorkspaceActivateResult {
  activation: WorkspaceActivation;
  searchQuery: string;
}

/** Reset competing workspace state and activate a saved view (search-bound) */
export function activateSavedViewWorkspace(view: SavedView): WorkspaceActivateResult {
  return {
    activation: { kind: 'saved-view', id: view.id },
    searchQuery: activateSavedView(view),
  };
}

/** Activate smart collection — clears search query */
export function activateSmartCollectionWorkspace(collection: SmartCollection): WorkspaceActivateResult {
  return {
    activation: { kind: 'smart-collection', id: activateSmartCollection(collection) },
    searchQuery: '',
  };
}

/** Activate rule collection — clears search query */
export function activateRuleCollectionWorkspace(collection: RuleCollection): WorkspaceActivateResult {
  return {
    activation: { kind: 'rule-collection', id: activateRuleCollection(collection) },
    searchQuery: '',
  };
}

/** Activate database view — clears search query */
export function activateDatabaseViewWorkspace(view: DatabaseView): WorkspaceActivateResult {
  return {
    activation: activateDatabaseView(view),
    searchQuery: '',
  };
}

export function clearWorkspaceActivation(): WorkspaceActivateResult {
  return {
    activation: INACTIVE_WORKSPACE,
    searchQuery: '',
  };
}

export function clearWorkspaceSearchBinding(): WorkspaceActivateResult {
  return {
    activation: INACTIVE_WORKSPACE,
    searchQuery: '',
  };
}

/** Whether activation highlights a sidebar item of the given kind */
export function isWorkspaceKindActive(
  activation: WorkspaceActivation,
  kind: WorkspaceActivation['kind'],
  id?: string,
): boolean {
  if (activation.kind !== kind) return false;
  if (id === undefined) return true;
  return activation.id === id;
}
