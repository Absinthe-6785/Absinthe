/**
 * K-88A — Canonical vault snapshot scope: collect local extensions, document cloud gaps.
 */
import { loadSavedViews } from '@/components/views/features/knowledge/views/savedViewsStorage';
import { loadRuleCollections } from '@/components/views/features/knowledge/collections/ruleCollectionsStorage';
import { loadDatabaseViews } from '@/components/views/features/knowledge/databaseViews/databaseViewsStorage';
import { loadFocusPresets } from '@/components/views/features/knowledge/workspace/focusPresetsStorage';
import { loadWorkspacePreferences } from '@/components/views/features/knowledge/workspace/workspacePreferencesStorage';
import { loadKnowledgeHistoryPayload } from '@/components/views/features/knowledge/history/historyStorage';
import { LOCAL_STORAGE_KEYS, LOCAL_STORAGE_PREFIXES } from './storageInventory';

export interface VaultSnapshotCloudScope {
  plannerSchedules: 'cloud-only';
  workoutHistory: 'cloud-only';
  recipes: 'cloud-only';
  inbodyLogs: 'cloud-only';
  note: string;
}

export interface VaultSnapshotHealthLocal {
  splitCount: number | null;
  routinePlannedSets: Record<string, unknown> | null;
  recoveryLog: Record<string, unknown> | null;
  proteinRecentSources: string[] | null;
  proteinSourceUseCounts: Record<string, number> | null;
  drafts: Record<string, string>;
  memos: Record<string, string>;
}

export interface VaultSnapshotExtensions {
  appSettings: unknown | null;
  savedViews: ReturnType<typeof loadSavedViews>;
  ruleCollections: ReturnType<typeof loadRuleCollections>;
  databaseViews: ReturnType<typeof loadDatabaseViews>;
  focusPresets: ReturnType<typeof loadFocusPresets>;
  workspacePreferences: ReturnType<typeof loadWorkspacePreferences>;
  knowledgeHistory: ReturnType<typeof loadKnowledgeHistoryPayload>;
  healthLocal: VaultSnapshotHealthLocal;
  cloudScope: VaultSnapshotCloudScope;
}

function readJsonKey(key: string): unknown | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function collectPrefixedKeys(prefix: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (typeof localStorage === 'undefined') return out;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(prefix)) continue;
    const value = localStorage.getItem(key);
    if (value != null) out[key.slice(prefix.length)] = value;
  }
  return out;
}

export function collectHealthLocalSnapshot(): VaultSnapshotHealthLocal {
  const splitRaw = typeof localStorage !== 'undefined' ? localStorage.getItem('healthSplitCount') : null;
  return {
    splitCount: splitRaw != null ? Number(splitRaw) : null,
    routinePlannedSets: readJsonKey('healthRoutinePlannedSets') as Record<string, unknown> | null,
    recoveryLog: readJsonKey('absinthe:recovery-log') as Record<string, unknown> | null,
    proteinRecentSources: readJsonKey('proteinRecentSources') as string[] | null,
    proteinSourceUseCounts: readJsonKey('proteinSourceUseCounts') as Record<string, number> | null,
    drafts: collectPrefixedKeys(LOCAL_STORAGE_PREFIXES[0]),
    memos: collectPrefixedKeys(LOCAL_STORAGE_PREFIXES[1]),
  };
}

export function collectVaultSnapshotExtensions(): VaultSnapshotExtensions {
  return {
    appSettings: readJsonKey('planner-storage'),
    savedViews: loadSavedViews(),
    ruleCollections: loadRuleCollections(),
    databaseViews: loadDatabaseViews(),
    focusPresets: loadFocusPresets(),
    workspacePreferences: loadWorkspacePreferences(),
    knowledgeHistory: loadKnowledgeHistoryPayload(),
    healthLocal: collectHealthLocalSnapshot(),
    cloudScope: {
      plannerSchedules: 'cloud-only',
      workoutHistory: 'cloud-only',
      recipes: 'cloud-only',
      inbodyLogs: 'cloud-only',
      note: 'Cloud data is not embedded in local snapshots; re-hydrate after restore when authenticated.',
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
