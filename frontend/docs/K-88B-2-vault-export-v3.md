# K-88B-2 — Vault Export v3 Implementation

**Branch:** `k88b-vault-export-v3`  
**Status:** Implemented  
**Depends on:** K-88B-1 export scope alignment audit

---

## Summary

Portable vault export is now **schema v3**. Export scope aligns with K-88A snapshot local extensions and optionally embeds authenticated cloud data.

| Capability | Module |
|------------|--------|
| v3 manifest build | `exportVaultBackup.ts` |
| Shared extensions | `vaultPortableExtensions.ts` |
| Cloud fetch | `vaultCloudExport.ts` |
| Pre-export validation | `vaultExportValidate.ts` |
| Restore simulation | `vaultExtensionRestoreSim.ts` |
| ZIP cloud sidecars | `vaultCloudCsv.ts`, `vaultBackupZip.ts` |

---

## VaultBackupManifest v3

```typescript
{
  schemaVersion: 3,
  kind: 'absinthe-vault-export',
  exportedAt, app, appVersion,
  noteCount, folderCount, relationCount,
  folders[], notes[],
  extensions: { schemaVersion: 1, settings, knowledge, health },
  scope: { included, excluded, cloudGaps, manifestDoc },
  contentFingerprint,
  cloud?: { planner, health, completeness, errors }
}
```

### Included (local)

- Notes, blocks, tags, favorites, weak topics, relations, wiki links, folders
- App settings (`planner-storage`)
- Saved views, rule collections, database views
- Focus presets, workspace preferences
- Knowledge history
- Health local: drafts, memos, routine planned sets, protein UX prefs

### Optional cloud block (authenticated)

Fetched via `/api/backup` plus `/api/weekly_schedules`, `/api/health_routines`, `/api/protein_sources`, `/api/protein_profile`.

Export **succeeds** when cloud fetch fails — `completeness: skipped | partial | full`.

### Excluded

- Derived knowledge index, graph layouts, search/cosmos caches
- Session navigation, workspace session UI
- Auto-snapshot payloads, auth tokens

### Unsupported in v3 (documented)

- **Protein daily intake logs** — no bulk API; noted in `scope.cloudGaps`

---

## Recovery Guarantees

| Scenario | v3 export recovery |
|----------|-------------------|
| Site data deletion + import file | **Core vault** (notes, folders, metadata) via existing import |
| Extensions in file | **Present in manifest** — restore apply path deferred to K-88B-3 |
| Cloud block in file | **Present in manifest** — cloud restore deferred to K-88B-3 |
| v2 legacy export | **Fully supported** on import (core only) |
| Unauthenticated export | Local extensions + core; cloud block omitted |

### Protection classification (future UI)

| Status | Condition |
|--------|-----------|
| Protected | v3 export with extensions + cloud `completeness: full` |
| Partially Protected | v3 local-only or cloud `partial` |
| No External Backup | No export file |

---

## Compatibility

| Version | Export | Import |
|---------|--------|--------|
| v1/v2 | Legacy files | `normalizeVaultBackupManifest` — core restore |
| v3 | Default from Settings | Core restore today; extensions/cloud validated |

`upgradeVaultBackupToV3()` upgrades v2 manifests for tooling.

---

## ZIP Layout

```text
manifest.json
README.txt
notes/*.md
cloud/                    # when cloud block present
  planner-schedules.csv
  planner-todos.csv
  workouts.csv
  inbody.csv
  ...
```

---

## Tests

`vaultExportV3.test.ts` — v2 compat, v3 build, extensions, cloud, validation, ZIP sidecars, restore simulation.

---

## Follow-up

| Ticket | Scope |
|--------|-------|
| K-88B-3 | Apply extensions + cloud on import |
| K-88C | Recovery Center |
| K-88D | Snapshot import UI |
| K-88E | Recovery validation wizard |

---

*Implementation complete. Full restore UI intentionally deferred.*
