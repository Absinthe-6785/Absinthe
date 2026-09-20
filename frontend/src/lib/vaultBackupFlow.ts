import type { NoteBase } from '@/components/views/noteUtils';
import type { NoteFolder } from '@/store/useNotesStore';
import {
  buildVaultBackupManifestV3,
  type VaultBackupManifest,
} from './exportVaultBackup';
import { collectPortableVaultExtensions } from './vaultPortableExtensions';
import type { RoutinePresetState } from '@/components/views/features/health/routinePresets';
import { assertExportReady } from './vaultExportValidate';
import type { VaultBackupCloudBlock } from './vaultCloudExport';
import {
  classifyVaultBackupCoverage,
  isReducedVaultBackupCoverage,
  type VaultBackupCoverage,
  type VaultBackupCoverageImpact,
} from './vaultBackupCoverage';

export interface VaultBackupFlowDeps {
  fetchCloud: () => Promise<VaultBackupCloudBlock>;
  download: (manifest: VaultBackupManifest) => Promise<void>;
  recordSuccess: (timestamp: string, coverage: VaultBackupCoverage) => void;
  isAccountCurrent?: (accountId: string | null) => boolean;
  readHealthRoutineState?: (accountId: string) => Promise<RoutinePresetState | null>;
}

export interface VaultBackupAttemptInput {
  notes: readonly NoteBase[];
  folders: readonly NoteFolder[];
  cloudExpected: boolean;
  accountId: string | null;
}

export interface PendingReducedVaultBackup extends VaultBackupCoverageImpact {
  manifest: VaultBackupManifest;
  accountId: string;
}

export type VaultBackupAttemptResult =
  | {
    kind: 'downloaded';
    manifest: VaultBackupManifest;
    coverage: VaultBackupCoverage;
  }
  | {
    kind: 'pending';
    pending: PendingReducedVaultBackup;
  };

function buildValidatedManifest(
  notes: readonly NoteBase[],
  folders: readonly NoteFolder[],
  cloud: VaultBackupCloudBlock | null,
  accountId: string | null,
  routinePresetState?: RoutinePresetState | null,
): VaultBackupManifest {
  const manifest = buildVaultBackupManifestV3(
    notes,
    folders,
    cloud,
    collectPortableVaultExtensions(accountId, routinePresetState),
  );
  const validation = assertExportReady(manifest);
  if (!validation.valid) {
    throw new Error(validation.errors[0] ?? 'export_validation_failed');
  }
  return manifest;
}

export async function runVaultBackupAttempt(
  input: VaultBackupAttemptInput,
  deps: VaultBackupFlowDeps,
): Promise<VaultBackupAttemptResult> {
  const cloud = input.cloudExpected ? await deps.fetchCloud() : null;
  if (input.cloudExpected && deps.isAccountCurrent && !deps.isAccountCurrent(input.accountId)) {
    throw new Error('backup_account_changed');
  }
  let durableRoutineState: RoutinePresetState | undefined;
  if (input.accountId && deps.readHealthRoutineState) {
    try {
      durableRoutineState = (await deps.readHealthRoutineState(input.accountId)) ?? undefined;
    } catch {
      // Compatibility cache is a bounded fallback only when IndexedDB cannot be read.
    }
  }
  if (deps.isAccountCurrent && !deps.isAccountCurrent(input.accountId)) {
    throw new Error('backup_account_changed');
  }
  const manifest = buildValidatedManifest(
    input.notes, input.folders, cloud, input.accountId, durableRoutineState,
  );
  const impact = classifyVaultBackupCoverage(manifest);

  if (isReducedVaultBackupCoverage(impact.coverage)) {
    if (!input.accountId) throw new Error('reduced_backup_missing_account');
    return {
      kind: 'pending',
      pending: { ...impact, manifest, accountId: input.accountId },
    };
  }

  await deps.download(manifest);
  deps.recordSuccess(manifest.exportedAt, impact.coverage);
  return { kind: 'downloaded', manifest, coverage: impact.coverage };
}

export async function downloadPendingReducedVaultBackup(
  pending: PendingReducedVaultBackup,
  currentAccountId: string | null,
  cloudExpected: boolean,
  deps: Pick<VaultBackupFlowDeps, 'download' | 'recordSuccess'>,
): Promise<'downloaded' | 'stale-account'> {
  if (!cloudExpected || !currentAccountId || pending.accountId !== currentAccountId) {
    return 'stale-account';
  }

  await deps.download(pending.manifest);
  deps.recordSuccess(pending.manifest.exportedAt, pending.coverage);
  return 'downloaded';
}
