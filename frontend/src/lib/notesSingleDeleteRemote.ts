import { API_URL } from './config';
import {
  isNotesSingleDeleteActive,
  type NotesSingleDeleteAuthorization,
} from './notesAccountAuthority';
import { supabase } from './supabase';

export type NotesSingleDeleteRemoteResult =
  | { readonly ok: true; readonly outcome: 'deleted' | 'already_absent' }
  | { readonly ok: false; readonly outcome: 'confirmed_not_deleted' | 'ambiguous'; readonly error: string };

interface DeleteResponseBody {
  readonly deleted: true;
  readonly note_id: string;
  readonly account_id: string;
}

function isDeleteResponseBody(value: unknown, accountId: string, noteId: string): value is DeleteResponseBody {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const body = value as Partial<DeleteResponseBody>;
  return Object.keys(value).sort().join(',') === ['account_id', 'deleted', 'note_id'].sort().join(',')
    && body.deleted === true
    && body.account_id === accountId
    && body.note_id === noteId;
}

/**
 * The only RTU remote-write exception. It cannot create/update/batch-delete,
 * and it revalidates account generation before and after every await.
 */
export async function deleteSingleRemoteNote(
  authorization: NotesSingleDeleteAuthorization,
  accountId: string,
  noteId: string,
): Promise<NotesSingleDeleteRemoteResult> {
  if (!isNotesSingleDeleteActive(authorization, accountId, noteId)) {
    return { ok: false, outcome: 'confirmed_not_deleted', error: 'notes_delete_authorization_stale' };
  }
  let session: Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session'];
  try {
    session = (await supabase.auth.getSession()).data.session;
  } catch {
    // No fetch was issued, so no remote mutation could have occurred.
    return { ok: false, outcome: 'confirmed_not_deleted', error: 'notes_delete_session_unavailable' };
  }
  if (!session?.access_token || session.user?.id !== accountId
    || !isNotesSingleDeleteActive(authorization, accountId, noteId)) {
    return { ok: false, outcome: 'confirmed_not_deleted', error: 'notes_delete_account_mismatch' };
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/notes/${encodeURIComponent(noteId)}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
    });
  } catch {
    // The request may have reached the server before the connection failed.
    return { ok: false, outcome: 'ambiguous', error: 'notes_delete_remote_unavailable' };
  }
  if (!isNotesSingleDeleteActive(authorization, accountId, noteId)) {
    return { ok: false, outcome: 'ambiguous', error: 'notes_delete_authorization_stale' };
  }
  // An authenticated 404 proves the row is already absent, which is the
  // required durable postcondition and safely closes an interrupted retry.
  if (response.status === 404) return { ok: true, outcome: 'already_absent' };
  if (!response.ok) return { ok: false, outcome: 'ambiguous', error: `notes_delete_remote_failed_${response.status}` };

  let body: unknown;
  try {
    body = await response.json() as unknown;
  } catch {
    return { ok: false, outcome: 'ambiguous', error: 'notes_delete_remote_receipt_unavailable' };
  }
  if (!isNotesSingleDeleteActive(authorization, accountId, noteId)) {
    return { ok: false, outcome: 'ambiguous', error: 'notes_delete_authorization_stale' };
  }
  if (!isDeleteResponseBody(body, accountId, noteId)) {
    return { ok: false, outcome: 'ambiguous', error: 'notes_delete_remote_receipt_invalid' };
  }
  return { ok: true, outcome: 'deleted' };
}
