export type SupabaseUsageRouteRisk = 'low' | 'medium' | 'high' | 'unknown';

export type SupabaseUsageTrigger =
  | 'app-mount'
  | 'auth-session'
  | 'user-action'
  | 'polling'
  | 'background-refresh'
  | 'provider-transfer'
  | 'unknown';

export type SupabaseUsageRouteCategory =
  | 'auth-session'
  | 'app-bootstrap'
  | 'analytics-polling'
  | 'user-action-read'
  | 'user-action-write'
  | 'sync-read'
  | 'sync-write'
  | 'provider-transfer'
  | 'attachment-transfer'
  | 'background-refresh'
  | 'unknown';

export type SupabaseUsageRouteMetadata = {
  routeKey: string;
  category: SupabaseUsageRouteCategory;
  trigger: SupabaseUsageTrigger;
  risk: SupabaseUsageRouteRisk;
  automatic: boolean;
  expectedFrequency: string;
  retrySensitive: boolean;
  degradeCandidate: boolean;
  notes: string;
  authRequired?: boolean;
  routePattern?: string;
};

export const SUPABASE_USAGE_ROUTE_CATEGORIES = [
  'auth-session',
  'app-bootstrap',
  'analytics-polling',
  'user-action-read',
  'user-action-write',
  'sync-read',
  'sync-write',
  'provider-transfer',
  'attachment-transfer',
  'background-refresh',
  'unknown',
] as const satisfies readonly SupabaseUsageRouteCategory[];

export const SUPABASE_USAGE_TRIGGERS = [
  'app-mount',
  'auth-session',
  'user-action',
  'polling',
  'background-refresh',
  'provider-transfer',
  'unknown',
] as const satisfies readonly SupabaseUsageTrigger[];

export const SUPABASE_USAGE_ROUTE_RISKS = [
  'low',
  'medium',
  'high',
  'unknown',
] as const satisfies readonly SupabaseUsageRouteRisk[];

export const UNKNOWN_SUPABASE_USAGE_ROUTE_METADATA: SupabaseUsageRouteMetadata = {
  routeKey: 'unknown/unclassified',
  category: 'unknown',
  trigger: 'unknown',
  risk: 'unknown',
  automatic: false,
  expectedFrequency: 'Unknown until the route is classified.',
  retrySensitive: true,
  degradeCandidate: true,
  notes: 'Unclassified route. Review and classify before wiring guardrails or treating this route as low risk.',
};

export const SUPABASE_USAGE_ROUTE_METADATA: readonly SupabaseUsageRouteMetadata[] = [
  {
    routeKey: 'supabase.auth.session',
    category: 'auth-session',
    trigger: 'auth-session',
    risk: 'medium',
    automatic: true,
    expectedFrequency: 'At app mount and before allowed authenticated backend requests through authFetch.',
    retrySensitive: true,
    degradeCandidate: false,
    authRequired: false,
    notes: 'Covers Supabase session lookup, auth-state subscription, token refresh, and explicit sign-in/sign-out surfaces.',
  },
  {
    routeKey: 'backend.app-bootstrap.daily',
    category: 'app-bootstrap',
    trigger: 'app-mount',
    risk: 'medium',
    automatic: true,
    expectedFrequency: 'When daily workspace data mounts in remote-capable mode.',
    retrySensitive: true,
    degradeCandidate: true,
    authRequired: true,
    routePattern: '/api/{schedules,todos,routines_with_logs,workouts,inbody}?date=:date',
    notes: 'Source-grounded in useDailyData with remoteSWRKey and revalidateOnFocus disabled.',
  },
  {
    routeKey: 'backend.app-bootstrap.static',
    category: 'app-bootstrap',
    trigger: 'app-mount',
    risk: 'medium',
    automatic: true,
    expectedFrequency: 'When static month and workspace reference data mounts in remote-capable mode.',
    retrySensitive: true,
    degradeCandidate: true,
    authRequired: true,
    routePattern: '/api/{schedules/dates,blocks,health_routines,weekly_schedules}',
    notes: 'Source-grounded in useStaticData with remoteSWRKey and revalidateOnFocus disabled.',
  },
  {
    routeKey: 'legacy.analytics.workout-range-polling',
    category: 'analytics-polling',
    trigger: 'polling',
    risk: 'high',
    automatic: true,
    expectedFrequency: 'Every 60000 ms while the legacy analytics workout range SWR key is active.',
    retrySensitive: true,
    degradeCandidate: true,
    authRequired: true,
    routePattern: '/api/workouts/range?start_date=:start&end_date=:end',
    notes: 'Source-grounded in LegacyAnalyticsView refreshInterval: 60000; K-299 only classifies it and does not change polling.',
  },
  {
    routeKey: 'backend.user-action.read',
    category: 'user-action-read',
    trigger: 'user-action',
    risk: 'medium',
    automatic: false,
    expectedFrequency: 'Only after explicit user navigation, selection, search, or inspection.',
    retrySensitive: true,
    degradeCandidate: true,
    authRequired: true,
    routePattern: '/api/* read route triggered by user intent',
    notes: 'Covers selected-day extras, previous workout lookup, recipe reads, search reads, and export-adjacent reads.',
  },
  {
    routeKey: 'backend.user-action.write',
    category: 'user-action-write',
    trigger: 'user-action',
    risk: 'medium',
    automatic: false,
    expectedFrequency: 'Only after explicit save, delete, restore, mutation, or similar user action.',
    retrySensitive: true,
    degradeCandidate: false,
    authRequired: true,
    routePattern: '/api/* write route triggered by user intent',
    notes: 'Covers useApiMutation, Health writes, Recipe writes, Schedule writes, protein writes, backup restore, and reset actions.',
  },
  {
    routeKey: 'notes.sync.delta-pull',
    category: 'sync-read',
    trigger: 'background-refresh',
    risk: 'medium',
    automatic: true,
    expectedFrequency: 'When Notes cloud sync explicitly pulls changes since the local cursor.',
    retrySensitive: true,
    degradeCandidate: true,
    authRequired: true,
    routePattern: '/api/notes?updated_after=:cursor',
    notes: 'Source-grounded in notesSyncClient changed-since pull; remote data must merge and must not full-replace local notes.',
  },
  {
    routeKey: 'notes.sync.folder-bootstrap',
    category: 'sync-read',
    trigger: 'background-refresh',
    risk: 'medium',
    automatic: true,
    expectedFrequency: 'When Notes folder bootstrap is required for sync bootstrap or recovery.',
    retrySensitive: true,
    degradeCandidate: true,
    authRequired: true,
    routePattern: '/api/note_folders',
    notes: 'Source-grounded in notesSyncClient folder bootstrap guard.',
  },
  {
    routeKey: 'notes.sync.dirty-push',
    category: 'sync-write',
    trigger: 'background-refresh',
    risk: 'medium',
    automatic: true,
    expectedFrequency: 'Only dirty or deleted Notes records should be selected for remote push.',
    retrySensitive: true,
    degradeCandidate: false,
    authRequired: true,
    routePattern: '/api/notes and /api/note_folders write routes',
    notes: 'Source-grounded in K-142 dirty/deleted selection helpers and existing note/folder cloud write paths.',
  },
  {
    routeKey: 'provider.google-drive.transfer',
    category: 'provider-transfer',
    trigger: 'provider-transfer',
    risk: 'medium',
    automatic: false,
    expectedFrequency: 'Only during explicit Google Drive provider connection, upload, download, or recovery actions.',
    retrySensitive: true,
    degradeCandidate: true,
    authRequired: false,
    routePattern: 'https://www.googleapis.com/*',
    notes: 'Provider-side traffic, not Supabase Storage traffic; keep separate from Supabase quota classification.',
  },
  {
    routeKey: 'attachments.remote.transfer',
    category: 'attachment-transfer',
    trigger: 'provider-transfer',
    risk: 'high',
    automatic: false,
    expectedFrequency: 'Only during explicit attachment upload queue execution or explicit remote recovery.',
    retrySensitive: true,
    degradeCandidate: true,
    authRequired: false,
    notes: 'Attachment blobs can be large and are handled through provider abstractions; K-299 does not execute or queue transfers.',
  },
  {
    routeKey: 'backend.background-refresh.heatmap',
    category: 'background-refresh',
    trigger: 'background-refresh',
    risk: 'medium',
    automatic: true,
    expectedFrequency: 'When archive or analytics heatmap/domain-mark surfaces mount in remote-capable mode.',
    retrySensitive: true,
    degradeCandidate: true,
    authRequired: true,
    routePattern: '/api/heatmap',
    notes: 'Source-grounded in LegacyAnalyticsView and archive domain-mark SWR usage with remoteSWRKey.',
  },
] as const;

const metadataByRouteKey = new Map(
  SUPABASE_USAGE_ROUTE_METADATA.map((entry) => [entry.routeKey, entry]),
);

export function getSupabaseUsageRouteMetadata(routeKey: string): SupabaseUsageRouteMetadata {
  return metadataByRouteKey.get(routeKey) ?? {
    ...UNKNOWN_SUPABASE_USAGE_ROUTE_METADATA,
    routeKey,
  };
}

export function isKnownSupabaseUsageRoute(routeKey: string): boolean {
  return metadataByRouteKey.has(routeKey);
}
