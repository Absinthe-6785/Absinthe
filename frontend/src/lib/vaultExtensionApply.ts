/**
 * K-88C — Apply portable vault extensions to localStorage.
 */
import { saveSavedViews } from '@/components/views/features/knowledge/views/savedViewsStorage';
import { saveRuleCollections } from '@/components/views/features/knowledge/collections/ruleCollectionsStorage';
import { saveDatabaseViews } from '@/components/views/features/knowledge/databaseViews/databaseViewsStorage';
import { saveFocusPresets } from '@/components/views/features/knowledge/workspace/focusPresetsStorage';
import { saveWorkspacePreferences } from '@/components/views/features/knowledge/workspace/workspacePreferencesStorage';
import { saveKnowledgeHistoryEvents } from '@/components/views/features/knowledge/history/historyStorage';
import { LOCAL_STORAGE_PREFIXES } from './storageInventory';
import type { VaultPortableExtensions } from './vaultPortableExtensions';
import { useAppStore } from '@/store/useAppStore';
import type { AppSettings } from '@/types';
import { mayRestore, recordRecoveryBlock } from './recoverySafetyPolicy';

export interface VaultExtensionApplyResult {
  applied: boolean;
  sections: string[];
  errors: string[];
  blocked?: true;
}

function clearPrefixedKeys(prefix: string): void {
  if (typeof localStorage === 'undefined') return;
  const toRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(prefix)) toRemove.push(key);
  }
  for (const key of toRemove) localStorage.removeItem(key);
}

function applyPrefixedKeys(prefix: string, entries: Record<string, string>): void {
  clearPrefixedKeys(prefix);
  for (const [suffix, value] of Object.entries(entries)) {
    localStorage.setItem(`${prefix}${suffix}`, value);
  }
}

function applyAppSettingsPersisted(settings: unknown): void {
  if (!settings || typeof settings !== 'object' || typeof localStorage === 'undefined') return;
  localStorage.setItem('planner-storage', JSON.stringify(settings));
  const parsed = settings as {
    state?: { appSettings?: Partial<AppSettings>; weightUnits?: Record<string, 'kg' | 'lbs'> };
    appSettings?: Partial<AppSettings>;
  };
  const appSettings = parsed.state?.appSettings ?? parsed.appSettings;
  const weightUnits = parsed.state?.weightUnits;
  if (appSettings) {
    useAppStore.setState(s => ({
      appSettings: { ...s.appSettings, ...appSettings },
      weightUnits: weightUnits ?? s.weightUnits,
    }));
  }
  void useAppStore.persist?.rehydrate?.();
}

export function applyVaultExtensionsRestore(
  extensions: VaultPortableExtensions | null | undefined,
): VaultExtensionApplyResult {
  const sections: string[] = [];
  const errors: string[] = [];

  if (!mayRestore()) {
    recordRecoveryBlock('restore');
    return { applied: false, sections, errors: ['recovery_mode_active'], blocked: true };
  }

  if (!extensions) {
    return { applied: false, sections, errors: ['no_extensions'] };
  }

  try {
    if (extensions.settings != null) {
      applyAppSettingsPersisted(extensions.settings);
      sections.push('settings');
    }

    if (extensions.knowledge) {
      const k = extensions.knowledge;
      if (Array.isArray(k.savedViews)) {
        saveSavedViews(k.savedViews);
        if (k.savedViews.length) sections.push('savedViews');
      }
      if (Array.isArray(k.ruleCollections)) {
        saveRuleCollections(k.ruleCollections);
        if (k.ruleCollections.length) sections.push('ruleCollections');
      }
      if (Array.isArray(k.databaseViews)) {
        saveDatabaseViews(k.databaseViews);
        if (k.databaseViews.length) sections.push('databaseViews');
      }
      if (Array.isArray(k.focusPresets)) {
        saveFocusPresets(k.focusPresets);
        if (k.focusPresets.length) sections.push('focusPresets');
      }
      if (k.workspacePreferences) {
        saveWorkspacePreferences(k.workspacePreferences);
        sections.push('workspacePreferences');
      }
      if (k.history && Array.isArray(k.history.events)) {
        saveKnowledgeHistoryEvents(k.history.events);
        if (k.history.events.length) sections.push('knowledgeHistory');
      }
    }

    if (extensions.health) {
      const h = extensions.health;
      if (h.splitCount != null) {
        localStorage.setItem('healthSplitCount', String(h.splitCount));
        sections.push('healthSplitCount');
      }
      if (h.routinePlannedSets) {
        localStorage.setItem('healthRoutinePlannedSets', JSON.stringify(h.routinePlannedSets));
        sections.push('routinePlannedSets');
      }
      if (h.recoveryLog) {
        localStorage.setItem('absinthe:recovery-log', JSON.stringify(h.recoveryLog));
        sections.push('recoveryLog');
      }
      if (h.proteinRecentSources) {
        localStorage.setItem('proteinRecentSources', JSON.stringify(h.proteinRecentSources));
        sections.push('proteinUx');
      }
      if (h.proteinSourceUseCounts) {
        localStorage.setItem('proteinSourceUseCounts', JSON.stringify(h.proteinSourceUseCounts));
        sections.push('proteinUx');
      }
      applyPrefixedKeys(LOCAL_STORAGE_PREFIXES[0], h.drafts ?? {});
      if (Object.keys(h.drafts ?? {}).length) sections.push('healthDrafts');
      applyPrefixedKeys(LOCAL_STORAGE_PREFIXES[1], h.memos ?? {});
      if (Object.keys(h.memos ?? {}).length) sections.push('healthMemos');
    }
  } catch (err) {
    errors.push(err instanceof Error ? err.message : 'extension_apply_failed');
  }

  return {
    applied: sections.length > 0 && errors.length === 0,
    sections: [...new Set(sections)],
    errors,
  };
}
