import {
  canUseDomainDirectRemotePersistence,
  canUseDomainRemoteTransport,
  deriveAccountSyncAvailability,
  type AccountSyncAvailability,
  type SyncDomain,
} from './syncAuthority';
import { isNotesCloudSyncEnabled } from './syncMode';

export class LocalOnlyRemoteMutationPausedError extends Error {
  constructor(message = 'Remote writes are paused in local-only mode') {
    super(message);
    this.name = 'LocalOnlyRemoteMutationPausedError';
  }
}

let runtimeAccountId: string | null = null;

type AuthorizeSessionRead = (headers: Headers) => void;

/** A read can use the current session, but cannot follow it across replacement. */
export interface RuntimeSessionReadOwner {
  readonly accountId: string;
  readonly signal: AbortSignal;
}

export class SessionReadOwnerChangedError extends Error {
  constructor() {
    super('Read session is no longer current');
    this.name = 'SessionReadOwnerChangedError';
  }
}

let runtimeReadOwner: {
  owner: RuntimeSessionReadOwner;
  controller: AbortController;
  authorize: AuthorizeSessionRead;
} | null = null;

function runtimeCapabilityEnabled(): boolean {
  const disabled = import.meta.env.VITE_ABSINTHE_ACCOUNT_SYNC_DISABLED;
  return disabled !== true && disabled !== 'true' && disabled !== '1';
}

function runtimeOnline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === true;
}

/** Updated synchronously by the authenticated app shell on every auth event. */
export function setRuntimeAccountSyncAccount(
  accountId: string | null | undefined,
  /** Omitted for an unchanged session; null revokes read ownership. */
  authorizeRead?: AuthorizeSessionRead | null,
): void {
  const nextId = accountId?.trim() || null;
  if (nextId === runtimeAccountId && authorizeRead === undefined) return;
  const previous = runtimeReadOwner;
  runtimeAccountId = nextId;
  if (nextId && authorizeRead) {
    const controller = new AbortController();
    runtimeReadOwner = { owner: { accountId: nextId, signal: controller.signal }, controller, authorize: authorizeRead };
  } else {
    runtimeReadOwner = null;
  }
  previous?.controller.abort();
}

export function runtimeSessionReadOwner(): RuntimeSessionReadOwner | null {
  return runtimeReadOwner?.owner ?? null;
}

export function assertRuntimeSessionReadOwner(owner: RuntimeSessionReadOwner): void {
  if (owner.signal.aborted || runtimeSessionReadOwner() !== owner) {
    throw new SessionReadOwnerChangedError();
  }
}

export function authorizeRuntimeSessionRead(owner: RuntimeSessionReadOwner, headers: Headers): void {
  const current = runtimeReadOwner;
  if (current?.owner !== owner || owner.signal.aborted) throw new SessionReadOwnerChangedError();
  current.authorize(headers);
}

/** Synchronous auth-event fence for dormant control-plane IDB transactions. */
export function runtimeAccountSyncAccountId(): string | null {
  return runtimeAccountId;
}

/**
 * Session ownership remains enforced again by authFetch immediately before a
 * request. This synchronous snapshot prevents render-time callers from
 * treating a logged-out or offline runtime as transport-available.
 */
export function runtimeAccountSyncAvailability(): AccountSyncAvailability {
  return deriveAccountSyncAvailability({
    authenticated: runtimeAccountId !== null,
    capabilityEnabled: runtimeCapabilityEnabled(),
    online: runtimeOnline(),
  });
}

export function shouldUseAccountSyncTransport(
  availability: AccountSyncAvailability = runtimeAccountSyncAvailability(),
): boolean {
  return availability.transportAvailable;
}

export function shouldUseDomainSyncTransport(
  domain: SyncDomain,
  availability: AccountSyncAvailability = runtimeAccountSyncAvailability(),
): boolean {
  return canUseDomainRemoteTransport(domain, availability);
}

export function shouldUseDomainRemotePersistence(
  domain: SyncDomain,
  availability: AccountSyncAvailability = runtimeAccountSyncAvailability(),
): boolean {
  return canUseDomainDirectRemotePersistence(domain, availability);
}

export function shouldUseLegacyNotesRemoteData(
  availability: AccountSyncAvailability = runtimeAccountSyncAvailability(),
): boolean {
  return availability.transportAvailable && isNotesCloudSyncEnabled();
}

export function remoteSWRKey<T extends string>(
  key: T,
  domain: SyncDomain,
  availability: AccountSyncAvailability = runtimeAccountSyncAvailability(),
): T | null {
  return shouldUseDomainRemotePersistence(domain, availability) ? key : null;
}

export function isLocalOnlyRemoteMutationPausedError(
  error: unknown,
): error is LocalOnlyRemoteMutationPausedError {
  return error instanceof LocalOnlyRemoteMutationPausedError;
}

export function assertRemoteMutationAllowed(
  domain: SyncDomain,
  availability: AccountSyncAvailability = runtimeAccountSyncAvailability(),
): void {
  if (!shouldUseDomainRemotePersistence(domain, availability)) {
    throw new LocalOnlyRemoteMutationPausedError();
  }
}

export function assertLegacyNotesRemoteAllowed(
  availability: AccountSyncAvailability = runtimeAccountSyncAvailability(),
): void {
  if (!shouldUseLegacyNotesRemoteData(availability)) {
    throw new LocalOnlyRemoteMutationPausedError();
  }
}

const REMOTE_ROUTE_DOMAINS: readonly [RegExp, SyncDomain][] = [
  [/^\/api\/note_folders(?:\/|$)/, 'note_folders'],
  [/^\/api\/notes(?:\/|$)/, 'notes'],
  [/^\/api\/(?:backup|restore|export)(?:\/|$)/, 'notes'],
  [/^\/api\/schedules\/ddays(?:\/|$)/, 'planner_ddays'],
  [/^\/api\/schedules(?:\/|$)/, 'planner_events'],
  [/^\/api\/todos(?:\/|$)/, 'planner_todos'],
  [/^\/api\/routines_with_logs(?:\/|$)/, 'planner_routines'],
  [/^\/api\/routine_logs(?:\/|$)/, 'planner_routine_logs'],
  [/^\/api\/routine_exceptions(?:\/|$)/, 'planner_routine_exceptions'],
  [/^\/api\/routines(?:\/|$)/, 'planner_routines'],
  [/^\/api\/weekly_schedules(?:\/|$)/, 'planner_weekly_schedules'],
  [/^\/api\/recipes(?:\/|$)/, 'recipes'],
  [/^\/api\/blocks(?:\/|$)/, 'health_exercise_library'],
  [/^\/api\/workouts(?:\/|$)/, 'health_workouts'],
  [/^\/api\/inbody(?:\/|$)/, 'health_inbody'],
  [/^\/api\/protein_(?:profile|sources|intake|weekly)(?:\/|$)/, 'health_nutrition'],
  [/^\/api\/health_routines(?:\/|$)/, 'health_routine_presets'],
  [/^\/api\/heatmap(?:\/|$)/, 'analytics'],
  [/^\/api\/reset(?:\/|$)/, 'account_reset'],
] as const;

export function remotePersistenceDomainForUrl(url: string): SyncDomain | null {
  let path: string;
  try {
    path = new URL(url, 'http://absinthe.local').pathname;
  } catch {
    return null;
  }
  return REMOTE_ROUTE_DOMAINS.find(([pattern]) => pattern.test(path))?.[1] ?? null;
}

export function assertRemoteUrlAllowed(
  url: string,
  availability: AccountSyncAvailability = runtimeAccountSyncAvailability(),
): SyncDomain {
  const domain = remotePersistenceDomainForUrl(url);
  if (!domain) throw new LocalOnlyRemoteMutationPausedError('Unregistered remote persistence domain');
  if (domain === 'notes' || domain === 'note_folders') {
    assertLegacyNotesRemoteAllowed(availability);
  } else {
    assertRemoteMutationAllowed(domain, availability);
  }
  return domain;
}
