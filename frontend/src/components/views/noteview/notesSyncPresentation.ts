import type { TranslationKey } from '../../../lib/i18n';
import type { SyncIssueState } from '../../../store/useNotesStore';

export type NoteSyncPresentation =
  | { readonly kind: 'none' }
  | {
    readonly kind:
      | 'local-save-problem'
      | 'auth-required'
      | 'remote-unconfirmed'
      | 'remote-pending'
      | 'remote-conflict'
      | 'bootstrap-problem'
      | 'remote-rejected';
    readonly messageKey: TranslationKey;
    readonly retryable: boolean;
  };

export interface NoteSyncPresentationInput {
  readonly activeNoteId: string | null;
  readonly syncError: string | null;
  readonly syncIssue: SyncIssueState | null;
}

const NO_SYNC_ISSUE: NoteSyncPresentation = { kind: 'none' };

function activeIssue(input: NoteSyncPresentationInput): SyncIssueState | null {
  if (!input.syncError || input.syncIssue?.message !== input.syncError) return null;
  return input.syncIssue;
}

/** Projects internal Notes sync evidence into controlled, current-note UI semantics. */
export function projectNoteSyncPresentation(input: NoteSyncPresentationInput): NoteSyncPresentation {
  if (!input.syncError) return NO_SYNC_ISSUE;
  const issue = activeIssue(input);

  // An unowned legacy error remains visible, but never exposes its raw message or
  // invents a retry action without an authoritative target/classification.
  if (!issue) {
    return { kind: 'remote-rejected', messageKey: 'nvSyncRemoteRejected', retryable: false };
  }

  if ((issue.source === 'note_remote_write' || issue.source === 'note_remote_delete')
    && issue.targetId !== undefined
    && issue.targetId !== input.activeNoteId) return NO_SYNC_ISSUE;

  if (issue.classification === 'REMOTE_CONFIRMED'
    || issue.classification === 'REMOTE_CONFIRMED_AFTER_READBACK'
    || issue.classification === 'STALE_ACCOUNT'
    || issue.classification === 'STALE_OPERATION'
    || issue.classification === 'RECOVERY_GUARD_REJECTION'
    || issue.source === 'recovery'
    || issue.source === 'recovery_permanent_delete'
    || issue.source === 'initialization') return NO_SYNC_ISSUE;

  if (issue.classification === 'BOOTSTRAP_FAILURE' || issue.source === 'bootstrap') {
    return { kind: 'bootstrap-problem', messageKey: 'nvSyncBootstrapProblem', retryable: false };
  }

  if (issue.classification === 'LOCAL_PERSISTENCE_FAILURE'
    || issue.source === 'local_notes_persistence'
    || issue.source === 'local_folders_persistence') {
    return { kind: 'local-save-problem', messageKey: 'nvSyncLocalSaveProblem', retryable: false };
  }

  switch (issue.classification) {
    case 'AUTH_UNAVAILABLE':
      return { kind: 'auth-required', messageKey: 'nvSyncAuthRequired', retryable: false };
    case 'TRANSPORT_AMBIGUOUS':
      return {
        kind: 'remote-unconfirmed',
        messageKey: 'nvSyncStatusUnconfirmed',
        retryable: issue.retryable,
      };
    case 'REMOTE_NOT_CONFIRMED':
      return { kind: 'remote-pending', messageKey: 'nvSyncPending', retryable: issue.retryable };
    case 'REMOTE_CONFLICT':
      return { kind: 'remote-conflict', messageKey: 'nvSyncConflict', retryable: false };
    case 'REQUEST_NOT_STARTED':
    case 'HTTP_REJECTION':
    default:
      return { kind: 'remote-rejected', messageKey: 'nvSyncRemoteRejected', retryable: issue.retryable };
  }
}
