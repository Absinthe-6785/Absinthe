import { stableRecoveryJson } from './recoveryExportPackage';
import {
  HEALTH_RECOVERY_DATASETS,
  buildHealthRecoveryExport,
  deriveHealthRelationshipDiagnostics,
  orderHealthRecoveryDatasets,
  verifyHealthRecoveryExportText,
  type HealthRecoveryDatasetName,
  type HealthRecoveryDatasets,
  type HealthRecoveryExport,
} from './healthRecoveryExport';
import type {
  LocalHealthDriver,
  LocalHealthImportState,
  LocalHealthSnapshot,
} from './healthLocalRepository';
import { computeLocalHealthSnapshotPayloadSha256 } from './healthLocalRepository';

export const HISTORICAL_HEALTH_ACCOUNT_ID = '18c8ab7d-6ba7-4547-aa55-f254ce900075';
export const HISTORICAL_HEALTH_ACCOUNT_EMAIL = 'dhlee6785@gmail.com';

export type HealthImportExpectation = {
  fileBytes: number;
  fileSha256: string;
  contentSha256: string;
  sourceAccount: { userId: string; email: string };
  datasetCounts: Record<HealthRecoveryDatasetName, number>;
  totalRows: number;
  diagnostics: {
    workoutChecked: number;
    workoutMissing: number;
    healthRoutineChecked: number;
    healthRoutineMissingIds: string[];
    routineChecked: number;
    routineNullReferences: number;
    routineMissing: number;
    proteinChecked: number;
    proteinMissing: number;
    routineLogMultirowGroups: number;
    routineLogAdditionalRows: number;
  };
};

export const VERIFIED_HISTORICAL_HEALTH_IMPORT_EXPECTATION: HealthImportExpectation = {
  fileBytes: 619251,
  fileSha256: 'a721c8d785f89439cb60438c0861db6167a4db457be4ee5b78c29d2db523918e',
  contentSha256: '4d820f5741da4f6659a294aed49f2bc0c833f2034b133a60a800d0d8e9c0aef7',
  sourceAccount: { userId: HISTORICAL_HEALTH_ACCOUNT_ID, email: HISTORICAL_HEALTH_ACCOUNT_EMAIL },
  datasetCounts: {
    exercise_blocks: 44,
    workout_logs: 328,
    inbody_logs: 23,
    health_routines: 4,
    routines: 14,
    routine_logs: 763,
    protein_profiles: 1,
    protein_sources: 23,
    protein_intake_logs: 174,
    workout_memos: 0,
  },
  totalRows: 1374,
  diagnostics: {
    workoutChecked: 328,
    workoutMissing: 0,
    healthRoutineChecked: 37,
    healthRoutineMissingIds: [
      '47aa723f-48dc-4551-b244-584d48f7a5f8',
      'b7913fe6-2b6c-4cec-b8ac-ee94be4b7230',
    ],
    routineChecked: 654,
    routineNullReferences: 109,
    routineMissing: 0,
    proteinChecked: 149,
    proteinMissing: 0,
    routineLogMultirowGroups: 18,
    routineLogAdditionalRows: 91,
  },
};

export type HealthRecoveryPrevalidation = {
  export: HealthRecoveryExport;
  fileSha256: string;
  fileBytes: number;
  datasetCounts: Record<HealthRecoveryDatasetName, number>;
  totalRows: number;
};

export type HealthRecoveryImportResult = {
  accountId: string;
  snapshotId: string;
  datasetCounts: Record<HealthRecoveryDatasetName, number>;
  totalRows: number;
  relationships: HealthRecoveryExport['diagnostics']['relationships'];
  sourceFidelity: 'PASS';
  remoteMutationCount: 0;
};

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
function countsFor(datasets: HealthRecoveryDatasets): Record<HealthRecoveryDatasetName, number> {
  return Object.fromEntries(HEALTH_RECOVERY_DATASETS.map(dataset => [dataset, datasets[dataset].length])) as Record<HealthRecoveryDatasetName, number>;
}

function totalRows(counts: Record<HealthRecoveryDatasetName, number>): number {
  return HEALTH_RECOVERY_DATASETS.reduce((sum, dataset) => sum + counts[dataset], 0);
}

function assertEqual(actual: unknown, expected: unknown, code: string): void {
  if (stableRecoveryJson(actual) !== stableRecoveryJson(expected)) throw new Error(code);
}

function assertDiagnostics(value: HealthRecoveryExport, expectation: HealthImportExpectation): void {
  const relationships = value.diagnostics.relationships;
  const anomalies = value.diagnostics.anomalies;
  const expected = expectation.diagnostics;
  if (relationships.workoutBlockReferences.checked !== expected.workoutChecked
    || relationships.workoutBlockReferences.missing.length !== expected.workoutMissing) {
    throw new Error('health_import_workout_relationship_mismatch');
  }
  const missingIds = relationships.healthRoutineBlockReferences.missing.map(item => item.blockId).sort();
  if (relationships.healthRoutineBlockReferences.checked !== expected.healthRoutineChecked
    || stableRecoveryJson(missingIds) !== stableRecoveryJson([...expected.healthRoutineMissingIds].sort())) {
    throw new Error('health_import_unresolved_reference_mismatch');
  }
  if (relationships.routineLogRoutineReferences.checked !== expected.routineChecked
    || relationships.routineLogRoutineReferences.nullReferences.length !== expected.routineNullReferences
    || relationships.routineLogRoutineReferences.missing.length !== expected.routineMissing) {
    throw new Error('health_import_routine_relationship_mismatch');
  }
  if (relationships.proteinIntakeSourceReferences.checked !== expected.proteinChecked
    || relationships.proteinIntakeSourceReferences.missing.length !== expected.proteinMissing) {
    throw new Error('health_import_protein_relationship_mismatch');
  }
  if (anomalies.healthRoutineMissingBlockClassification !== 'PRESERVABLE_UNRESOLVED_REFERENCE'
    || anomalies.routineLogMultiplicityClassification !== 'UNCLEAR'
    || anomalies.routineLogMultirowGroupCount !== expected.routineLogMultirowGroups
    || anomalies.routineLogAdditionalRowCount !== expected.routineLogAdditionalRows
    || anomalies.preservationRule !== 'PRESERVE_EVERY_SOURCE_ROW_NO_WINNER_SELECTION') {
    throw new Error('health_import_anomaly_metadata_mismatch');
  }
}

export async function prevalidateHealthRecoveryImport(
  source: string,
  expectation: HealthImportExpectation = VERIFIED_HISTORICAL_HEALTH_IMPORT_EXPECTATION,
): Promise<HealthRecoveryPrevalidation> {
  const fileBytes = new TextEncoder().encode(source).byteLength;
  if (fileBytes !== expectation.fileBytes) throw new Error('health_import_file_size_mismatch');
  const fileSha256 = await sha256(source);
  if (fileSha256 !== expectation.fileSha256) throw new Error('health_import_file_hash_mismatch');
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    throw new Error('health_import_json_parse_failed');
  }
  const rawDatasets = parsed && typeof parsed === 'object'
    ? (parsed as { datasets?: unknown }).datasets
    : undefined;
  if (!rawDatasets || typeof rawDatasets !== 'object' || Array.isArray(rawDatasets)) {
    throw new Error('health_import_dataset_count_mismatch');
  }
  const datasetNames = Object.keys(rawDatasets as object).sort();
  if (stableRecoveryJson(datasetNames) !== stableRecoveryJson([...HEALTH_RECOVERY_DATASETS].sort())) {
    throw new Error('health_import_dataset_count_mismatch');
  }
  const verified = await verifyHealthRecoveryExportText(source);
  if (verified.export.checksum.value !== expectation.contentSha256) throw new Error('health_import_content_hash_mismatch');
  assertEqual(verified.export.sourceAccount, expectation.sourceAccount, 'health_import_source_account_mismatch');
  if (verified.datasetCount !== HEALTH_RECOVERY_DATASETS.length) throw new Error('health_import_dataset_count_mismatch');
  const datasetCounts = countsFor(verified.export.datasets);
  assertEqual(datasetCounts, expectation.datasetCounts, 'health_import_dataset_row_count_mismatch');
  const total = totalRows(datasetCounts);
  if (total !== expectation.totalRows || verified.totalRowCount !== expectation.totalRows) throw new Error('health_import_total_row_count_mismatch');
  assertDiagnostics(verified.export, expectation);
  return { export: verified.export, fileSha256, fileBytes, datasetCounts, totalRows: total };
}

function newSnapshotId(accountId: string): string {
  const nonce = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  return `${accountId}:${nonce}`;
}

async function verifyImportedSourceFidelity(
  imported: HealthRecoveryDatasets,
  source: HealthRecoveryExport,
): Promise<void> {
  const rebuilt = await buildHealthRecoveryExport({
    sourceAccount: source.sourceAccount,
    exportedAt: source.exportedAt,
    datasets: imported,
  });
  if (rebuilt.checksum.value !== source.checksum.value) throw new Error('health_import_source_fidelity_mismatch');
}

export async function importVerifiedHealthRecovery(input: {
  source: string;
  driver: LocalHealthDriver;
  expectation?: HealthImportExpectation;
  now?: () => string;
}): Promise<HealthRecoveryImportResult> {
  const expectation = input.expectation ?? VERIFIED_HISTORICAL_HEALTH_IMPORT_EXPECTATION;
  const verified = await prevalidateHealthRecoveryImport(input.source, expectation);
  const accountId = verified.export.sourceAccount.userId;
  await input.driver.recoverPendingImport(accountId);
  const priorAccountSnapshot = await input.driver.readAccountSnapshot(accountId);
  const priorDatasets = orderHealthRecoveryDatasets(priorAccountSnapshot.datasets);
  const priorImportState = priorAccountSnapshot.importState;
  if (priorImportState !== null && priorImportState.status !== 'VERIFIED_IMPORT_COMPLETE') {
    throw new Error('health_import_prior_state_not_stable');
  }
  const createdAt = (input.now ?? (() => new Date().toISOString()))();
  const snapshotWithoutHash = {
    snapshotId: newSnapshotId(accountId),
    accountId,
    createdAt,
    datasets: priorDatasets,
    priorImportState,
  };
  const snapshot: LocalHealthSnapshot = {
    ...snapshotWithoutHash,
    payloadSha256: await computeLocalHealthSnapshotPayloadSha256(snapshotWithoutHash),
  };
  await input.driver.persistSnapshot(snapshot);
  const snapshotReadback = await input.driver.readSnapshot(snapshot.snapshotId);
  if (!snapshotReadback) throw new Error('health_snapshot_readback_missing');
  const { payloadSha256, ...readbackWithoutHash } = snapshotReadback;
  if (payloadSha256 !== snapshot.payloadSha256
    || await computeLocalHealthSnapshotPayloadSha256(readbackWithoutHash) !== snapshot.payloadSha256) {
    throw new Error('health_snapshot_readback_mismatch');
  }

  const pendingImportState: LocalHealthImportState = {
    accountId,
    status: 'IMPORT_COMMITTED_PENDING_READBACK',
    snapshotId: snapshot.snapshotId,
    importedAt: createdAt,
    sourceFileSha256: verified.fileSha256,
    sourceContentSha256: verified.export.checksum.value,
    sourceExportedAt: verified.export.exportedAt,
    totalRowCount: verified.totalRows,
    datasetCounts: verified.datasetCounts,
    diagnostics: verified.export.diagnostics,
  };
  await input.driver.commitPendingImportAtomically({
    accountId,
    datasets: verified.export.datasets,
    expectedImportState: priorImportState,
    pendingImportState,
  });

  let readbackCounts: Record<HealthRecoveryDatasetName, number>;
  let relationships: HealthRecoveryExport['diagnostics']['relationships'];
  try {
    const pendingAccountSnapshot = await input.driver.readAccountSnapshot(accountId);
    const readback = orderHealthRecoveryDatasets(pendingAccountSnapshot.datasets);
    readbackCounts = countsFor(readback);
    assertEqual(readbackCounts, verified.datasetCounts, 'health_import_readback_count_mismatch');
    if (totalRows(readbackCounts) !== verified.totalRows) throw new Error('health_import_readback_total_mismatch');
    relationships = deriveHealthRelationshipDiagnostics(readback);
    assertEqual(relationships, verified.export.diagnostics.relationships, 'health_import_readback_relationship_mismatch');
    await verifyImportedSourceFidelity(readback, verified.export);
    const pendingStateReadback = pendingAccountSnapshot.importState;
    assertEqual(pendingStateReadback, pendingImportState, 'health_import_pending_marker_mismatch');
    const finalized = await input.driver.finalizePendingIfStillCurrent({
      accountId,
      expectedSnapshotId: snapshot.snapshotId,
    });
    if (finalized !== 'APPLIED') throw new Error('health_import_finalize_stale');
  } catch (error) {
    try {
      await input.driver.recoverPendingImport(accountId, snapshot.snapshotId);
    } catch (restoreError) {
      const readbackMessage = error instanceof Error ? error.message : String(error);
      const restoreMessage = restoreError instanceof Error ? restoreError.message : String(restoreError);
      throw new Error(`health_import_readback_failed_and_snapshot_restore_failed:${readbackMessage}:${restoreMessage}`);
    }
    throw error;
  }

  return {
    accountId,
    snapshotId: snapshot.snapshotId,
    datasetCounts: readbackCounts,
    totalRows: verified.totalRows,
    relationships,
    sourceFidelity: 'PASS',
    remoteMutationCount: 0,
  };
}
