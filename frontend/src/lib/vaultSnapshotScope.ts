/**
 * K-88A — Canonical vault snapshot scope: delegates to portable extension collector.
 */
import {
  collectPortableHealthLocal,
  collectPortableVaultExtensions,
  type VaultPortableExtensions,
  type VaultPortableHealthLocal,
} from './vaultPortableExtensions';
import { LOCAL_STORAGE_KEYS, LOCAL_STORAGE_PREFIXES } from './storageInventory';

export interface VaultSnapshotCloudScope {
  plannerSchedules: 'cloud-only';
  workoutHistory: 'cloud-only';
  recipes: 'cloud-only';
  inbodyLogs: 'cloud-only';
  note: string;
}

export type VaultSnapshotHealthLocal = VaultPortableHealthLocal;

export interface VaultSnapshotExtensions extends VaultPortableExtensions {
  cloudScope: VaultSnapshotCloudScope;
  appSettings: VaultPortableExtensions['settings'];
  savedViews: VaultPortableExtensions['knowledge']['savedViews'];
  ruleCollections: VaultPortableExtensions['knowledge']['ruleCollections'];
  databaseViews: VaultPortableExtensions['knowledge']['databaseViews'];
  focusPresets: VaultPortableExtensions['knowledge']['focusPresets'];
  workspacePreferences: VaultPortableExtensions['knowledge']['workspacePreferences'];
  knowledgeHistory: VaultPortableExtensions['knowledge']['history'];
  healthLocal: VaultPortableHealthLocal;
}

export const collectHealthLocalSnapshot = collectPortableHealthLocal;

export function collectVaultSnapshotExtensions(): VaultSnapshotExtensions {
  const portable = collectPortableVaultExtensions();
  return {
    ...portable,
    appSettings: portable.settings,
    savedViews: portable.knowledge.savedViews,
    ruleCollections: portable.knowledge.ruleCollections,
    databaseViews: portable.knowledge.databaseViews,
    focusPresets: portable.knowledge.focusPresets,
    workspacePreferences: portable.knowledge.workspacePreferences,
    knowledgeHistory: portable.knowledge.history,
    healthLocal: portable.health,
    cloudScope: {
      plannerSchedules: 'cloud-only',
      workoutHistory: 'cloud-only',
      recipes: 'cloud-only',
      inbodyLogs: 'cloud-only',
      note: 'Cloud data is embedded in v3 portable export when authenticated; snapshots remain local-only.',
    },
  };
}

/** Keys excluded from snapshot payload (disposable / session / snapshot self). */
export const SNAPSHOT_EXCLUDED_KEY_PREFIXES = [
  'absinthe:vault-snapshot:',
  'absinthe-vault-restore-snapshot',
] as const;

export function isExcludedFromSnapshotKey(key: string): boolean {
  if (SESSION_EXCLUDED.has(key)) return true;
  return SNAPSHOT_EXCLUDED_KEY_PREFIXES.some(p => key.startsWith(p));
}

const SESSION_EXCLUDED = new Set<string>();

/** Live vault localStorage keys counted toward vault size (from K-88 inventory). */
export function listVaultStorageKeys(): string[] {
  const keys: string[] = [...LOCAL_STORAGE_KEYS];
  if (typeof localStorage === 'undefined') return keys;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || isExcludedFromSnapshotKey(key)) continue;
    if (LOCAL_STORAGE_PREFIXES.some(p => key.startsWith(p))) keys.push(key);
  }
  return [...new Set(keys)];
}
