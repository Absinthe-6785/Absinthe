# K-88C — Recovery Center & Restore Pipeline

## Summary

K-88C completes the backup/recovery lifecycle: users can export a vault, lose local data, and restore to a working state via **Recovery Center**, **snapshot preview**, and the **restore pipeline**.

## Guarantees

| Capability | Supported |
|------------|-----------|
| Vault Export v3 restore (notes, folders, relations) | Yes |
| Vault Export v2 restore (core only; upgraded to v3 on import) | Yes |
| Local snapshot restore (last / daily / weekly) | Yes |
| Extension restore (settings, saved views, rule collections, database views, focus presets, workspace prefs, knowledge history) | Yes |
| Local health restore (drafts, memos, routine planned sets, recovery log, protein UX prefs) | Yes |
| Cloud block restore via `/api/restore` (when signed in) | Yes, when export included cloud data |
| Schema validation before restore | Yes |
| Fingerprint validation (v3 exports) | Yes |
| Snapshot fingerprint validation | Yes |
| Pre-restore backup snapshot | Yes (optional, default on) |
| Core restore undo (notes/folders only) | Yes (existing `vaultRestoreCanUndo`) |

## User workflows

### Recovery Center (Settings)

- **Recovery status**: last snapshot, snapshot count, last export, cloud sync, protection badge
- **Exports**: import vault backup (JSON/ZIP)
- **Snapshots**: validate integrity, preview restore (opens restore modal)

### Safe restore flow

1. **Preview** — validation report, note/folder selection, impact summary
2. **Options** — restore extensions, restore cloud (if available), backup before restore
3. **Confirm** — import core + apply extensions + cloud restore

## Compatibility

| Source | Core | Extensions | Cloud |
|--------|------|------------|-------|
| Export v3 (JSON/ZIP) | Full | Full (if present in manifest) | Full/partial/skipped per export |
| Export v2 (JSON) | Full | Upgraded from current local state at import time* | Not included |
| Local snapshot | Full | Full (embedded in snapshot) | Not included (cloud-only data) |

\* v2 exports have no embedded extensions. `upgradeVaultBackupToV3` attaches extensions collected at restore-preview time from the **current** browser when upgrading; for true disaster recovery, prefer v3 exports or snapshots.

## Unsupported data (known gaps)

Documented from K-88B/K-88A scope — **not restored** by this pipeline:

- Derived knowledge index, graph layouts, search caches
- Session navigation state
- Protein intake **daily logs** (no bulk restore API; export gap)
- Cloud data not present in export/snapshot (workouts, schedules, etc. remain cloud-only unless export included them)

## Migration behavior

- **v2 → v3**: `normalizeVaultBackupManifest` + `upgradeVaultBackupToV3` on parse/preview
- **Snapshot → manifest**: `manifestFromSnapshot` + `portableExtensionsFromSnapshot` normalizes extension field aliases (`appSettings`, `healthLocal`, flat `savedViews`, etc.)
- **Conflict handling**: unchanged — skip / replace / duplicate per note id

## Limitations

- Extension undo is not covered by core undo snapshot (notes/folders only)
- Cloud restore requires authentication; failures are reported but do not roll back core restore
- Snapshot browser provides validate + preview; destructive restore runs only through the confirm step in the restore modal
- Protection status is heuristic (7-day export window + snapshot + cloud sync)

## Validation scenarios (tests)

| Scenario | Description | Test |
|----------|-------------|------|
| A | Empty vault → import v3 → full recovery | `vaultRestorePipeline.test.ts` |
| B | Fresh browser → restore snapshot → equivalent state | `vaultRestorePipeline.test.ts` |
| C | v2 export → upgrade → restore | `vaultRestorePipeline.test.ts` |

Additional coverage: extension apply, cloud restore mock, corruption/fingerprint rejection, protection status.

## Key modules

| Module | Role |
|--------|------|
| `vaultRestorePipeline.ts` | Preview, impact, pipeline orchestration |
| `vaultExtensionApply.ts` | Write portable extensions to localStorage |
| `vaultCloudRestore.ts` | POST cloud block to `/api/restore` |
| `useRecoveryCenter.ts` | Recovery Center state |
| `RecoveryCenterPanel.tsx` | Settings UI |
| `useVaultRestoreFlow.ts` | File/snapshot → preview → pipeline |
| `VaultRestoreModal.tsx` | Impact summary + restore options |

## Reused foundation (K-88A/B)

- `vaultPortableExtensions` — extension shape
- `vaultSnapshotValidate` — snapshot integrity
- `vaultExtensionRestoreSim` — simulation / round-trip tests
