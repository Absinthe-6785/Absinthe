import {
  normalizeNoteProperties,
  noteSyncPayload,
  type NoteBase,
} from '../components/views/noteUtils';
import { normalizeNoteRelations } from '../components/views/features/knowledge/relations/relationNormalize';
import type { DbNoteRow } from './notesSyncClient';
import type {
  NotesAuthorityConflictSubtype,
  NotesAuthorityConflictSubtypeCounts,
  NotesAuthorityIncomparableReason,
  NotesAuthorityIncomparableReasonCounts,
  NotesAuthorityLiveStatePair,
  NotesAuthorityLiveStatePairCounts,
  NotesAuthorityOutcomeCounts,
  NotesAuthorityPhaseAggregate,
} from './notesBootstrapDiagnostics';

export type NotesBootstrapAuthorityOutcome =
  | 'LOCAL_NEWER'
  | 'REMOTE_NEWER'
  | 'EQUAL'
  | 'INCOMPARABLE';

export interface SameIdNoteAuthorityResolution {
  readonly outcome: NotesBootstrapAuthorityOutcome;
  readonly resolved: NoteBase;
  readonly pendingRemoteSync: boolean;
  readonly conflict: boolean;
}

export interface SameIdNoteAuthorityObservation {
  readonly outcome: NotesBootstrapAuthorityOutcome;
  readonly conflictSubtype: NotesAuthorityConflictSubtype | null;
  readonly incomparableReason: NotesAuthorityIncomparableReason | null;
  readonly liveStatePair: NotesAuthorityLiveStatePair;
}

export interface SameIdNoteAuthorityResolutionWithObservation {
  readonly resolution: SameIdNoteAuthorityResolution;
  readonly observation: SameIdNoteAuthorityObservation;
}

export interface ResolvedBootstrapNotesRevalidation {
  readonly notes: NoteBase[];
  readonly pendingRemoteSyncNotes: NoteBase[];
  readonly conflictNoteIds: string[];
  readonly authorityAggregate: NotesAuthorityPhaseAggregate;
}

interface RevalidateResolvedBootstrapNotesInput {
  readonly accountId: string;
  readonly currentDurable: readonly NoteBase[];
  readonly previousLocal: readonly NoteBase[];
  readonly resolvedCandidate: readonly NoteBase[];
  readonly authorizedMissingNoteIds: ReadonlySet<string>;
}

interface ResolveSameIdNoteAuthorityInput {
  readonly accountId: string;
  readonly local: NoteBase;
  readonly remote: DbNoteRow;
  readonly protectedDeleteConflict: boolean;
  readonly pendingLocalMutation: boolean;
}

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isRevision(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && Object.entries(value).every(([key, item]) => key.trim().length > 0 && typeof item === 'string');
}

function isRelationRecord(value: unknown): value is Record<string, string[]> {
  return value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && Object.entries(value).every(([key, item]) => key.trim().length > 0
      && Array.isArray(item)
      && item.every(targetId => typeof targetId === 'string'));
}

function hasValidRevisionShape(updatedAt: unknown, deletedAt: unknown): boolean {
  return isRevision(updatedAt)
    && (deletedAt === null || isRevision(deletedAt))
    && (deletedAt === null || deletedAt >= updatedAt);
}

function revisionShapeIssue(
  updatedAt: unknown,
  deletedAt: unknown,
  side: 'LOCAL' | 'REMOTE',
): NotesAuthorityIncomparableReason | null {
  if (!isRevision(updatedAt) || (deletedAt !== null && !isRevision(deletedAt))) {
    return side === 'LOCAL' ? 'LOCAL_REVISION_SHAPE_INVALID' : 'REMOTE_REVISION_SHAPE_INVALID';
  }
  if (deletedAt !== null && deletedAt < updatedAt) {
    return side === 'LOCAL'
      ? 'LOCAL_TOMBSTONE_CHRONOLOGY_INVALID'
      : 'REMOTE_TOMBSTONE_CHRONOLOGY_INVALID';
  }
  return null;
}

function isCompleteLocalNote(note: NoteBase): boolean {
  return typeof note.id === 'string'
    && note.id.trim().length > 0
    && typeof note.title === 'string'
    && typeof note.body === 'string'
    && (note.folderId === null || typeof note.folderId === 'string')
    && hasValidRevisionShape(note.updatedAt, note.deletedAt)
    && (note.starred === undefined || typeof note.starred === 'boolean')
    && (note.properties === undefined || isStringRecord(note.properties))
    && (note.relations === undefined || isRelationRecord(note.relations));
}

function isCompleteAuthoritativeRemoteRow(row: DbNoteRow, accountId: string): boolean {
  return accountId.trim().length > 0
    && hasOwn(row, 'user_id')
    && row.user_id === accountId
    && hasOwn(row, 'folder_id')
    && hasOwn(row, 'deleted_at')
    && hasOwn(row, 'starred')
    && hasOwn(row, 'properties')
    && hasOwn(row, 'relations')
    && typeof row.id === 'string'
    && row.id.trim().length > 0
    && typeof row.title === 'string'
    && typeof row.body === 'string'
    && (row.folder_id === null || typeof row.folder_id === 'string')
    && hasValidRevisionShape(row.updated_at, row.deleted_at)
    && typeof row.starred === 'boolean'
    && (row.properties === null || isStringRecord(row.properties))
    && (row.relations === null || isRelationRecord(row.relations));
}

/**
 * Projects legacy-optional fields only for same-ID authority comparison.
 * Present values, including malformed values, are preserved for strict validation.
 */
function projectLegacyOptionalRemoteFieldsForAuthorityComparison(row: DbNoteRow): DbNoteRow {
  const projected = { ...row };
  if (!hasOwn(row, 'starred')) projected.starred = false;
  if (!hasOwn(row, 'properties')) projected.properties = null;
  if (!hasOwn(row, 'relations')) projected.relations = null;
  return projected;
}

function sortedStringRecord(record: Record<string, string> | undefined): Record<string, string> | null {
  if (!record) return null;
  return Object.fromEntries(Object.entries(record).sort(([left], [right]) => left.localeCompare(right)));
}

function sortedRelationRecord(
  record: Record<string, string[]> | undefined,
): Record<string, string[]> | null {
  if (!record) return null;
  return Object.fromEntries(Object.entries(record).sort(([left], [right]) => left.localeCompare(right)));
}

function canonicalSyncablePayloadIdentity(note: NoteBase): string {
  const normalizedProperties = normalizeNoteProperties(note.properties);
  const normalizedRelations = normalizeNoteRelations(note.relations);
  const payload = noteSyncPayload({
    ...note,
    title: note.title ?? '',
    body: note.body ?? '',
    folderId: note.folderId ?? null,
    deletedAt: note.deletedAt ?? null,
    starred: Boolean(note.starred),
    properties: normalizedProperties,
    relations: normalizedRelations,
  });
  return JSON.stringify({
    id: payload.id,
    title: payload.title,
    body: payload.body,
    folder_id: payload.folder_id,
    deleted_at: payload.deleted_at,
    starred: payload.starred,
    properties: sortedStringRecord(normalizedProperties),
    relations: sortedRelationRecord(normalizedRelations),
  });
}

function effectiveRevision(note: { updatedAt: number; deletedAt: number | null }): number {
  return note.deletedAt ?? note.updatedAt;
}

function liveStatePair(local: NoteBase, remote: DbNoteRow): NotesAuthorityLiveStatePair {
  if (local.deletedAt === null) {
    return remote.deleted_at === null ? 'LIVE_LIVE' : 'LIVE_TOMBSTONE';
  }
  return remote.deleted_at === null ? 'TOMBSTONE_LIVE' : 'TOMBSTONE_TOMBSTONE';
}

function incomparableReason(input: ResolveSameIdNoteAuthorityInput): NotesAuthorityIncomparableReason {
  const { accountId, local, remote, protectedDeleteConflict, pendingLocalMutation } = input;
  if (protectedDeleteConflict) return 'PERMANENT_DELETE_PROTECTED';
  if (pendingLocalMutation) return 'PENDING_LOCAL_MUTATION';
  if (local.id !== remote.id) return 'NOTE_ID_MISMATCH';

  const localRevisionIssue = revisionShapeIssue(local.updatedAt, local.deletedAt, 'LOCAL');
  if (localRevisionIssue) return localRevisionIssue;
  if (!isCompleteLocalNote(local)) return 'LOCAL_AUTHORITY_SHAPE_INVALID';

  // Retain the diagnostic vocabulary defensively. The same-ID resolver passes
  // its missing-only comparison projection, so absence alone does not reach it.
  if (!hasOwn(remote, 'starred') || !hasOwn(remote, 'properties') || !hasOwn(remote, 'relations')) {
    return 'REMOTE_LEGACY_FIELDS_ABSENT';
  }
  const remoteRevisionIssue = revisionShapeIssue(remote.updated_at, remote.deleted_at, 'REMOTE');
  if (remoteRevisionIssue) return remoteRevisionIssue;
  return 'REMOTE_AUTHORITY_SHAPE_INVALID';
}

type MutableNotesAuthorityPhaseAggregate = {
  conflictCount: number;
  authorityOutcomeCounts: Record<NotesBootstrapAuthorityOutcome, number>;
  conflictSubtypeCounts: Record<NotesAuthorityConflictSubtype, number>;
  incomparableReasonCounts: Record<NotesAuthorityIncomparableReason, number>;
  liveStatePairCounts: Record<NotesAuthorityLiveStatePair, number>;
};

export function createNotesAuthorityPhaseAggregate(): MutableNotesAuthorityPhaseAggregate {
  return {
    conflictCount: 0,
    authorityOutcomeCounts: { LOCAL_NEWER: 0, REMOTE_NEWER: 0, EQUAL: 0, INCOMPARABLE: 0 },
    conflictSubtypeCounts: { EQUAL_PAYLOAD_MISMATCH: 0, INCOMPARABLE: 0 },
    incomparableReasonCounts: {
      PERMANENT_DELETE_PROTECTED: 0,
      PENDING_LOCAL_MUTATION: 0,
      NOTE_ID_MISMATCH: 0,
      LOCAL_REVISION_SHAPE_INVALID: 0,
      REMOTE_REVISION_SHAPE_INVALID: 0,
      LOCAL_TOMBSTONE_CHRONOLOGY_INVALID: 0,
      REMOTE_TOMBSTONE_CHRONOLOGY_INVALID: 0,
      LOCAL_AUTHORITY_SHAPE_INVALID: 0,
      REMOTE_LEGACY_FIELDS_ABSENT: 0,
      REMOTE_AUTHORITY_SHAPE_INVALID: 0,
    },
    liveStatePairCounts: {
      LIVE_LIVE: 0,
      LIVE_TOMBSTONE: 0,
      TOMBSTONE_LIVE: 0,
      TOMBSTONE_TOMBSTONE: 0,
    },
  };
}

export function recordNotesAuthorityObservation(
  aggregate: MutableNotesAuthorityPhaseAggregate,
  observation: SameIdNoteAuthorityObservation,
): void {
  aggregate.authorityOutcomeCounts[observation.outcome] += 1;
  aggregate.liveStatePairCounts[observation.liveStatePair] += 1;
  if (observation.incomparableReason) {
    aggregate.incomparableReasonCounts[observation.incomparableReason] += 1;
  }
  if (observation.conflictSubtype) {
    aggregate.conflictCount += 1;
    aggregate.conflictSubtypeCounts[observation.conflictSubtype] += 1;
  }
}

export function snapshotNotesAuthorityPhaseAggregate(
  aggregate: MutableNotesAuthorityPhaseAggregate,
): NotesAuthorityPhaseAggregate {
  return Object.freeze({
    conflictCount: aggregate.conflictCount,
    authorityOutcomeCounts: Object.freeze({ ...aggregate.authorityOutcomeCounts }) as NotesAuthorityOutcomeCounts,
    conflictSubtypeCounts: Object.freeze({ ...aggregate.conflictSubtypeCounts }) as NotesAuthorityConflictSubtypeCounts,
    incomparableReasonCounts: Object.freeze({ ...aggregate.incomparableReasonCounts }) as NotesAuthorityIncomparableReasonCounts,
    liveStatePairCounts: Object.freeze({ ...aggregate.liveStatePairCounts }) as NotesAuthorityLiveStatePairCounts,
  });
}

/** Fully maps a remote row without allowing it to make same-ID authority decisions. */
export function normalizeRemoteBootstrapNote(row: DbNoteRow): NoteBase {
  return {
    id: row.id,
    title: row.title ?? '',
    body: row.body ?? '',
    updatedAt: row.updated_at,
    folderId: row.folder_id ?? null,
    deletedAt: row.deleted_at ?? null,
    starred: Boolean(row.starred),
    properties: normalizeNoteProperties(row.properties),
    relations: normalizeNoteRelations(row.relations),
  };
}

export function normalizeAuthoritativeRemoteBootstrapNote(
  row: DbNoteRow,
  accountId: string,
): NoteBase | null {
  return isCompleteAuthoritativeRemoteRow(row, accountId)
    ? normalizeRemoteBootstrapNote(row)
    : null;
}

/**
 * Pure same-ID bootstrap authority decision. Permanent-delete reconciliation
 * remains the first layer and is represented by protectedDeleteConflict.
 */
export function resolveSameIdNoteAuthorityWithObservation(
  input: ResolveSameIdNoteAuthorityInput,
): SameIdNoteAuthorityResolutionWithObservation {
  const { accountId, local, remote, protectedDeleteConflict, pendingLocalMutation } = input;
  const comparisonRemote = projectLegacyOptionalRemoteFieldsForAuthorityComparison(remote);
  const comparisonInput = { ...input, remote: comparisonRemote };
  const normalizedRemote = normalizeAuthoritativeRemoteBootstrapNote(comparisonRemote, accountId);
  const comparable = local.id === remote.id
    && isCompleteLocalNote(local)
    && normalizedRemote !== null;
  const pair = liveStatePair(local, remote);

  if (!comparable || protectedDeleteConflict || pendingLocalMutation) {
    const resolution: SameIdNoteAuthorityResolution = {
      outcome: 'INCOMPARABLE',
      resolved: local,
      pendingRemoteSync: pendingLocalMutation,
      conflict: true,
    };
    return {
      resolution,
      observation: {
        outcome: resolution.outcome,
        conflictSubtype: protectedDeleteConflict ? null : 'INCOMPARABLE',
        incomparableReason: incomparableReason(comparisonInput),
        liveStatePair: pair,
      },
    };
  }

  const localRevision = effectiveRevision(local);
  const remoteRevision = effectiveRevision(normalizedRemote!);
  if (localRevision > remoteRevision) {
    const resolution: SameIdNoteAuthorityResolution = {
      outcome: 'LOCAL_NEWER',
      resolved: local,
      pendingRemoteSync: true,
      conflict: false,
    };
    return {
      resolution,
      observation: {
        outcome: resolution.outcome, conflictSubtype: null, incomparableReason: null, liveStatePair: pair,
      },
    };
  }
  if (remoteRevision > localRevision) {
    const resolution: SameIdNoteAuthorityResolution = {
      outcome: 'REMOTE_NEWER',
      resolved: normalizedRemote!,
      pendingRemoteSync: false,
      conflict: false,
    };
    return {
      resolution,
      observation: {
        outcome: resolution.outcome, conflictSubtype: null, incomparableReason: null, liveStatePair: pair,
      },
    };
  }

  const payloadsEqual = canonicalSyncablePayloadIdentity(local)
    === canonicalSyncablePayloadIdentity(normalizedRemote!);
  const resolution: SameIdNoteAuthorityResolution = {
    outcome: 'EQUAL',
    resolved: local,
    pendingRemoteSync: false,
    conflict: !payloadsEqual,
  };
  return {
    resolution,
    observation: {
      outcome: resolution.outcome,
      conflictSubtype: resolution.conflict ? 'EQUAL_PAYLOAD_MISMATCH' : null,
      incomparableReason: null,
      liveStatePair: pair,
    },
  };
}

export function resolveSameIdNoteAuthority(
  input: ResolveSameIdNoteAuthorityInput,
): SameIdNoteAuthorityResolution {
  return resolveSameIdNoteAuthorityWithObservation(input).resolution;
}

function noteAsAuthoritativeBootstrapRow(note: NoteBase, accountId: string): DbNoteRow {
  return {
    id: note.id,
    user_id: accountId,
    title: note.title,
    body: note.body,
    updated_at: note.updatedAt,
    folder_id: note.folderId,
    deleted_at: note.deletedAt,
    starred: Boolean(note.starred),
    properties: note.properties ?? null,
    relations: note.relations ?? null,
  };
}

/**
 * Revalidates an already-resolved bootstrap candidate against the durable
 * account snapshot observed by the committing storage transaction. The same
 * per-Note revision authority remains the sole same-ID decision algorithm.
 */
export function revalidateResolvedBootstrapNotes(
  input: RevalidateResolvedBootstrapNotesInput,
): ResolvedBootstrapNotesRevalidation {
  const currentById = new Map(input.currentDurable.map(note => [note.id, note]));
  const previousById = new Map(input.previousLocal.map(note => [note.id, note]));
  const candidateById = new Map(input.resolvedCandidate.map(note => [note.id, note]));
  const notes: NoteBase[] = [];
  const pendingRemoteSyncNotes = new Map<string, NoteBase>();
  const conflictNoteIds = new Set<string>();
  const authorityAggregate = createNotesAuthorityPhaseAggregate();

  for (const candidate of input.resolvedCandidate) {
    const current = currentById.get(candidate.id);
    if (!current) {
      // A row that existed in the original local snapshot but is absent from
      // the committing transaction was removed by a newer durable mutation.
      // Preserve that current durable absence instead of resurrecting the
      // already-resolved bootstrap candidate. Genuinely remote-only rows have
      // no previous local identity and remain eligible for insertion.
      if (previousById.has(candidate.id)) continue;
      notes.push(candidate);
      continue;
    }
    const observed = resolveSameIdNoteAuthorityWithObservation({
      accountId: input.accountId,
      local: current,
      remote: noteAsAuthoritativeBootstrapRow(candidate, input.accountId),
      protectedDeleteConflict: false,
      pendingLocalMutation: false,
    });
    const resolution = observed.resolution;
    recordNotesAuthorityObservation(authorityAggregate, observed.observation);
    const resolved = resolution.outcome === 'REMOTE_NEWER' ? candidate : current;
    notes.push(resolved);
    if (resolution.pendingRemoteSync) pendingRemoteSyncNotes.set(resolved.id, resolved);
    if (resolution.conflict) conflictNoteIds.add(resolved.id);
  }

  for (const current of input.currentDurable) {
    if (candidateById.has(current.id)) continue;
    const previous = previousById.get(current.id);
    if (input.authorizedMissingNoteIds.has(current.id) && previous) {
      const observed = resolveSameIdNoteAuthorityWithObservation({
        accountId: input.accountId,
        local: current,
        remote: noteAsAuthoritativeBootstrapRow(previous, input.accountId),
        protectedDeleteConflict: false,
        pendingLocalMutation: false,
      });
      const resolution = observed.resolution;
      recordNotesAuthorityObservation(authorityAggregate, observed.observation);
      const authorizedAbsenceStillApplies = resolution.outcome === 'REMOTE_NEWER'
        || resolution.outcome === 'EQUAL' && !resolution.conflict;
      if (authorizedAbsenceStillApplies) continue;
      if (resolution.pendingRemoteSync) pendingRemoteSyncNotes.set(current.id, current);
      if (resolution.conflict) conflictNoteIds.add(current.id);
    }
    notes.push(current);
  }

  return {
    notes,
    pendingRemoteSyncNotes: [...pendingRemoteSyncNotes.values()],
    conflictNoteIds: [...conflictNoteIds],
    authorityAggregate: snapshotNotesAuthorityPhaseAggregate(authorityAggregate),
  };
}
