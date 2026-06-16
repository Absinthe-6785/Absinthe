# K-88A — Vault Auto Snapshot & Recovery Foundation

Design report for local durability: automatic versioned snapshots, validation, and recovery readiness without a full restore UI.

## Context

K-88 confirmed that critical knowledge data lives in browser `localStorage`. Clearing site data or switching browsers without export causes permanent loss for local-only users. K-88A adds **automatic local snapshots** as a first recovery layer.

## Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                     Vault mutations                          │
│  useNotesStore.persistNotes / persistFolders                 │
└──────────────────────────┬──────────────────────────────────┘
                           │ debounce 30s
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              vaultSnapshotAuto.scheduleAutoSnapshot          │
│              → buildVaultSnapshot (slot: last)               │
│              → saveVaultSnapshot + prune                       │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│              App mount: runPeriodicSnapshotSlots             │
│              → daily slot (daily-YYYY-MM-DD)                   │
│              → weekly slot (weekly-YYYY-Www)                   │
└─────────────────────────────────────────────────────────────┘

Storage layout (localStorage):
  absinthe:vault-snapshot:index:v1          → index of entries
  absinthe:vault-snapshot:payload:{id}:v1   → full snapshot JSON
```

### Modules

| Module | Responsibility |
|--------|----------------|
| `vaultSnapshotConstants.ts` | Schema version, storage keys, retention caps |
| `vaultSnapshotScope.ts` | Canonical include/exclude scope + extension collectors |
| `vaultSnapshotBuild.ts` | Build / parse snapshot payloads |
| `vaultSnapshotStore.ts` | Persist, enumerate, prune |
| `vaultSnapshotValidate.ts` | Integrity + restore readiness |
| `vaultSnapshotAuto.ts` | Debounced last + periodic daily/weekly |
| `vaultStorageMetrics.ts` | Vault size, snapshot stats, DLP warnings |

## Snapshot schema

Wrapper schema **v1** (`VAULT_SNAPSHOT_SCHEMA_VERSION`) wraps the existing vault backup manifest (**v2**) plus extensions:

```typescript
interface VaultSnapshot {
  snapshotSchemaVersion: 1;
  kind: 'absinthe-vault-snapshot';
  snapshotId: string;
  slot: 'last' | 'daily' | 'weekly';
  slotKey: string;
  createdAt: string;
  contentFingerprint: string;
  appVersion: string;
  vault: VaultBackupManifest;
  extensions: VaultSnapshotExtensions;
  scope: { included, excluded, manifestDoc };
}
```

## Recovery model

K-88A implements infrastructure only — no restore UI.

| Capability | API |
|------------|-----|
| Discover | `enumerateVaultSnapshots()`, `getLatestSnapshotSummary()` |
| Validate | `validateVaultSnapshot()`, `validateVaultSnapshotJson()` |
| Restore readiness | `assessSnapshotRestoreReadiness()` → `toRestoreReadyManifest()` |
| Future restore | Reuse `buildVaultRestorePreview` / `applyVaultRestore` on manifest |

## Versioning & migration

| Layer | Version | Strategy |
|-------|---------|----------|
| Snapshot wrapper | v1 | Bump `snapshotSchemaVersion`; old snapshots pruned by retention |
| Vault manifest | v2 | Reuse `importVaultBackup` validators |
| Extensions | informal | Forward-compatible JSON; unknown fields preserved |

Validation rejects `snapshotSchemaVersion > current`. Fingerprint mismatch flags tampering or partial writes.

## Vault scope (canonical manifest)

**Included:** notes, blocks, tags, favorites, classifications, weak topics, relations, wiki links, folders, app settings, saved/rule/database views, knowledge history, focus presets, workspace preferences, health local state.

**Excluded:** knowledge index, graph layouts, search/cosmos caches, session navigation, workspace session UI.

**Cloud-only (documented):** planner, workout history, recipes, InBody — recover via Supabase when synced.


| Slot | Policy |
|------|--------|
| **last** | 1 entry; debounced 30s after edits |
| **daily** | 1 per UTC day; keep newest 7 |
| **weekly** | 1 per ISO week; keep newest 4 |

- Skip unchanged fingerprints per slot
- ~4 MB total budget; prune oldest non-last first

## Recovery roadmap

| Ticket | Scope |
|--------|-------|
| **K-88B** | Vault export expansion |
| **K-88C** | Recovery Center |
| **K-88D** | Snapshot import/restore UI |
