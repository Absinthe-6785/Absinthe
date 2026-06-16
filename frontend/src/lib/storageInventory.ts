/**
 * K-88 — Canonical browser storage inventory for audit tests and future backup work.
 * Source of truth: code search across frontend/src (2026-06).
 */

export type StorageLayer = 'localStorage' | 'sessionStorage' | 'supabase' | 'memory' | 'file-export';

export type DurabilityTier = 'critical' | 'important' | 'disposable';

export interface StorageEntry {
  id: string;
  label: string;
  layer: StorageLayer;
  keyOrTable: string;
  tier: DurabilityTier;
  /** Human-readable payload description */
  holds: string;
  source: string;
  recoverable: 'vault-export' | 'cloud-sync' | 'regenerate' | 'unrecoverable' | 'partial';
}

/** Prefix / exact keys cleared together on Chromium "Cookies and other site data". */
export const LOCAL_STORAGE_KEYS = [
  'notes-v2',
  'note-folders-v2',
  'note-active-v2',
  'notes-storage-migrated-v2',
  'planner-storage',
  'note-workspace-session-v1',
  'workspace-prefs-v1',
  'focus-presets-v1',
  'note-saved-views-v1',
  'note-rule-collections-v1',
  'note-database-views-v1',
  'absinthe.workspaceSearch.recent',
  'absinthe-knowledge-panel-width',
  'absinthe-graph-view-mode',
  'absinthe:knowledge-history:v1',
  'absinthe:knowledge-history-bootstrap:v1',
  'absinthe:knowledge-history-bootstrap-summary:v1',
  'absinthe:knowledge-history-bootstrap-summary-dismissed:v1',
  'absinthe:cosmos-onboarding:v1',
  'absinthe:countdown-reviewed',
  'absinthe:dday-migration-v1',
  'absinthe.slashRecent.v1',
  'absinthe-vault-restore-snapshot',
  'healthSplitCount',
  'healthRoutinePlannedSets',
  'absinthe:recovery-log',
  'proteinRecentSources',
  'proteinSourceUseCounts',
] as const;

/** Dynamic localStorage key patterns (date-scoped). */
export const LOCAL_STORAGE_PREFIXES = [
  'healthDraft:',
  'healthMemo:',
] as const;

export const SESSION_STORAGE_KEYS = [
  'absinthe.noteNav.v1',
  'absinthe.noteNav.breadcrumb',
  'absinthe.noteNav.returnTab',
  'workoutToggle',
] as const;

/** Supabase SDK — not app-defined key name; pattern documented for audits. */
export const SUPABASE_AUTH_STORAGE_PATTERN = 'sb-*-auth-token';

export const STORAGE_INVENTORY: readonly StorageEntry[] = [
  {
    id: 'notes',
    label: 'Notes (title, body, timestamps)',
    layer: 'localStorage',
    keyOrTable: 'notes-v2',
    tier: 'critical',
    holds: 'NoteBase[] — block JSON body, folderId, starred, deletedAt',
    source: 'noteUtils.ts / useNotesStore.ts',
    recoverable: 'vault-export',
  },
  {
    id: 'note-properties',
    label: 'Note metadata (tags, custom properties, weakTopic)',
    layer: 'localStorage',
    keyOrTable: 'notes-v2 → note.properties',
    tier: 'important',
    holds: 'tags JSON in properties.tags; weakTopic; user key/value pairs',
    source: 'noteTags.ts / noteProperties.ts',
    recoverable: 'vault-export',
  },
  {
    id: 'note-relations',
    label: 'Typed relations',
    layer: 'localStorage',
    keyOrTable: 'notes-v2 → note.relations',
    tier: 'important',
    holds: 'Record<relationKey, targetNoteId[]>',
    source: 'relationNormalize.ts',
    recoverable: 'vault-export',
  },
  {
    id: 'wiki-links',
    label: 'Wiki links',
    layer: 'localStorage',
    keyOrTable: 'notes-v2 → note.body',
    tier: 'critical',
    holds: '[[Title]] tokens in block markdown body',
    source: 'noteUtils.ts extractLinks',
    recoverable: 'vault-export',
  },
  {
    id: 'inline-body-tags',
    label: 'Inline #tags in body',
    layer: 'localStorage',
    keyOrTable: 'notes-v2 → note.body',
    tier: 'important',
    holds: '#tag tokens in block text (separate from properties.tags)',
    source: 'noteUtils.ts extractTags',
    recoverable: 'vault-export',
  },
  {
    id: 'favorites',
    label: 'Favorites (starred)',
    layer: 'localStorage',
    keyOrTable: 'notes-v2 → note.starred',
    tier: 'important',
    holds: 'boolean per note',
    source: 'useNotesStore.ts',
    recoverable: 'vault-export',
  },
  {
    id: 'folders',
    label: 'Note folders',
    layer: 'localStorage',
    keyOrTable: 'note-folders-v2',
    tier: 'critical',
    holds: 'NoteFolderBase[]',
    source: 'noteUtils.ts',
    recoverable: 'vault-export',
  },
  {
    id: 'active-note',
    label: 'Active note selection',
    layer: 'localStorage',
    keyOrTable: 'note-active-v2',
    tier: 'disposable',
    holds: 'Last opened note id',
    source: 'noteUtils.ts',
    recoverable: 'unrecoverable',
  },
  {
    id: 'knowledge-index',
    label: 'Knowledge index (links, tags index, backlinks)',
    layer: 'memory',
    keyOrTable: 'KnowledgeIndexService',
    tier: 'disposable',
    holds: 'In-memory graph derived from notes',
    source: 'KnowledgeIndexService.ts',
    recoverable: 'regenerate',
  },
  {
    id: 'knowledge-history',
    label: 'Knowledge history events',
    layer: 'localStorage',
    keyOrTable: 'absinthe:knowledge-history:v1',
    tier: 'important',
    holds: 'NOTE_CREATED, LINK_*, AREA_* events (max 5000)',
    source: 'historyStorage.ts',
    recoverable: 'partial',
  },
  {
    id: 'workspace-views',
    label: 'Saved views, rule collections, database views',
    layer: 'localStorage',
    keyOrTable: 'note-saved-views-v1, note-rule-collections-v1, note-database-views-v1',
    tier: 'important',
    holds: 'Query definitions, view layouts — not note content',
    source: 'workspace/*Storage.ts',
    recoverable: 'unrecoverable',
  },
  {
    id: 'workspace-session',
    label: 'Workspace session & prefs',
    layer: 'localStorage',
    keyOrTable: 'note-workspace-session-v1, workspace-prefs-v1, focus-presets-v1',
    tier: 'disposable',
    holds: 'UI workspace activation, pins, focus presets',
    source: 'workspaceSessionStorage.ts',
    recoverable: 'unrecoverable',
  },
  {
    id: 'app-settings',
    label: 'App settings & theme',
    layer: 'localStorage',
    keyOrTable: 'planner-storage',
    tier: 'important',
    holds: 'darkMode, language, note typography colors, weightUnits',
    source: 'useAppStore.ts',
    recoverable: 'unrecoverable',
  },
  {
    id: 'health-workouts-cloud',
    label: 'Workout logs & exercise blocks',
    layer: 'supabase',
    keyOrTable: 'workout_logs, exercise_blocks, health_routines',
    tier: 'critical',
    holds: 'Sets, reps, routine templates',
    source: 'backend/main.py / HealthView.tsx',
    recoverable: 'cloud-sync',
  },
  {
    id: 'health-workouts-local',
    label: 'Workout drafts & memos',
    layer: 'localStorage',
    keyOrTable: 'healthDraft:*, healthMemo:*',
    tier: 'important',
    holds: 'Unsaved daily workout JSON, daily health memo text',
    source: 'HealthView.tsx',
    recoverable: 'unrecoverable',
  },
  {
    id: 'planner-data',
    label: 'Calendar, todos, routines, recipes',
    layer: 'supabase',
    keyOrTable: 'schedules, todos, routines, recipes, weekly_schedules',
    tier: 'critical',
    holds: 'Planner domain — API only, no localStorage cache',
    source: 'backend/main.py / useDaily.ts',
    recoverable: 'cloud-sync',
  },
  {
    id: 'nav-session',
    label: 'Note navigation stack',
    layer: 'sessionStorage',
    keyOrTable: 'absinthe.noteNav.v1',
    tier: 'disposable',
    holds: 'Back/forward note navigation per tab',
    source: 'noteNavigationStack.ts',
    recoverable: 'unrecoverable',
  },
  {
    id: 'vault-snapshot',
    label: 'Vault restore undo snapshot',
    layer: 'localStorage',
    keyOrTable: 'absinthe-vault-restore-snapshot',
    tier: 'disposable',
    holds: 'Pre-import notes+folders for one-step undo',
    source: 'vaultRestoreSnapshot.ts',
    recoverable: 'partial',
  },
  {
    id: 'auth-session',
    label: 'Auth session (JWT)',
    layer: 'localStorage',
    keyOrTable: SUPABASE_AUTH_STORAGE_PATTERN,
    tier: 'important',
    holds: 'Supabase session — required for cloud API',
    source: 'lib/supabase.ts',
    recoverable: 'unrecoverable',
  },
] as const;
