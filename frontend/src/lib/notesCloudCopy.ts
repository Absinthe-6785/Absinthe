import { API_URL } from './config';
import {
  preflightLocalNoteForCloudCopy,
  type NotesCloudCopyLocalPreflightResult,
  type NotesCloudCopySnapshot,
} from './notesCloudCopyLocalPreflight';
import { remotePersistenceDomainForUrl, runtimeAccountSyncAccountId, runtimeAccountSyncAvailability } from './remoteBoundary';
import { supabase } from './supabase';

export type NotesCloudCopyStatus =
  | 'CREATED'
  | 'ALREADY_COPIED'
  | 'DISABLED'
  | 'SOURCE_CHANGED'
  | 'INELIGIBLE'
  | 'CONFLICT'
  | 'INDETERMINATE'
  | 'UNAVAILABLE'
  | 'STALE_RESULT';

export type NotesCloudCopyResult = Readonly<{
  status: NotesCloudCopyStatus;
  cloudNoteId?: string;
}>;

export type NotesCloudCopyReadbackStatus =
  | 'RESERVED'
  | 'LIVE'
  | 'RETIRED'
  | 'INDETERMINATE'
  | 'UNAVAILABLE';

export type NotesCloudCopyReadbackResult = Readonly<{
  status: NotesCloudCopyReadbackStatus | 'STALE_RESULT';
}>;

export interface NotesCloudCopyDependencies {
  readonly featureEnabled: () => boolean;
  readonly getRuntimeAccountId: () => string | null;
  readonly isTransportAvailable: () => boolean;
  readonly getSession: () => ReturnType<typeof supabase.auth.getSession>;
  readonly fetch: typeof fetch;
  readonly apiUrl: string;
}

const dependencies: NotesCloudCopyDependencies = {
  featureEnabled: () => import.meta.env.VITE_NOTES_CLOUD_COPY_ENABLED === 'true'
    || import.meta.env.VITE_NOTES_CLOUD_COPY_ENABLED === '1',
  getRuntimeAccountId: runtimeAccountSyncAccountId,
  isTransportAvailable: () => runtimeAccountSyncAvailability().transportAvailable,
  getSession: () => supabase.auth.getSession(),
  fetch: (...args) => fetch(...args),
  apiUrl: API_URL,
};

function validCloudNoteId(value: unknown): value is string {
  if (typeof value !== 'string' || value.length !== 36) return false;
  const canonicalUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return canonicalUuid.test(value) && value !== '00000000-0000-0000-0000-000000000000';
}

function currentRequestAllowed(
  expectedAccountId: string,
  preview: Extract<NotesCloudCopyLocalPreflightResult, { status: 'ELIGIBLE_PREVIEW_ONLY' }>,
  isOwnerCurrent: () => boolean,
  deps: NotesCloudCopyDependencies,
): boolean {
  try {
    return deps.featureEnabled() && deps.isTransportAvailable()
      && deps.getRuntimeAccountId() === expectedAccountId
      && isOwnerCurrent() && preview.isCurrentInMemory();
  } catch { return false; }
}

/**
 * Submit one explicitly confirmed snapshot. The operation is isolated from
 * normal Notes sync and is unavailable unless its own build flag is enabled.
 * The server remains the only identity issuer and performs exact readback.
 */
export async function createNotesCloudCopy(
  localNoteId: string,
  expectedAccountId: string,
  preview: NotesCloudCopyLocalPreflightResult,
  isOwnerCurrent: () => boolean,
  deps: NotesCloudCopyDependencies = dependencies,
): Promise<NotesCloudCopyResult> {
  if (!deps.featureEnabled()) return { status: 'DISABLED' };
  if (preview.status !== 'ELIGIBLE_PREVIEW_ONLY' || preview.localNoteId !== localNoteId) {
    return { status: 'INELIGIBLE' };
  }
  if (!currentRequestAllowed(expectedAccountId, preview, isOwnerCurrent, deps)) return { status: 'SOURCE_CHANGED' };
  try {
    if (!await preview.isCurrent()) return { status: 'SOURCE_CHANGED' };
  } catch { return { status: 'SOURCE_CHANGED' }; }
  if (!currentRequestAllowed(expectedAccountId, preview, isOwnerCurrent, deps)) return { status: 'SOURCE_CHANGED' };

  let session: Awaited<ReturnType<NotesCloudCopyDependencies['getSession']>>;
  try { session = await deps.getSession(); } catch { return { status: 'UNAVAILABLE' }; }
  const accessToken = session.data.session?.access_token;
  const sessionAccountId = session.data.session?.user?.id;
  if (session.error || !accessToken || sessionAccountId !== expectedAccountId) return { status: 'UNAVAILABLE' };

  // Recheck durable local Notes and attachment ownership after auth retrieval,
  // then recheck synchronously at the exact fetch dispatch boundary.
  try {
    if (!await preview.isCurrent()) return { status: 'SOURCE_CHANGED' };
  } catch { return { status: 'SOURCE_CHANGED' }; }
  if (!currentRequestAllowed(expectedAccountId, preview, isOwnerCurrent, deps)) return { status: 'SOURCE_CHANGED' };

  const url = `${deps.apiUrl.replace(/\/$/, '')}/api/notes/cloud-copy`;
  try {
    if (remotePersistenceDomainForUrl(url) !== 'notes' || new URL(url).pathname !== '/api/notes/cloud-copy') {
      return { status: 'UNAVAILABLE' };
    }
  } catch { return { status: 'UNAVAILABLE' }; }

  let requestStarted = false;
  let response: Response;
  try {
    if (!currentRequestAllowed(expectedAccountId, preview, isOwnerCurrent, deps)) return { status: 'SOURCE_CHANGED' };
    requestStarted = true;
    response = await deps.fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ localNoteId, snapshot: preview.snapshot satisfies NotesCloudCopySnapshot }),
    });
  } catch {
    return { status: requestStarted ? 'INDETERMINATE' : 'UNAVAILABLE' };
  }

  if (!isOwnerCurrent()) return { status: 'STALE_RESULT' };
  if (response.status === 423) return { status: 'DISABLED' };
  if (response.status === 409) return { status: 'CONFLICT' };
  if (response.status === 400 || response.status === 413) return { status: 'INELIGIBLE' };
  if (!response.ok) return { status: response.status >= 500 ? 'INDETERMINATE' : 'UNAVAILABLE' };

  try {
    const value: unknown = await response.json();
    if (!isOwnerCurrent()) return { status: 'STALE_RESULT' };
    if (!value || typeof value !== 'object' || Array.isArray(value)) return { status: 'INDETERMINATE' };
    const record = value as Record<string, unknown>;
    if (record.localNoteId !== localNoteId || !validCloudNoteId(record.cloudNoteId)
      || record.cloudNoteId === localNoteId) return { status: 'INDETERMINATE' };
    if (record.status !== 'created' && record.status !== 'already_copied') return { status: 'INDETERMINATE' };
    return { status: record.status === 'created' ? 'CREATED' : 'ALREADY_COPIED', cloudNoteId: record.cloudNoteId };
  } catch { return { status: 'INDETERMINATE' }; }
}

function statusRequestAllowed(expectedAccountId: string, isOwnerCurrent: () => boolean,
  deps: NotesCloudCopyDependencies): boolean {
  try {
    return deps.featureEnabled() && deps.isTransportAvailable()
      && deps.getRuntimeAccountId() === expectedAccountId && isOwnerCurrent();
  } catch { return false; }
}

function statusOwnerCurrent(isOwnerCurrent: () => boolean): boolean {
  try { return isOwnerCurrent(); } catch { return false; }
}

/** Manually reads an account-bound historical copy status; it never sends Note content. */
export async function readNotesCloudCopyStatus(
  localNoteId: string,
  expectedAccountId: string,
  isOwnerCurrent: () => boolean,
  deps: NotesCloudCopyDependencies = dependencies,
): Promise<NotesCloudCopyReadbackResult> {
  if (typeof localNoteId !== 'string' || !localNoteId || localNoteId !== localNoteId.trim() || localNoteId.length > 512) {
    return { status: 'UNAVAILABLE' };
  }
  if (!statusRequestAllowed(expectedAccountId, isOwnerCurrent, deps)) {
    return { status: statusOwnerCurrent(isOwnerCurrent) ? 'UNAVAILABLE' : 'STALE_RESULT' };
  }

  let session: Awaited<ReturnType<NotesCloudCopyDependencies['getSession']>>;
  try { session = await deps.getSession(); } catch { return { status: 'UNAVAILABLE' }; }
  const accessToken = session.data.session?.access_token;
  const sessionAccountId = session.data.session?.user?.id;
  if (session.error || !accessToken || sessionAccountId !== expectedAccountId) return { status: 'UNAVAILABLE' };
  if (!statusRequestAllowed(expectedAccountId, isOwnerCurrent, deps)) return { status: 'STALE_RESULT' };

  const url = `${deps.apiUrl.replace(/\/$/, '')}/api/notes/cloud-copy/status`;
  try {
    if (remotePersistenceDomainForUrl(url) !== 'notes' || new URL(url).pathname !== '/api/notes/cloud-copy/status') {
      return { status: 'UNAVAILABLE' };
    }
  } catch { return { status: 'UNAVAILABLE' }; }

  let response: Response;
  try {
    if (!statusRequestAllowed(expectedAccountId, isOwnerCurrent, deps)) return { status: 'STALE_RESULT' };
    response = await deps.fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ localNoteId }),
    });
  } catch {
    return { status: statusOwnerCurrent(isOwnerCurrent) ? 'INDETERMINATE' : 'STALE_RESULT' };
  }
  if (!statusRequestAllowed(expectedAccountId, isOwnerCurrent, deps)) return { status: 'STALE_RESULT' };
  if (!response.ok) return { status: 'UNAVAILABLE' };

  try {
    const value: unknown = await response.json();
    if (!statusRequestAllowed(expectedAccountId, isOwnerCurrent, deps)) return { status: 'STALE_RESULT' };
    if (!value || typeof value !== 'object' || Array.isArray(value)) return { status: 'INDETERMINATE' };
    const status = (value as Record<string, unknown>).status;
    if (status !== 'RESERVED' && status !== 'LIVE' && status !== 'RETIRED'
      && status !== 'INDETERMINATE' && status !== 'UNAVAILABLE') return { status: 'INDETERMINATE' };
    return { status };
  } catch { return { status: statusOwnerCurrent(isOwnerCurrent) ? 'INDETERMINATE' : 'STALE_RESULT' }; }
}

/** The explicit UI entry point is hidden unless separately enabled at build time. */
export function notesCloudCopyUiEnabled(accountId?: string | null): boolean {
  return dependencies.featureEnabled() && dependencies.isTransportAvailable()
    && (accountId == null || dependencies.getRuntimeAccountId() === accountId);
}

export async function prepareNotesCloudCopy(localNoteId: string): Promise<NotesCloudCopyLocalPreflightResult> {
  return preflightLocalNoteForCloudCopy(localNoteId);
}
