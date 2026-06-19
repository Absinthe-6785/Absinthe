import {
  isUserNamedSmartCollection,
  resolveSmartCollectionGroupLabel,
  resolveSmartCollectionName,
  SMART_COLLECTION_GROUP_LABEL_KEYS,
} from './features/knowledge/collections/smartCollectionLabels';
import { SMART_COLLECTIONS } from './features/knowledge/collections/smartCollections';

/** K-108A — Smart collection localization audit. */
export const K108A_SMART_COLLECTION_HOOKS = [
  'data-k108-smart-collections',
  'data-k108-smart-collection-row',
] as const;

export const K108A_SYSTEM_COLLECTION_IDS = SMART_COLLECTIONS
  .filter(c => !isUserNamedSmartCollection(c.id))
  .map(c => c.id);

export const K108A_SUBJECT_COLLECTION_IDS = SMART_COLLECTIONS
  .filter(c => isUserNamedSmartCollection(c.id))
  .map(c => c.id);

export function auditSmartCollections(): {
  hooks: readonly string[];
  systemIds: readonly string[];
  subjectIds: readonly string[];
  groupKeys: readonly string[];
} {
  return {
    hooks: K108A_SMART_COLLECTION_HOOKS,
    systemIds: K108A_SYSTEM_COLLECTION_IDS,
    subjectIds: K108A_SUBJECT_COLLECTION_IDS,
    groupKeys: Object.keys(SMART_COLLECTION_GROUP_LABEL_KEYS),
  };
}

export { resolveSmartCollectionName, resolveSmartCollectionGroupLabel, isUserNamedSmartCollection };

export function formatK108aSmartCollectionReport(result: ReturnType<typeof auditSmartCollections>): string {
  return [
    'K-108A smart collection audit',
    '',
    'UI hooks:',
    ...result.hooks.map(h => `  ${h}`),
    '',
    `System presets (i18n): ${result.systemIds.length}`,
    `Subject workspaces (stored names): ${result.subjectIds.length}`,
  ].join('\n');
}
