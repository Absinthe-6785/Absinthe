export const ACCOUNT_SYNC_AVAILABILITY_STATES = [
  'AVAILABLE',
  'UNAUTHENTICATED',
  'OFFLINE',
  'DISABLED',
] as const;

export type AccountSyncAvailabilityState = typeof ACCOUNT_SYNC_AVAILABILITY_STATES[number];

export type AccountSyncAvailability = Readonly<{
  state: AccountSyncAvailabilityState;
  transportAvailable: boolean;
}>;

export type AccountSyncAvailabilityInput = Readonly<{
  authenticated: boolean;
  capabilityEnabled: boolean;
  online: boolean;
}>;

/**
 * Account transport availability is deliberately independent from the way a
 * domain persists its working copy. Authentication remains an input instead
 * of being inferred from a Notes-specific compatibility mode.
 */
export function deriveAccountSyncAvailability(
  input: AccountSyncAvailabilityInput,
): AccountSyncAvailability {
  if (!input.authenticated) return { state: 'UNAUTHENTICATED', transportAvailable: false };
  if (!input.capabilityEnabled) return { state: 'DISABLED', transportAvailable: false };
  if (!input.online) return { state: 'OFFLINE', transportAvailable: false };
  return { state: 'AVAILABLE', transportAvailable: true };
}

export const DOMAIN_PERSISTENCE_POLICIES = [
  'LOCAL_FIRST',
  'REMOTE_FIRST',
  'LOCAL_ONLY',
  'DEFERRED',
] as const;

export type DomainPersistencePolicy = typeof DOMAIN_PERSISTENCE_POLICIES[number];

export const SYNC_DOMAINS = [
  'notes',
  'note_folders',
  'health_workouts',
  'health_inbody',
  'health_exercise_library',
  'health_nutrition',
  'health_routine_presets',
  'planner_events',
  'planner_ddays',
  'planner_todos',
  'planner_routines',
  'planner_routine_logs',
  'planner_routine_exceptions',
  'planner_weekly_schedules',
  'recipes',
  'health_unsaved_drafts',
  'recipe_drafts',
  'device_preferences',
  'analytics',
  'attachments',
] as const;

export type SyncDomain = typeof SYNC_DOMAINS[number];

export type DomainPolicyDefinition = Readonly<{
  policy: DomainPersistencePolicy;
  remoteTransportEligible: boolean;
  transition?: 'NEEDS_NEW_REMOTE_MODEL';
}>;

/**
 * The only production authority for domain persistence classification. This
 * registry describes policy; it does not report current network availability.
 */
export const DOMAIN_POLICY_REGISTRY = Object.freeze({
  notes: { policy: 'LOCAL_FIRST', remoteTransportEligible: true },
  note_folders: { policy: 'LOCAL_FIRST', remoteTransportEligible: true },
  health_workouts: { policy: 'LOCAL_FIRST', remoteTransportEligible: true },
  health_inbody: { policy: 'LOCAL_FIRST', remoteTransportEligible: true },
  health_exercise_library: { policy: 'LOCAL_FIRST', remoteTransportEligible: true },
  health_nutrition: { policy: 'LOCAL_FIRST', remoteTransportEligible: true },
  health_routine_presets: {
    policy: 'LOCAL_ONLY',
    remoteTransportEligible: false,
    transition: 'NEEDS_NEW_REMOTE_MODEL',
  },
  planner_events: { policy: 'REMOTE_FIRST', remoteTransportEligible: true },
  planner_ddays: { policy: 'REMOTE_FIRST', remoteTransportEligible: true },
  planner_todos: { policy: 'REMOTE_FIRST', remoteTransportEligible: true },
  planner_routines: { policy: 'REMOTE_FIRST', remoteTransportEligible: true },
  planner_routine_logs: { policy: 'REMOTE_FIRST', remoteTransportEligible: true },
  planner_routine_exceptions: { policy: 'REMOTE_FIRST', remoteTransportEligible: true },
  planner_weekly_schedules: { policy: 'REMOTE_FIRST', remoteTransportEligible: true },
  recipes: { policy: 'REMOTE_FIRST', remoteTransportEligible: true },
  health_unsaved_drafts: { policy: 'LOCAL_ONLY', remoteTransportEligible: false },
  recipe_drafts: { policy: 'LOCAL_ONLY', remoteTransportEligible: false },
  device_preferences: { policy: 'LOCAL_ONLY', remoteTransportEligible: false },
  analytics: { policy: 'REMOTE_FIRST', remoteTransportEligible: true },
  attachments: { policy: 'DEFERRED', remoteTransportEligible: false },
} satisfies Record<SyncDomain, DomainPolicyDefinition>);

export function domainPolicy(domain: SyncDomain): DomainPolicyDefinition {
  return DOMAIN_POLICY_REGISTRY[domain];
}

export function domainUsesLocalWorkingCopy(domain: SyncDomain): boolean {
  const policy = domainPolicy(domain).policy;
  return policy === 'LOCAL_FIRST' || policy === 'LOCAL_ONLY';
}

export function canUseDomainRemoteTransport(
  domain: SyncDomain,
  availability: AccountSyncAvailability,
): boolean {
  return availability.transportAvailable && domainPolicy(domain).remoteTransportEligible;
}

export const SYNC_UI_STATES = [
  'IDLE',
  'SYNCING',
  'SYNCED',
  'OFFLINE',
  'RETRYING',
  'ERROR',
  'CONFLICT',
] as const;

export type SyncUiState = typeof SYNC_UI_STATES[number];

const SYNC_UI_STATE_PRIORITY: Readonly<Record<SyncUiState, number>> = {
  IDLE: 0,
  SYNCED: 1,
  RETRYING: 2,
  SYNCING: 3,
  OFFLINE: 4,
  ERROR: 5,
  CONFLICT: 6,
};

/** Deterministically reduce domain states without introducing a sync engine. */
export function aggregateSyncUiState(states: readonly SyncUiState[]): SyncUiState {
  return states.reduce<SyncUiState>((current, candidate) => (
    SYNC_UI_STATE_PRIORITY[candidate] > SYNC_UI_STATE_PRIORITY[current] ? candidate : current
  ), 'IDLE');
}
