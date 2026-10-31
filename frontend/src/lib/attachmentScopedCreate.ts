import { getActiveNotesAuthorityRequest, isNotesAuthorityRequestActive } from './notesAccountAuthority';
import { attachmentReference, type AttachmentCreateStage, type ScopedAttachmentCreateContext } from './attachmentRepository';

export function scopedAttachmentBlobKey(context: Pick<ScopedAttachmentCreateContext, 'namespace' | 'accountId' | 'attachmentId'>): string | null {
  if (context.namespace !== undefined && context.namespace !== 'local-document') return null;
  return `${context.namespace ?? 'local-image'}/${encodeURIComponent(context.accountId)}/${context.attachmentId}`;
}

export function isScopedAttachmentCreateCurrent(context: ScopedAttachmentCreateContext): boolean {
  try {
    return !!context.accountId && context.accountId === context.accountId.trim()
      && !!context.noteId && context.noteId === context.noteId.trim()
      && attachmentReference(context.attachmentId) === `attachment://${context.attachmentId}`
      && context.request.accountId === context.accountId
      && getActiveNotesAuthorityRequest() === context.request && isNotesAuthorityRequestActive(context.request)
      && context.isCurrent() === true
      && getActiveNotesAuthorityRequest() === context.request && isNotesAuthorityRequestActive(context.request);
  } catch { return false; }
}

/** One database only. add(), not read-then-put, enforces create-only identity. */
export function addScopedAttachmentRecord(db: IDBDatabase, storeName: string, record: unknown,
  current: () => boolean): Promise<AttachmentCreateStage> {
  if (!current()) return Promise.resolve('DENIED');
  return new Promise(resolve => {
    let tx: IDBTransaction;
    try { tx = db.transaction(storeName, 'readwrite'); }
    catch { resolve('NOT_STARTED'); return; }
    let issued = false, failed = false, collision = false;
    tx.addEventListener('complete', () => resolve(failed ? 'INDETERMINATE' : issued ? 'COMMITTED' : 'DENIED'));
    tx.addEventListener('abort', () => resolve(collision ? 'CONFLICT' : 'ABORTED'));
    try {
      if (!current()) return;
      const write = tx.objectStore(storeName).add(record);
      issued = true;
      write.addEventListener('error', () => {
        failed = true;
        collision = write.error?.name === 'ConstraintError';
      });
    } catch {
      try { tx.abort(); } catch { resolve('INDETERMINATE'); }
    }
  });
}
