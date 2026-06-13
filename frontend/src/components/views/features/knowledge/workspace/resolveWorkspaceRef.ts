import type { Language } from '../../../../../lib/i18n';
import { findSmartCollection, SMART_COLLECTIONS } from '../collections/smartCollections';
import type { RuleCollection } from '../collections/ruleCollectionModels';
import { findRuleCollection } from '../collections/ruleCollections';
import type { DatabaseView } from '../databaseViews/databaseViewModels';
import { findDatabaseView } from '../databaseViews/databaseViews';
import { presentationLabel } from '../databaseViews/databasePresentationMeta';
import type { SavedView } from '../views/savedViewModels';
import { findSavedView } from '../views/savedViews';
import {
  activateDatabaseViewWorkspace,
  activateRuleCollectionWorkspace,
  activateSavedViewWorkspace,
  activateSmartCollectionWorkspace,
  type WorkspaceActivateResult,
} from './workspaceActivation';
import {
  INACTIVE_WORKSPACE,
  type WorkspaceActivation,
  type WorkspaceItemKind,
  type WorkspaceRef,
} from './workspaceModels';

export interface WorkspaceResolveContext {
  savedViews: readonly SavedView[];
  ruleCollections: readonly RuleCollection[];
  databaseViews: readonly DatabaseView[];
  language?: Language;
}

export function isValidWorkspaceRef(
  kind: WorkspaceItemKind,
  id: string,
  context: WorkspaceResolveContext,
): boolean {
  return resolveWorkspaceRef({ kind, id }, context) !== null;
}

export function resolveWorkspaceRef(
  ref: Pick<WorkspaceRef, 'kind' | 'id'>,
  context: WorkspaceResolveContext,
): WorkspaceRef | null {
  const id = ref.id.trim();
  if (!id) return null;

  switch (ref.kind) {
    case 'saved-view': {
      const view = findSavedView(context.savedViews, id);
      if (!view) return null;
      return { kind: 'saved-view', id: view.id, name: view.name, subtitle: view.query };
    }
    case 'rule-collection': {
      const collection = findRuleCollection(context.ruleCollections, id);
      if (!collection) return null;
      return { kind: 'rule-collection', id: collection.id, name: collection.name, subtitle: collection.query };
    }
    case 'database-view': {
      const view = findDatabaseView(context.databaseViews, id);
      if (!view) return null;
      return {
        kind: 'database-view',
        id: view.id,
        name: view.name,
        subtitle: `${view.query} · ${presentationLabel(view.presentation, context.language)}`,
      };
    }
    case 'smart-collection': {
      const collection = findSmartCollection(id);
      if (!collection) return null;
      return {
        kind: 'smart-collection',
        id: collection.id,
        name: collection.name,
        subtitle: collection.description,
      };
    }
    default:
      return null;
  }
}

export function restoreWorkspaceActivation(
  activation: WorkspaceActivation,
  context: WorkspaceResolveContext,
): WorkspaceActivateResult | null {
  if (activation.kind === 'none') return null;
  if (activation.kind === 'dashboard') {
    return { activation: { kind: 'dashboard' }, searchQuery: '' };
  }

  switch (activation.kind) {
    case 'saved-view': {
      const view = findSavedView(context.savedViews, activation.id);
      return view ? activateSavedViewWorkspace(view) : null;
    }
    case 'rule-collection': {
      const collection = findRuleCollection(context.ruleCollections, activation.id);
      return collection ? activateRuleCollectionWorkspace(collection) : null;
    }
    case 'database-view': {
      const view = findDatabaseView(context.databaseViews, activation.id);
      return view ? activateDatabaseViewWorkspace(view) : null;
    }
    case 'smart-collection': {
      const collection = findSmartCollection(activation.id);
      return collection ? activateSmartCollectionWorkspace(collection) : null;
    }
    default:
      return null;
  }
}

export function workspaceRefFromActivation(
  activation: WorkspaceActivation,
  context: WorkspaceResolveContext,
): WorkspaceRef | null {
  if (activation.kind === 'none' || activation.kind === 'dashboard') return null;
  return resolveWorkspaceRef({ kind: activation.kind, id: activation.id }, context);
}

/** @internal for tests */
export { SMART_COLLECTIONS };
