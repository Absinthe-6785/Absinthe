/**
 * K-88B — Shared portable vault extension collector (snapshots + export v3).
 */
import { loadSavedViews } from '@/components/views/features/knowledge/views/savedViewsStorage';
import { loadRuleCollections } from '@/components/views/features/knowledge/collections/ruleCollectionsStorage';
import { loadDatabaseViews } from '@/components/views/features/knowledge/databaseViews/databaseViewsStorage';
import { loadFocusPresets } from '@/components/views/features/knowledge/workspace/focusPresetsStorage';
import { loadWorkspacePreferences } from '@/components/views/features/knowledge/workspace/workspacePreferencesStorage';
import { loadKnowledgeHistoryPayload } from '@/components/views/features/knowledge/history/historyStorage';
import { LOCAL_STORAGE_PREFIXES } from './storageInventory';
import { VAULT_EXTENSIONS_SCHEMA_VERSION } from './vaultBackupConstants';

export interface VaultPortableHealthLocal {
  splitCount: number | null;
  routinePlannedSets: Record<string, unknown> | null;
  recoveryLog: Record<string, unknown> | null;
  proteinRecentSources: string[] | null;
  proteinSourceUseCounts: Record<string, number> | null;
  drafts: Record<string, string>;
  memos: Record<string, string>;
}

export interface VaultPortableKnowledgeExtensions {
  savedViews: ReturnType<typeof loadSavedViews>;
  ruleCollections: ReturnType<typeof loadRuleCollections>;
  databaseViews: ReturnType<typeof loadDatabaseViews>;
  focusPresets: ReturnType<typeof loadFocusPresets>;
  workspacePreferences: ReturnType<typeof loadWorkspacePreferences>;
  history: ReturnType<typeof loadKnowledgeHistoryPayload>;
}

export interface VaultPortableExtensions {
  schemaVersion: typeof VAULT_EXTENSIONS_SCHEMA_VERSION;
  settings: unknown | null;
  knowledge: VaultPortableKnowledgeExtensions;
  health: VaultPortableHealthLocal;
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

export function collectPortableHealthLocal(): VaultPortableHealthLocal {
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

export function collectPortableVaultExtensions(): VaultPortableExtensions {
  return {
    schemaVersion: VAULT_EXTENSIONS_SCHEMA_VERSION,
    settings: readJsonKey('planner-storage'),
    knowledge: {
      savedViews: loadSavedViews(),
      ruleCollections: loadRuleCollections(),
      databaseViews: loadDatabaseViews(),
      focusPresets: loadFocusPresets(),
      workspacePreferences: loadWorkspacePreferences(),
      history: loadKnowledgeHistoryPayload(),
    },
    health: collectPortableHealthLocal(),
  };
}

export const PORTABLE_VAULT_INCLUDED = [
  'notes',
  'blocks',
  'tags',
  'favorites',
  'classifications',
  'weak-topics',
  'relations',
  'wiki-links',
  'folders',
  'app-settings',
  'saved-views',
  'rule-collections',
  'database-views',
  'knowledge-history',
  'focus-presets',
  'workspace-preferences',
  'health-local',
] as const;

export const PORTABLE_VAULT_EXCLUDED = [
  'knowledge-index',
  'graph-layouts',
  'search-caches',
  'cosmos-caches',
  'session-navigation',
  'workspace-session-ui',
  'snapshot-payloads',
  'auth-session',
] as const;
