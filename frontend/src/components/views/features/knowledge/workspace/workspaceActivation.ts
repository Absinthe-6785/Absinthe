import type { SmartCollection } from '../collections/smartCollectionModels';
import { activateSmartCollection } from '../collections/smartCollections';
import type { RuleCollection } from '../collections/ruleCollectionModels';
import { activateRuleCollection } from '../collections/ruleCollections';
import type { DatabaseView } from '../databaseViews/databaseViewModels';
import { activateDatabaseView } from '../databaseViews/databaseViews';
import type { SavedView } from '../views/savedViewModels';
import { activateSavedView, findSavedView } from '../views/savedViews';
import { INACTIVE_WORKSPACE, type WorkspaceActivation, type WorkspaceItemKind } from './workspaceModels';

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

/** Activate workspace dashboard — clears search query */
export function activateDashboardWorkspace(): WorkspaceActivateResult {
  return {
    activation: { kind: 'dashboard' },
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
  if (activation.kind === 'none' || activation.kind === 'dashboard') return false;
  return activation.id === id;
}

/** Clear activation when the active workspace item is deleted */
export function clearWorkspaceActivationForItem(
  activation: WorkspaceActivation,
  kind: Exclude<WorkspaceItemKind, never>,
  id: string,
): WorkspaceActivation {
  if (activation.kind !== kind) return activation;
  if ('id' in activation && activation.id === id) return INACTIVE_WORKSPACE;
  return activation;
}

/** Deactivate saved-view binding when query diverges or the view is removed */
export function reconcileSavedViewActivation(
  activation: WorkspaceActivation,
  savedViews: readonly SavedView[],
  searchQuery: string,
): WorkspaceActivation {
  if (activation.kind !== 'saved-view') return activation;
  const view = findSavedView(savedViews, activation.id);
  if (!view || view.query !== searchQuery.trim()) {
    return INACTIVE_WORKSPACE;
  }
  return activation;
}
