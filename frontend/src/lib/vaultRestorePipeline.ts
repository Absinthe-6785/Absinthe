import type { NoteBase } from '@/components/views/noteUtils';
import type { NoteFolder } from '@/store/useNotesStore';
import type { VaultBackupManifest } from './exportVaultBackup';
import { isVaultBackupManifestV3, upgradeVaultBackupToV3 } from './exportVaultBackup';
import {
  buildVaultRestorePreview,
  type VaultRestoreConflictStrategy,
  type VaultRestorePreview,
  type VaultRestoreResult,
  type VaultRestoreSelection,
  filterManifestBySelection,
} from './importVaultBackup';
import { validateVaultExportManifest } from './vaultExportValidate';
import { applyVaultExtensionsRestore } from './vaultExtensionApply';
import { applyCloudRestore } from './vaultCloudRestore';
import { createLastSnapshot } from './vaultSnapshotAuto';
import type { VaultSnapshot } from './vaultSnapshotBuild';
import { assessSnapshotRestoreReadiness } from './vaultSnapshotValidate';
import type { VaultPortableExtensions } from './vaultPortableExtensions';
import {
  LOCAL_CORE_JSON_RESTORE_OPERATION,
  LOCAL_CORE_JSON_RESTORE_VALIDATION,
  RecoveryModeBlockedError,
  assertCurrentOperationEpoch,
  captureOperationEpoch,
  mayRestore,
  mayRestoreLocalCoreJsonBackup,
  recordRecoveryBlock,
  type LocalCoreJsonRestoreAuthorizationInput,
} from './recoverySafetyPolicy';
import { resolveNotesRuntimeSyncMode } from './syncMode';
import type { VaultHealthRestoreAuthority } from './vaultExtensionApply';
import {
  isVaultBackupCoverage,
  protectionForVaultBackupCoverage,
  type VaultBackupCoverage,
} from './vaultBackupCoverage';

export const LAST_VAULT_EXPORT_KEY = 'absinthe:last-vault-export:v1';

export interface VaultRestoreImpact {
  noteCount: number;
  folderCount: number;
  relationCount: number;
  savedViewCount: number;
  ruleCollectionCount: number;
  databaseViewCount: number;
  focusPresetCount: number;
  hasKnowledgeHistory: boolean;
  healthDraftCount: number;
  healthMemoCount: number;
  hasRoutinePlannedSets: boolean;
  hasSettings: boolean;
  cloudCompleteness: string | null;
  cloudScheduleCount: number;
  cloudWorkoutCount: number;
  cloudInbodyCount: number;
  cloudRecipeCount: number;
  schemaVersion: number;
  source: 'export' | 'snapshot';
}

export interface VaultRestorePipelineOptions {
  strategy: VaultRestoreConflictStrategy;
  selection: VaultRestoreSelection;
  restoreCore: boolean;
  restoreExtensions: boolean;
  restoreCloud: boolean;
  backupBeforeRestore: boolean;
  healthAuthority?: VaultHealthRestoreAuthority;
}

export interface VaultRestorePipelineResult {
  core: VaultRestoreResult | null;
  extensions: ReturnType<typeof applyVaultExtensionsRestore> | null;
  cloud: Awaited<ReturnType<typeof applyCloudRestore>> | null;
  backedUp: boolean;
}

export interface FullVaultRestorePreview {
  core: VaultRestorePreview;
  impact: VaultRestoreImpact;
  exportValidation: ReturnType<typeof validateVaultExportManifest>;
}

export function resolveInitialVaultRestoreStrategy(
  preview: Pick<VaultRestorePreview, 'valid' | 'conflictCount'>,
): VaultRestoreConflictStrategy {
  return preview.valid && preview.conflictCount === 0 ? 'replace' : 'skip';
}

function isValidVaultRestoreManifest(manifest: VaultBackupManifest): boolean {
  try {
    return validateVaultExportManifest(manifest).valid;
  } catch {
    return false;
  }
}

function selectedNoteCount(options: VaultRestorePipelineOptions): number {
  try {
    const size = options.selection?.noteIds?.size;
    return typeof size === 'number' && Number.isSafeInteger(size) && size > 0 ? size : 0;
  } catch {
    return 0;
  }
}

export interface LastVaultExportRecord {
  exportedAt: string;
  coverage: VaultBackupCoverage | null;
}

export function recordLastVaultExport(
  timestamp = new Date().toISOString(),
  coverage?: VaultBackupCoverage,
): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(LAST_VAULT_EXPORT_KEY, JSON.stringify({ exportedAt: timestamp, coverage }));
  } catch { /**/ }
}

export function getLastVaultExportRecord(): LastVaultExportRecord | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LAST_VAULT_EXPORT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { exportedAt?: unknown; coverage?: unknown };
    if (typeof parsed.exportedAt !== 'string') return null;
    return {
      exportedAt: parsed.exportedAt,
      coverage: isVaultBackupCoverage(parsed.coverage) ? parsed.coverage : null,
    };
  } catch {
    return null;
  }
}

export function getLastVaultExportAt(): string | null {
  return getLastVaultExportRecord()?.exportedAt ?? null;
}

export function portableExtensionsFromSnapshot(snapshot: VaultSnapshot): VaultPortableExtensions {
  const ext = snapshot.extensions;
  return {
    schemaVersion: ext.schemaVersion,
    settings: ext.settings ?? ext.appSettings ?? null,
    knowledge: {
      savedViews: ext.knowledge?.savedViews ?? ext.savedViews ?? [],
      ruleCollections: ext.knowledge?.ruleCollections ?? ext.ruleCollections ?? [],
      databaseViews: ext.knowledge?.databaseViews ?? ext.databaseViews ?? [],
      focusPresets: ext.knowledge?.focusPresets ?? ext.focusPresets ?? [],
      workspacePreferences: ext.knowledge?.workspacePreferences ?? ext.workspacePreferences,
      history: ext.knowledge?.history ?? ext.knowledgeHistory,
    },
    health: ext.health ?? ext.healthLocal,
  };
}

export function manifestFromSnapshot(snapshot: VaultSnapshot): VaultBackupManifest {
  const readiness = assessSnapshotRestoreReadiness(snapshot);
  const manifest = readiness.manifest;
  if (!manifest.extensions) {
    manifest.extensions = portableExtensionsFromSnapshot(snapshot);
  }
  if (!isVaultBackupManifestV3(manifest)) {
    return upgradeVaultBackupToV3(manifest);
  }
  return manifest;
}

export function buildVaultRestoreImpact(
  manifest: VaultBackupManifest,
  source: 'export' | 'snapshot' = 'export',
): VaultRestoreImpact {
  const ext = manifest.extensions;
  const cloud = manifest.cloud;
  return {
    noteCount: manifest.noteCount ?? manifest.notes.length,
    folderCount: manifest.folderCount ?? manifest.folders.length,
    relationCount: manifest.relationCount ?? 0,
    savedViewCount: ext?.knowledge.savedViews?.length ?? 0,
    ruleCollectionCount: ext?.knowledge.ruleCollections?.length ?? 0,
    databaseViewCount: ext?.knowledge.databaseViews?.length ?? 0,
    focusPresetCount: ext?.knowledge.focusPresets?.length ?? 0,
    hasKnowledgeHistory: Boolean(ext?.knowledge.history?.events?.length),
    healthDraftCount: Object.keys(ext?.health.drafts ?? {}).length,
    healthMemoCount: Object.keys(ext?.health.memos ?? {}).length,
    hasRoutinePlannedSets: Boolean(ext?.health.routinePlannedSets),
    hasSettings: ext?.settings != null,
    cloudCompleteness: cloud?.completeness ?? null,
    cloudScheduleCount: cloud?.planner.schedules?.length ?? 0,
    cloudWorkoutCount: cloud?.health.workoutLogs?.length ?? 0,
    cloudInbodyCount: cloud?.health.inbodyLogs?.length ?? 0,
    cloudRecipeCount: cloud?.planner.recipes?.length ?? 0,
    schemaVersion: manifest.schemaVersion,
    source,
  };
}

export function buildFullVaultRestorePreview(
  manifest: VaultBackupManifest,
  existingNotes: readonly NoteBase[],
  existingFolders: readonly NoteFolder[],
  source: 'export' | 'snapshot' = 'export',
): FullVaultRestorePreview {
  return {
    core: buildVaultRestorePreview(manifest, existingNotes, existingFolders),
    impact: buildVaultRestoreImpact(manifest, source),
    exportValidation: validateVaultExportManifest(manifest),
  };
}

export interface VaultRestorePipelineDeps {
  importCore: (
    manifest: VaultBackupManifest,
    strategy: VaultRestoreConflictStrategy,
  ) => VaultRestoreResult | PromiseLike<VaultRestoreResult>;
  getNotes: () => NoteBase[];
  getFolders: () => NoteFolder[];
}

export async function executeVaultRestorePipeline(
  manifest: VaultBackupManifest,
  options: VaultRestorePipelineOptions,
  deps: VaultRestorePipelineDeps,
): Promise<VaultRestorePipelineResult> {
  const authorizationInput = {
    operation: LOCAL_CORE_JSON_RESTORE_OPERATION,
    syncMode: resolveNotesRuntimeSyncMode(),
    strategy: options.strategy,
    createVerifiedSnapshot: options.backupBeforeRestore,
    restoreCore: options.restoreCore,
    restoreExtensions: options.restoreExtensions,
    restoreCloud: options.restoreCloud,
    backupValidation: isValidVaultRestoreManifest(manifest)
      ? LOCAL_CORE_JSON_RESTORE_VALIDATION
      : 'invalid',
    selectedNoteCount: selectedNoteCount(options),
  } satisfies LocalCoreJsonRestoreAuthorizationInput;
  const allowed = mayRestoreLocalCoreJsonBackup(authorizationInput) || mayRestore();
  if (!allowed) {
    recordRecoveryBlock('restore');
    throw new RecoveryModeBlockedError('restore');
  }
  const operationEpoch = captureOperationEpoch();
  let backedUp = false;
  if (options.backupBeforeRestore) {
    assertCurrentOperationEpoch(operationEpoch, 'restore');
    createLastSnapshot(deps.getNotes(), deps.getFolders());
    backedUp = true;
  }

  let core: VaultRestoreResult | null = null;
  let extensions: ReturnType<typeof applyVaultExtensionsRestore> | null = null;
  let cloud: Awaited<ReturnType<typeof applyCloudRestore>> | null = null;

  if (options.restoreCore && options.selection.noteIds.size > 0) {
    assertCurrentOperationEpoch(operationEpoch, 'restore');
    const filtered = filterManifestBySelection(manifest, options.selection);
    core = await deps.importCore(filtered, options.strategy);
  }

  if (options.restoreExtensions && manifest.extensions) {
    assertCurrentOperationEpoch(operationEpoch, 'restore');
    extensions = applyVaultExtensionsRestore(manifest.extensions, options.healthAuthority);
  }

  if (options.restoreCloud && manifest.cloud) {
    assertCurrentOperationEpoch(operationEpoch, 'restore');
    cloud = await applyCloudRestore(manifest.cloud);
    assertCurrentOperationEpoch(operationEpoch, 'restore');
  }

  return { core, extensions, cloud, backedUp };
}

export type RecoveryProtectionStatus = 'protected' | 'partial' | 'none';

export function assessRecoveryProtectionStatus(
  lastSnapshotAt: string | null,
  lastExportAt: string | null,
  _cloudSyncEnabled: boolean,
  lastExportCoverage: VaultBackupCoverage | null = null,
): RecoveryProtectionStatus {
  const recentExport = lastExportAt
    && Date.now() - new Date(lastExportAt).getTime() < 7 * 24 * 60 * 60 * 1000;
  const hasSnapshot = Boolean(lastSnapshotAt);

  if (recentExport && lastExportCoverage
    && protectionForVaultBackupCoverage(lastExportCoverage) === 'protected') return 'protected';
  if (recentExport || hasSnapshot) return 'partial';
  return 'none';
}
