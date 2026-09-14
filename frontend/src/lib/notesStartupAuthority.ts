import type { NotesAuthorityLoadState } from './notesAccountAuthority';

interface NotesStartupAuthorityInput {
  readonly syncError: string | null;
  readonly noteCount: number;
  readonly folderCount: number;
  readonly notesAuthorityState: NotesAuthorityLoadState;
  readonly foldersAuthorityState: NotesAuthorityLoadState;
}

/** Preserves the existing fail-closed startup boundary in a directly testable form. */
export function notesStartupRequiresRecovery(input: NotesStartupAuthorityInput): boolean {
  const authorityFailed = input.notesAuthorityState === 'RECOVERY_REQUIRED'
    || input.foldersAuthorityState === 'RECOVERY_REQUIRED';
  const emptyAfterFailure = Boolean(input.syncError)
    && input.noteCount === 0
    && input.folderCount === 0;
  return authorityFailed || emptyAfterFailure;
}
