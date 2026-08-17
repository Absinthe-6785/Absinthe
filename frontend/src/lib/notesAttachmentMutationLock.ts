export interface NotesAttachmentMutationLockAdapter {
  request<T>(
    name: string,
    options: { mode: 'exclusive' },
    callback: (lock: Lock | null) => Promise<T> | T,
  ): Promise<T>;
}

export class NotesAttachmentMutationLockError extends Error {
  readonly code: 'UNAVAILABLE' | 'ACQUISITION_FAILED';

  constructor(code: 'UNAVAILABLE' | 'ACQUISITION_FAILED') {
    super(code === 'UNAVAILABLE'
      ? 'notes_attachment_mutation_lock_unavailable'
      : 'notes_attachment_mutation_lock_acquisition_failed');
    this.name = 'NotesAttachmentMutationLockError';
    this.code = code;
  }
}

class LockedOperationFailure {
  constructor(readonly error: unknown) {}
}

function normalizedAccountId(accountId: string): string {
  const value = accountId.trim();
  if (!value) throw new Error('notes_account_scope_required');
  return value;
}

export function notesAttachmentMutationLockName(accountId: string): string {
  return `absinthe:notes-attachment-mutation:${encodeURIComponent(normalizedAccountId(accountId))}`;
}

function productionLockAdapter(): NotesAttachmentMutationLockAdapter | null {
  if (typeof globalThis.isSecureContext === 'boolean' && !globalThis.isSecureContext) return null;
  if (typeof navigator === 'undefined' || !('locks' in navigator)) return null;
  return navigator.locks as unknown as NotesAttachmentMutationLockAdapter;
}

/**
 * Runs one bounded account-scoped Notes/attachment mutation under an origin-wide
 * Web Lock. Absence or acquisition failure is fail-closed; operation failures
 * retain their original error while the browser releases the lock callback.
 */
export async function withAccountNotesAttachmentMutationLock<T>(input: {
  accountId: string;
  operation: () => Promise<T> | T;
  locks?: NotesAttachmentMutationLockAdapter | null;
}): Promise<T> {
  const locks = input.locks === undefined ? productionLockAdapter() : input.locks;
  if (!locks) throw new NotesAttachmentMutationLockError('UNAVAILABLE');
  let callbackCount = 0;
  try {
    return await locks.request(
      notesAttachmentMutationLockName(input.accountId),
      { mode: 'exclusive' },
      async lock => {
        callbackCount += 1;
        if (callbackCount !== 1 || lock === null) {
          throw new NotesAttachmentMutationLockError('ACQUISITION_FAILED');
        }
        try {
          return await input.operation();
        } catch (error) {
          throw new LockedOperationFailure(error);
        }
      },
    );
  } catch (error) {
    if (error instanceof LockedOperationFailure) throw error.error;
    if (error instanceof NotesAttachmentMutationLockError) throw error;
    throw new NotesAttachmentMutationLockError('ACQUISITION_FAILED');
  }
}

export function createAccountNotesAttachmentMutationLockClient(
  locks: NotesAttachmentMutationLockAdapter,
): <T>(accountId: string, operation: () => Promise<T> | T) => Promise<T> {
  return (accountId, operation) => withAccountNotesAttachmentMutationLock({ accountId, operation, locks });
}
