/** K-88A — Auto snapshot schema and retention policy. */
import { ABSINTHE_APP_VERSION } from './vaultBackupConstants';

export const VAULT_SNAPSHOT_SCHEMA_VERSION = 1;
export const VAULT_SNAPSHOT_KIND = 'absinthe-vault-snapshot' as const;

export const SNAPSHOT_INDEX_KEY = 'absinthe:vault-snapshot:index:v1';
export const SNAPSHOT_PAYLOAD_PREFIX = 'absinthe:vault-snapshot:payload:';

export type VaultSnapshotSlot = 'last' | 'daily' | 'weekly';

export const SNAPSHOT_RETENTION = {
  maxDaily: 7,
  maxWeekly: 4,
  /** Soft cap for all snapshot payloads combined (bytes). */
  maxTotalBytes: 4_000_000,
} as const;

export const SNAPSHOT_SCOPE_DOC = `
Included in local snapshots:
- Notes, blocks, tags, favorites, relations, weak-topic flags (vault manifest)
- Note folders
- App settings (planner-storage)
- Saved views, rule collections, database views
- Knowledge history events
- Focus presets, workspace preferences
- Health local drafts/memos, recovery log, routine planned sets, protein UX prefs

Excluded (by design):
- Derived knowledge index, graph layouts, search caches
- Session navigation state
- Cloud-only planner, workout logs, recipes (see extensions.cloudScope)
`;

export { ABSINTHE_APP_VERSION };
