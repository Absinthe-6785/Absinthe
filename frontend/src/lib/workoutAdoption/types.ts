import type { WorkoutSessionV1 } from '../workoutSessionV1';

export const WORKOUT_ADOPTION_ADAPTER = 'health-local-workout-logs-v1';
export const WORKOUT_ADOPTION_CONVERSION_VERSION = 1 as const;

export type WorkoutAdoptionStatus =
  | 'SEALED' | 'APPLYING' | 'VERIFYING' | 'COMPLETED'
  | 'RETRYABLE_FAILURE' | 'BLOCKED_AUTHORITY' | 'SOURCE_CHANGED';
export type WorkoutAdoptionClassification =
  | 'ADOPTABLE' | 'AMBIGUOUS_REVIEW' | 'INVALID_ACCOUNTED'
  | 'CARRIED_FORWARD' | 'CHANGED_SOURCE_REVIEW';
export type WorkoutAdoptionItemState =
  | 'ALLOCATED' | 'COMMITTED' | 'VERIFIED' | 'REVIEW_REQUIRED' | 'INVALID_ACCOUNTED' | 'CARRIED_FORWARD';

export interface WorkoutAdoptionSession {
  version: 1;
  manifestId: string;
  namespaceKey: string;
  accountId: string;
  projectRef: string;
  deviceId: string;
  generationId: string;
  sourceAdapter: typeof WORKOUT_ADOPTION_ADAPTER;
  sourceSchemaVersion: number;
  conversionVersion: typeof WORKOUT_ADOPTION_CONVERSION_VERSION;
  sourceSnapshotDigest: string;
  sourceRowCount: number;
  sourceCapturedAt: string;
  sourceImportStateDigest: string;
  status: WorkoutAdoptionStatus;
  counts: Record<WorkoutAdoptionClassification, number>;
  itemManifestDigest: string;
  targetStateDigest: string | null;
  createdAt: string;
  updatedAt: string;
  verifiedAt: string | null;
  failureCode: string | null;
  requiresReview: boolean;
}

export interface WorkoutAdoptionItem {
  namespaceKey: string;
  generationId: string;
  manifestId: string;
  sourceKeyDigest: string;
  sourceItemDigest: string;
  sourceReference: string;
  sourceRow: Record<string, unknown>;
  referenceBlock: Record<string, unknown> | null;
  historicalExerciseEvidence: Record<'id' | 'name' | 'type' | 'tags' | 'cardioMode',
    'SOURCE_EXACT' | 'CURRENT_CATALOG_DERIVED' | 'MISSING' | 'AMBIGUOUS'>;
  ownership: 'BOUND' | 'UNATTRIBUTABLE';
  classification: WorkoutAdoptionClassification;
  reason: string;
  priorManifestId: string | null;
  state: WorkoutAdoptionItemState;
  sessionId: string | null;
  entryIds: string[];
  setIds: string[];
  candidate: WorkoutSessionV1 | null;
  conversionResultDigest: string | null;
  targetEntityHash: string | null;
  outboxMutationId: string | null;
  verifiedAt: string | null;
}

export interface CapturedWorkoutAdoptionItem {
  sourceReference: string;
  sourceKeyDigest: string;
  sourceItemDigest: string;
  sourceRow: Record<string, unknown>;
  referenceBlock: Record<string, unknown> | null;
  ownership: 'BOUND' | 'UNATTRIBUTABLE';
}

export interface WorkoutAdoptionSnapshot {
  accountId: string;
  sourceInstanceId: string;
  sourceSchemaVersion: number;
  sourceSnapshotDigest: string;
  sourceImportStateDigest: string;
  items: CapturedWorkoutAdoptionItem[];
}
