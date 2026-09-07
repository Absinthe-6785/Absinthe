import {
  normalizeNoteProperties,
  noteSyncPayload,
  type NoteBase,
} from '../components/views/noteUtils';
import { normalizeNoteRelations } from '../components/views/features/knowledge/relations/relationNormalize';
import type { DbNoteRow } from './notesSyncClient';

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

export interface ResolvedBootstrapNotesRevalidation {
  readonly notes: NoteBase[];
  readonly pendingRemoteSyncNotes: NoteBase[];
  readonly conflictNoteIds: string[];
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
export function resolveSameIdNoteAuthority(
  input: ResolveSameIdNoteAuthorityInput,
): SameIdNoteAuthorityResolution {
  const { accountId, local, remote, protectedDeleteConflict, pendingLocalMutation } = input;
  const normalizedRemote = normalizeAuthoritativeRemoteBootstrapNote(remote, accountId);
  const comparable = local.id === remote.id
    && isCompleteLocalNote(local)
    && normalizedRemote !== null;

  if (!comparable || protectedDeleteConflict || pendingLocalMutation) {
    return {
      outcome: 'INCOMPARABLE',
      resolved: local,
      pendingRemoteSync: pendingLocalMutation,
      conflict: true,
    };
  }

  const localRevision = effectiveRevision(local);
  const remoteRevision = effectiveRevision(normalizedRemote!);
  if (localRevision > remoteRevision) {
    return {
      outcome: 'LOCAL_NEWER',
      resolved: local,
      pendingRemoteSync: true,
      conflict: false,
    };
  }
  if (remoteRevision > localRevision) {
    return {
      outcome: 'REMOTE_NEWER',
      resolved: normalizedRemote!,
      pendingRemoteSync: false,
      conflict: false,
    };
  }

  const payloadsEqual = canonicalSyncablePayloadIdentity(local)
    === canonicalSyncablePayloadIdentity(normalizedRemote!);
  return {
    outcome: 'EQUAL',
    resolved: local,
    pendingRemoteSync: false,
    conflict: !payloadsEqual,
  };
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
    const resolution = resolveSameIdNoteAuthority({
      accountId: input.accountId,
      local: current,
      remote: noteAsAuthoritativeBootstrapRow(candidate, input.accountId),
      protectedDeleteConflict: false,
      pendingLocalMutation: false,
    });
    const resolved = resolution.outcome === 'REMOTE_NEWER' ? candidate : current;
    notes.push(resolved);
    if (resolution.pendingRemoteSync) pendingRemoteSyncNotes.set(resolved.id, resolved);
    if (resolution.conflict) conflictNoteIds.add(resolved.id);
  }

  for (const current of input.currentDurable) {
    if (candidateById.has(current.id)) continue;
    const previous = previousById.get(current.id);
    if (input.authorizedMissingNoteIds.has(current.id) && previous) {
      const resolution = resolveSameIdNoteAuthority({
        accountId: input.accountId,
        local: current,
        remote: noteAsAuthoritativeBootstrapRow(previous, input.accountId),
        protectedDeleteConflict: false,
        pendingLocalMutation: false,
      });
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
  };
}
