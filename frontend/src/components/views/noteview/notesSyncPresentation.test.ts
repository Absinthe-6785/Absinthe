import { describe, expect, it } from 'vitest';
import type { NotesRemoteWriteClassification } from '../../../lib/notesSyncClient';
import type { SyncIssueState } from '../../../store/useNotesStore';
import { projectNoteSyncPresentation } from './notesSyncPresentation';

const ACTIVE_NOTE_ID = 'note-a';

function project(
  classification?: SyncIssueState['classification'],
  options: Partial<SyncIssueState> = {},
) {
  const message = 'raw internal diagnostic';
  return projectNoteSyncPresentation({
    activeNoteId: ACTIVE_NOTE_ID,
    syncError: message,
    syncIssue: {
      source: 'note_remote_write',
      targetId: ACTIVE_NOTE_ID,
      retryable: true,
      message,
      classification,
      ...options,
    },
  });
}

describe('Notes sync presentation projection', () => {
  it('shows no warning without an active issue or after confirmed outcomes', () => {
    expect(projectNoteSyncPresentation({ activeNoteId: ACTIVE_NOTE_ID, syncError: null, syncIssue: null }))
      .toEqual({ kind: 'none' });
    expect(project('REMOTE_CONFIRMED')).toEqual({ kind: 'none' });
    expect(project('REMOTE_CONFIRMED_AFTER_READBACK')).toEqual({ kind: 'none' });
  });

  it('proves local durability and ambiguous transport no longer collapse to one generic state', () => {
    expect(project('LOCAL_PERSISTENCE_FAILURE', { source: 'local_notes_persistence' })).toEqual({
      kind: 'local-save-problem',
      messageKey: 'nvSyncLocalSaveProblem',
      retryable: false,
    });
    expect(project('TRANSPORT_AMBIGUOUS')).toEqual({
      kind: 'remote-unconfirmed',
      messageKey: 'nvSyncStatusUnconfirmed',
      retryable: true,
    });
  });

  it.each([
    ['AUTH_UNAVAILABLE', 'auth-required', 'nvSyncAuthRequired', false],
    ['REMOTE_NOT_CONFIRMED', 'remote-pending', 'nvSyncPending', true],
    ['REMOTE_CONFLICT', 'remote-conflict', 'nvSyncConflict', false],
    ['REQUEST_NOT_STARTED', 'remote-rejected', 'nvSyncRemoteRejected', true],
    ['HTTP_REJECTION', 'remote-rejected', 'nvSyncRemoteRejected', true],
  ] as const)('projects %s to controlled %s semantics', (classification, kind, messageKey, retryable) => {
    expect(project(classification)).toEqual({ kind, messageKey, retryable });
  });

  it('honors a deterministic HTTP rejection as non-retryable without exposing its code', () => {
    const rawCode = 'NOTE_ID_UNAVAILABLE';
    const presentation = projectNoteSyncPresentation({
      activeNoteId: ACTIVE_NOTE_ID,
      syncError: rawCode,
      syncIssue: {
        source: 'note_remote_write', targetId: ACTIVE_NOTE_ID, retryable: false,
        message: rawCode, classification: 'HTTP_REJECTION',
      },
    });
    expect(presentation).toEqual({
      kind: 'remote-rejected',
      messageKey: 'nvSyncRemoteRejected',
      retryable: false,
    });
    expect(JSON.stringify(presentation)).not.toContain(rawCode);
  });

  it.each(['STALE_ACCOUNT', 'STALE_OPERATION'] satisfies NotesRemoteWriteClassification[])(
    'suppresses the %s control outcome',
    classification => expect(project(classification)).toEqual({ kind: 'none' }),
  );

  it('suppresses recovery ownership while keeping bootstrap separate from mutation sync', () => {
    expect(project('RECOVERY_GUARD_REJECTION', { source: 'recovery' })).toEqual({ kind: 'none' });
    expect(project('BOOTSTRAP_FAILURE', { source: 'bootstrap' })).toEqual({
      kind: 'bootstrap-problem', messageKey: 'nvSyncBootstrapProblem', retryable: false,
    });
  });

  it('suppresses a note-specific issue for another active note', () => {
    expect(projectNoteSyncPresentation({
      activeNoteId: 'note-b',
      syncError: 'pending',
      syncIssue: {
        source: 'note_remote_write', targetId: ACTIVE_NOTE_ID, retryable: true,
        message: 'pending', classification: 'REMOTE_NOT_CONFIRMED',
      },
    })).toEqual({ kind: 'none' });
  });

  it('keeps an unowned legacy error controlled and non-retryable', () => {
    expect(projectNoteSyncPresentation({
      activeNoteId: ACTIVE_NOTE_ID,
      syncError: 'database-detail-that-must-not-render',
      syncIssue: null,
    })).toEqual({
      kind: 'remote-rejected',
      messageKey: 'nvSyncRemoteRejected',
      retryable: false,
    });
  });
});
