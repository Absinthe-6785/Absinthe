import { API_URL } from './config';
import { remotePersistenceDomainForUrl, runtimeAccountSyncAccountId, runtimeAccountSyncAvailability } from './remoteBoundary';
import { supabase } from './supabase';
import type { NotesCloudCopyLocalPreflightResult, NotesCloudCopySnapshot } from './notesCloudCopyLocalPreflight';

export type LaptopPublicationPreview = Extract<NotesCloudCopyLocalPreflightResult, { status: 'ELIGIBLE_PREVIEW_ONLY' }>;
export type LaptopPublicationPayload = Readonly<{
  noteId: string;
  approvalOperationId: string;
  snapshot: NotesCloudCopySnapshot;
}>;
export type LaptopPublicationStatus = 'VERIFIED' | 'DISABLED' | 'CONFLICT' | 'BAD_REQUEST'
  | 'INDETERMINATE' | 'UNAVAILABLE' | 'SOURCE_CHANGED' | 'STALE_RESULT' | 'REPEAT_BLOCKED';

export interface LaptopPublicationDependencies {
  featureEnabled: () => boolean;
  getRuntimeAccountId: () => string | null;
  isTransportAvailable: () => boolean;
  getSession: () => ReturnType<typeof supabase.auth.getSession>;
  fetch: typeof fetch;
  apiUrl: string;
}
const dependencies: LaptopPublicationDependencies = {
  featureEnabled: () => import.meta.env.VITE_NOTES_LAPTOP_PUBLISH_ENABLED === 'true'
    || import.meta.env.VITE_NOTES_LAPTOP_PUBLISH_ENABLED === '1',
  getRuntimeAccountId: runtimeAccountSyncAccountId,
  isTransportAvailable: () => runtimeAccountSyncAvailability().transportAvailable,
  getSession: () => supabase.auth.getSession(),
  fetch: (...args) => fetch(...args),
  apiUrl: API_URL,
};

export function notesLaptopPublicationUiEnabled(accountId: string | null): boolean {
  return !!accountId && dependencies.featureEnabled() && dependencies.isTransportAvailable()
    && dependencies.getRuntimeAccountId() === accountId;
}

export function sameLaptopPublicationSnapshot(a: NotesCloudCopySnapshot, b: NotesCloudCopySnapshot): boolean {
  return a.title === b.title && a.body === b.body && a.updated_at === b.updated_at && a.starred === b.starred;
}

/** One user-requested dispatch only. No retries, polling, local writes, or browser attestations.
 * onDispatch atomically claims the account+Note in the panel's lifetime ledger BEFORE fetch.
 * The operation ID is only a lookup key; the server must verify its pre-existing DB approval.
 */
export async function requestLaptopPublication(
  mode: 'publish' | 'status',
  payload: LaptopPublicationPayload,
  expectedAccountId: string,
  preview: LaptopPublicationPreview,
  isOwnerCurrent: () => boolean,
  onDispatch: () => boolean,
  deps: LaptopPublicationDependencies = dependencies,
): Promise<LaptopPublicationStatus> {
  const current = () => {
    try {
      return isOwnerCurrent() && preview.isCurrentInMemory()
        && deps.getRuntimeAccountId() === expectedAccountId;
    } catch { return false; }
  };
  if (!deps.featureEnabled()) return 'DISABLED';
  if (!payload.noteId || payload.noteId !== preview.localNoteId
    || payload.noteId !== payload.noteId.trim() || payload.noteId.length > 512
    || !payload.approvalOperationId || payload.approvalOperationId !== payload.approvalOperationId.trim()
    || payload.approvalOperationId.length > 512
    || !sameLaptopPublicationSnapshot(payload.snapshot, preview.snapshot)) return 'BAD_REQUEST';
  if (!current()) return 'SOURCE_CHANGED';
  if (!deps.isTransportAvailable()) return 'UNAVAILABLE';
  try {
    if (!await preview.isCurrent() || !current()) return 'SOURCE_CHANGED';
  } catch { return 'SOURCE_CHANGED'; }
  let session: Awaited<ReturnType<LaptopPublicationDependencies['getSession']>>;
  try { session = await deps.getSession(); } catch { return current() ? 'UNAVAILABLE' : 'STALE_RESULT'; }
  if (!current()) return 'STALE_RESULT';
  const token = session.data.session?.access_token;
  if (session.error || !token || session.data.session?.user.id !== expectedAccountId) return 'UNAVAILABLE';
  try {
    if (!await preview.isCurrent() || !current()) return 'SOURCE_CHANGED';
  } catch { return 'SOURCE_CHANGED'; }
  const path = `/api/notes/laptop-publication${mode === 'status' ? '/status' : ''}`;
  const url = `${deps.apiUrl.replace(/\/$/, '')}${path}`;
  try {
    if (new URL(url).pathname !== path || remotePersistenceDomainForUrl(url) !== 'notes') return 'UNAVAILABLE';
  } catch { return 'UNAVAILABLE'; }
  let response: Response;
  try {
    if (!deps.featureEnabled()) return 'DISABLED';
    if (!deps.isTransportAvailable() || !current()) return 'SOURCE_CHANGED';
    // Serialize only the contracted fields, never authority/sourceRevision or user attestations.
    const body = JSON.stringify({ noteId: payload.noteId, approvalOperationId: payload.approvalOperationId,
      snapshot: { title: preview.snapshot.title, body: preview.snapshot.body,
        updated_at: preview.snapshot.updated_at, starred: preview.snapshot.starred } });
    if (!current()) return 'SOURCE_CHANGED';
    if (!onDispatch()) return 'REPEAT_BLOCKED';
    response = await deps.fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body,
    });
  } catch { return current() ? 'INDETERMINATE' : 'STALE_RESULT'; }
  if (!current()) return 'STALE_RESULT';
  if (response.status === 423) return 'DISABLED';
  if (response.status === 409) return 'CONFLICT';
  if (response.status === 400) return 'BAD_REQUEST';
  try {
    const value: unknown = await response.json();
    if (!current()) return 'STALE_RESULT';
    const record = value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown> : null;
    if (response.status === 503) {
      // Distinguish ONLY exact bounded server details; never expose arbitrary error text.
      if (record?.detail === 'LAPTOP_PUBLICATION_UNAVAILABLE') return 'UNAVAILABLE';
      return 'INDETERMINATE';
    }
    if (!response.ok) return response.status >= 500 ? 'INDETERMINATE' : 'UNAVAILABLE';
    return record?.status === 'VERIFIED' && record.noteId === payload.noteId
      && record.approvalOperationId === payload.approvalOperationId ? 'VERIFIED' : 'INDETERMINATE';
  } catch { return current() ? 'INDETERMINATE' : 'STALE_RESULT'; }
}
