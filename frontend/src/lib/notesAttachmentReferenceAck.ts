import type { NoteBase } from '../components/views/noteUtils';
import type { NotesAuthorityRequest } from './notesAccountAuthority';

export interface NoteAttachmentReferenceWrite {
  readonly request: NotesAuthorityRequest;
  readonly expectedNote: NoteBase;
  readonly nextNote: NoteBase;
  readonly references: readonly string[];
  readonly isCurrent: () => boolean;
}

/** Point-in-time local Notes evidence, not cross-store atomicity or future retention. */
export interface NoteAttachmentReferenceAck {
  readonly status: 'DENIED' | 'NOT_STARTED' | 'REFERENCE_PERSISTED' | 'INCOMPLETE' | 'INDETERMINATE';
  readonly write: 'NOT_STARTED' | 'COMMITTED' | 'ABORTED' | 'INDETERMINATE';
  readonly readback: 'NOT_RUN' | 'MATCHED' | 'MISMATCH' | 'UNAVAILABLE';
  readonly reason?: string;
}

export function attachmentReferenceAck(
  status: NoteAttachmentReferenceAck['status'],
  write: NoteAttachmentReferenceAck['write'] = 'NOT_STARTED',
  readback: NoteAttachmentReferenceAck['readback'] = 'NOT_RUN',
  reason?: string,
): NoteAttachmentReferenceAck {
  return Object.freeze({ status, write, readback, ...(reason ? { reason } : {}) });
}
