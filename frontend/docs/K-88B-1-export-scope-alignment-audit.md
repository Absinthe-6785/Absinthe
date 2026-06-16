# K-88B-1 — Export Scope Alignment Audit

**Branch:** `k88b-export-scope-alignment`  
**Status:** Audit complete — no export implementation  
**Purpose:** Align portable vault export (`VaultBackupManifest`) with K-88A snapshot scope before K-88B implementation

---

## Executive Summary

| Layer | Format | Schema | Scope today |
|-------|--------|--------|-------------|
| **Manual export** (JSON / ZIP) | `VaultBackupManifest` | **v2** | Active notes + folders only |
| **Auto snapshot** (localStorage) | `VaultSnapshot` wrapper | snapshot v1, vault v2 | Notes + folders + **extensions** |
| **CSV export** (Settings) | Multi-section CSV | ad hoc | Cloud planner + workouts + InBody (date range) |

**Key finding:** Snapshot extensions represent the intended “full local vault” boundary. Export v2 covers ~40% of that boundary (knowledge core only). Extensions, health-local state, and all cloud domains are missing from portable export.

**Snapshots are not exported.** Auto-snapshot payloads (`absinthe:vault-snapshot:*`) are explicitly excluded from snapshot capture and are absent from `buildVaultBackupManifest()`.

---

## 1. Current Export Behavior

### What is exported (v2)

Built by `buildVaultBackupManifest()` in `exportVaultBackup.ts`:

| Field | Source | Notes |
|-------|--------|-------|
| `notes[]` | `notes-v2` (active only) | `deletedAt` notes omitted |
| `notes[].markdown` | Serialized blocks | Wiki links, inline `#tags` in body |
| `notes[].properties` | `properties.tags`, `weakTopic`, custom fields | Classifications are **derived**, not stored |
| `notes[].relations` | Typed relation map | |
| `notes[].starred` | Favorites | |
| `folders[]` | `note-folders-v2` | |

ZIP adds human-readable `notes/*.md` + `README.txt`; same manifest.

### What is not exported (v2)

Everything outside the manifest above, including all K-88A `VaultSnapshotExtensions` and all Supabase data.

### What can be restored today

`importVaultBackup.ts` restores **notes + folders only**. No extension restore path exists.

| Restored on import | Not restored |
|--------------------|--------------|
| Note content, tags, relations, starred | App settings |
| Folder structure | Saved / rule / database views |
| | Knowledge history |
| | Focus presets, workspace preferences |
| | Health local drafts, memos, routine planned sets |
| | Cloud planner, workouts, recipes, InBody |
| | Auto-snapshot history |

---

## 2. Snapshot Extension Gap Analysis

Each K-88A `VaultSnapshotExtensions` field compared to export v2.

### 2.1 Vault core (inside `snapshot.vault`)

| Data category | Storage source | Export v2 | Snapshot | Recovery importance | Schema impact | Classification | Recommended action |
|---------------|----------------|-----------|----------|---------------------|---------------|----------------|-------------------|
| Notes | `notes-v2` | ✅ Included | ✅ | **Critical** | None (already in v2) | **Must Export** | Keep; add `deletedNotes` optional in v3 for trash recovery |
| Blocks | `notes-v2` → `body` / markdown | ✅ In markdown | ✅ | **Critical** | None | **Must Export** | Keep |
| Tags (page) | `notes-v2` → `properties.tags` | ✅ In properties | ✅ | **Critical** | None | **Must Export** | Keep |
| Inline body tags | `notes-v2` → markdown | ✅ In markdown | ✅ | **Important** | None | **Must Export** | Keep |
| Favorites | `notes-v2` → `starred` | ✅ | ✅ | **Important** | None | **Must Export** | Keep |
| Weak topics | `properties.weakTopic` | ✅ In properties | ✅ | **Important** | None | **Must Export** | Keep |
| Classifications (Cosmos tier) | Memory — `evaluateKnowledgeImportance()` | N/A (derived) | Listed in scope doc only | Low | None | **Exclude** | Document as derived; rebuilds from notes |
| Relations | `notes-v2` → `relations` | ✅ | ✅ | **Important** | None | **Must Export** | Keep |
| Wiki links | `notes-v2` → markdown `[[...]]` | ✅ In markdown | ✅ | **Critical** | None | **Must Export** | Keep |
| Folders | `note-folders-v2` | ✅ | ✅ | **Critical** | None | **Must Export** | Keep |
| Active note id | `note-active-v2` | ❌ | ❌ | Low | Optional field | **Exclude** | UX convenience only |
| Knowledge index | Memory | ❌ | ❌ (excluded) | Low | N/A | **Exclude** | Regenerate via `KnowledgeIndexService` |

### 2.2 Snapshot extensions (`snapshot.extensions`)

| Extension field | Storage source | Export v2 | Snapshot | Recovery importance | Schema impact | Classification | Recommended action |
|-----------------|----------------|-----------|----------|---------------------|---------------|----------------|-------------------|
| `appSettings` | `planner-storage` | ❌ | ✅ | **Important** | New `extensions.settings` | **Must Export** | Add to v3; restore on import |
| `savedViews` | `note-saved-views-v1` | ❌ | ✅ | **Important** | New `extensions.knowledge.savedViews` | **Must Export** | Add to v3 |
| `ruleCollections` | `note-rule-collections-v1` | ❌ | ✅ | **Important** | New `extensions.knowledge.ruleCollections` | **Must Export** | Add to v3 |
| `databaseViews` | `note-database-views-v1` | ❌ | ✅ | **Important** | New `extensions.knowledge.databaseViews` | **Must Export** | Add to v3 |
| `focusPresets` | `focus-presets-v1` | ❌ | ✅ | **Should Export** | New `extensions.knowledge.focusPresets` | **Should Export** | Add to v3; user-curated layouts |
| `workspacePreferences` | `workspace-prefs-v1` | ❌ | ✅ | **Should Export** | New `extensions.knowledge.workspacePreferences` | **Should Export** | Add to v3 |
| `knowledgeHistory` | `absinthe:knowledge-history:v1` | ❌ | ✅ | **Should Export** | New `extensions.knowledge.history` | **Should Export** | Add to v3; max 5000 events |
| `healthLocal.splitCount` | `healthSplitCount` | ❌ | ✅ | **Optional** | `extensions.health.splitCount` | **Optional** | Include in v3 health block |
| `healthLocal.routinePlannedSets` | `healthRoutinePlannedSets` | ❌ | ✅ | **Should Export** | `extensions.health.routinePlannedSets` | **Should Export** | Local routine setup not in cloud |
| `healthLocal.recoveryLog` | `absinthe:recovery-log` | ❌ | ✅ | **Optional** | `extensions.health.recoveryLog` | **Optional** | UX log; low disaster value |
| `healthLocal.proteinRecentSources` | `proteinRecentSources` | ❌ | ✅ | **Optional** | `extensions.health.proteinUx` | **Optional** | Convenience prefs |
| `healthLocal.proteinSourceUseCounts` | `proteinSourceUseCounts` | ❌ | ✅ | **Optional** | `extensions.health.proteinUx` | **Optional** | Convenience prefs |
| `healthLocal.drafts` | `healthDraft:{date}` | ❌ | ✅ | **Should Export** | `extensions.health.drafts` | **Should Export** | Unsaved workout JSON — only local copy |
| `healthLocal.memos` | `healthMemo:{date}` | ❌ | ✅ | **Should Export** | `extensions.health.memos` | **Should Export** | Daily health notes — only local |
| `cloudScope` | Documentation only | ❌ | ✅ (metadata) | N/A | `extensions.cloudScope` read-only | **Exclude** | Document gaps in export README |

### 2.3 Local keys in inventory but not in snapshot extensions

| Data category | Storage source | Export v2 | Snapshot | Recovery importance | Classification | Recommended action |
|---------------|----------------|-----------|----------|---------------------|----------------|-------------------|
| Workspace session UI | `note-workspace-session-v1` | ❌ | ❌ | Low | **Exclude** | Tab activation; not portable |
| Search recent | `absinthe.workspaceSearch.recent` | ❌ | ❌ | Low | **Exclude** | Disposable cache |
| Panel width | `absinthe-knowledge-panel-width` | ❌ | ❌ | Low | **Exclude** | UI layout |
| Graph view mode | `absinthe-graph-view-mode` | ❌ | ❌ | Low | **Exclude** | UI preference |
| History bootstrap flags | `absinthe:knowledge-history-bootstrap*` | ❌ | ❌ | Low | **Exclude** | Onboarding dismissed state |
| Cosmos onboarding | `absinthe:cosmos-onboarding:v1` | ❌ | ❌ | Low | **Exclude** | First-run UX |
| Countdown reviewed | `absinthe:countdown-reviewed` | ❌ | ❌ | Low | **Optional** | Could merge into settings |
| D-day migration flag | `absinthe:dday-migration-v1` | ❌ | ❌ | Low | **Exclude** | One-time migration |
| Slash command recent | `absinthe.slashRecent.v1` | ❌ | ❌ | Low | **Exclude** | Command palette cache |
| Vault restore undo | `absinthe-vault-restore-snapshot` | ❌ | ❌ (excluded) | Low | **Exclude** | Import-session only |
| Auto-snapshot payloads | `absinthe:vault-snapshot:*` | ❌ | ❌ (excluded) | Medium | **Exclude** | Export **replaces** snapshots as portable backup |
| Nav stack | `sessionStorage` noteNav keys | ❌ | ❌ | Low | **Exclude** | Tab-scoped |
| Auth session | `sb-*-auth-token` | ❌ | ❌ | N/A | **Exclude** | Security — never export |

### 2.4 Cloud data (not in snapshot payload; documented in `cloudScope`)

| Data category | Storage source | Export v2 | CSV export | Recovery importance | Classification | Recommended action |
|---------------|----------------|-----------|------------|---------------------|----------------|-------------------|
| Calendar / schedules | Supabase `schedules` | ❌ | ✅ Date range | **Critical** | **Must Export** | Add `cloud.planner` to v3; fetch at export time |
| Todos | Supabase `todos` | ❌ | ✅ | **Important** | **Must Export** | Same |
| Planner routines | Supabase `routines` | ❌ | ✅ | **Important** | **Must Export** | Same |
| Weekly timetable | Supabase `weekly_schedules` | ❌ | ❌ | **Important** | **Must Export** | Add API fetch; not in CSV today |
| Recipes | Supabase `recipes` | ❌ | ❌ | **Should Export** | **Should Export** | Add to v3 cloud block |
| Workout history | Supabase `workout_logs` + blocks | ❌ | ✅ | **Critical** | **Must Export** | Add `cloud.health.workouts` |
| Exercise blocks / routine templates | Supabase `exercise_blocks`, `health_routines` | ❌ | Partial via workouts | **Important** | **Must Export** | Include templates in cloud block |
| InBody logs | Supabase `inbody` | ❌ | ✅ | **Should Export** | **Should Export** | Add `cloud.health.inbody` |
| Protein intake | Supabase `protein_intake` | ❌ | ❌ | **Should Export** | **Should Export** | Add API fetch |
| Archive domain marks | `/api/heatmap` (derived) | ❌ | ❌ | **Optional** | **Optional** | Regenerable from cloud activity |
| Archive projections | Derived from notes + heatmap | ❌ | N/A | Low | **Exclude** | Recomputed at runtime |

**Archive note:** “Archive” in Absinthe is a **read model** over notes vault + cloud heatmap — not a separate datastore. Recovering notes + cloud heatmap restores archive usefulness.

---

## 3. Gap Summary

```text
EXPORT v2 COVERAGE
├── Knowledge core          ████████████ 100%  (notes, folders, embedded metadata)
├── Knowledge extensions    ░░░░░░░░░░░░   0%  (views, history, prefs)
├── Health local            ░░░░░░░░░░░░   0%  (drafts, memos, routine sets)
├── App settings            ░░░░░░░░░░░░   0%
├── Cloud planner           ░░░░░░░░░░░░   0%  (CSV partial, not in vault)
├── Cloud health            ░░░░░░░░░░░░   0%  (CSV partial, not in vault)
└── Auto-snapshots          ░░░░░░░░░░░░   0%  (by design — separate layer)

SNAPSHOT EXTENSION COVERAGE (local only)
├── Knowledge extensions    ████████████ 100%
├── Health local            ████████████ 100%
├── App settings            ████████████ 100%
└── Cloud domains           ░░░░░░░░░░░░   0%  (documented only)
```

**Alignment target for v3:** Export scope ≥ snapshot local scope + authenticated cloud fetch.

---

## 4. Proposed VaultBackupManifest v3 Schema

### Design principles

```text
Versioned        — schemaVersion: 3
Portable         — single JSON (+ optional ZIP); no localStorage keys required
Human-inspectable — scope manifest + README; markdown sidecar in ZIP
Forward-compatible — unknown extension keys preserved; strict validation on required core
Restoreable      — core + extensions + cloud blocks with independent validators
```

### Top-level shape

```typescript
interface VaultBackupManifestV3 {
  schemaVersion: 3;
  kind: 'absinthe-vault-export';
  exportedAt: string;           // ISO-8601
  app: 'absinthe';
  appVersion: string;

  // ── Counts (denormalized for UI / validation) ──
  noteCount: number;
  folderCount: number;
  relationCount: number;

  // ── Core vault (required) — same as v2 ──
  folders: NoteFolder[];
  notes: VaultBackupNoteEntry[];

  // ── Local extensions (required object, fields optional) ──
  extensions: {
    schemaVersion: 1;
    settings: AppSettingsSnapshot | null;
    knowledge: {
      savedViews: SavedView[];
      ruleCollections: RuleCollection[];
      databaseViews: DatabaseView[];
      focusPresets: FocusPreset[];
      workspacePreferences: WorkspacePreferences;
      history: KnowledgeHistoryPayload | null;
    };
    health: {
      splitCount: number | null;
      routinePlannedSets: Record<string, unknown> | null;
      recoveryLog: Record<string, unknown> | null;
      proteinUx: {
        recentSources: string[] | null;
        sourceUseCounts: Record<string, number> | null;
      };
      drafts: Record<string, string>;   // date key → JSON string
      memos: Record<string, string>;    // date key → text
    };
  };

  // ── Cloud snapshot (optional — present when authenticated + fetch succeeds) ──
  cloud?: {
    schemaVersion: 1;
    fetchedAt: string;
    authRequired: true;
    completeness: 'full' | 'partial' | 'skipped';
    planner: {
      schedules: Schedule[];
      todos: Todo[];
      routines: Routine[];
      weeklySchedules: WeeklySchedule[];
      recipes: Recipe[];
    };
    health: {
      workouts: Workout[];
      exerciseBlocks: ExerciseBlock[];
      healthRoutines: HealthRoutine[];
      inbody: InbodyEntry[];
      proteinIntake: ProteinIntakeEntry[];
    };
  };

  // ── Scope documentation (human-inspectable) ──
  scope: {
    included: string[];
    excluded: string[];
    cloudGaps: string[];      // e.g. "skipped: not authenticated"
    manifestDoc: string;
  };

  // ── Integrity ──
  contentFingerprint?: string;  // hash of core + extensions (+ cloud if present)
}
```

### ZIP layout (v3)

```text
absinthe-vault-{date}.zip
├── manifest.json          # full v3 manifest
├── README.txt             # scope, recovery instructions, cloud completeness
├── notes/*.md             # unchanged from v2
└── cloud/                 # optional human-readable sidecars
    ├── schedules.csv
    ├── workouts.csv
    └── ...
```

### Validation rules (pre-export)

| Check | Failure mode |
|-------|--------------|
| `schemaVersion === 3` on write | Block export |
| `app === 'absinthe'` | Block export |
| Every note has `id`, `title`, parseable markdown | Fail with `corruptedNoteIds` |
| Folder ids referenced by notes exist or are null | Warn only (orphans allowed, as v2) |
| Extension JSON parseable | Fail safe — omit corrupt extension, record in `scope.cloudGaps` |
| Cloud fetch partial failure | Export with `cloud.completeness: 'partial'` + documented gaps |
| Unknown top-level keys on import | Preserve in `extensions.unknown` bag (forward compat) |

---

## 5. Migration Strategy

### Version ladder

```text
v1 (legacy)  →  normalizeVaultBackupManifest()  →  v2 shape
v2 (current) →  upgradeToV3()                    →  v3 (+ empty extensions)
v3 (target)  →  validateVaultBackupManifestV3()
```

### Import behavior by version

| Import version | Core restore | Extensions restore | Cloud restore |
|----------------|--------------|-------------------|---------------|
| v1 / v2 | ✅ Existing `applyVaultRestore` | ❌ Ignored (not present) | ❌ |
| v3 | ✅ Same path | 🔄 New `applyVaultExtensionsRestore` (K-88B-2) | 🔄 New `applyCloudRestore` (K-88B-2, auth required) |

### Implementation phases (recommended)

| Phase | Work |
|-------|------|
| **K-88B-1** (this audit) | Gap report + v3 schema spec |
| **K-88B-2** | Implement v3 build, validate, export; v2→v3 upgrade on import |
| **K-88B-3** | Extension + cloud restore paths (still no Recovery Center UI) |
| **K-88C** | Recovery Center — browse exports/snapshots |
| **K-88D** | Snapshot import UI |
| **K-88E** | Recovery validation wizard |

### Backward compatibility guarantees

- v2 exports remain importable indefinitely via `normalizeVaultBackupManifest`
- v3 exporters must accept v2 imports without migration file
- Snapshot system continues wrapping v2 vault until export builder unified on shared `collectVaultScope()`

### Shared collector (implementation note)

K-88B-2 should extract `collectVaultSnapshotExtensions()` into a shared `collectPortableVaultExtensions()` used by both snapshot and export to prevent future drift.

---

## 6. Recovery Guarantees Matrix

Scenario: **complete browser storage loss** (site data cleared, fresh profile).

| Data category | v2 export only | v3 export (local extensions) | v3 export + cloud block | Cloud sync only | Auto-snapshot only |
|---------------|----------------|------------------------------|-------------------------|-----------------|-------------------|
| Notes & blocks | ✅ Full | ✅ Full | ✅ Full | ✅ If synced | ✅ If not cleared |
| Tags, relations, favorites | ✅ Full | ✅ Full | ✅ Full | ✅ If synced | ✅ |
| Saved / DB views | ❌ Lost | ✅ Full | ✅ Full | ❌ | ✅ |
| App settings | ❌ Lost | ✅ Full | ✅ Full | ❌ | ✅ |
| Knowledge history | ❌ Lost | ✅ Full | ✅ Full | ❌ | ✅ |
| Health drafts/memos | ❌ Lost | ✅ Full | ✅ Full | ❌ | ✅ |
| Routine planned sets (local) | ❌ Lost | ✅ Full | ✅ Full | ❌ | ✅ |
| Workout history | ❌ Lost | ❌ Lost | ✅ If fetched | ✅ If synced | ❌ |
| Planner / timetable | ❌ Lost | ❌ Lost | ✅ If fetched | ✅ If synced | ❌ |
| Recipes | ❌ Lost | ❌ Lost | ✅ If fetched | ✅ If synced | ❌ |
| Protein / InBody | ❌ Lost | ❌ Lost | ✅ If fetched | ✅ If synced | ❌ |
| Classifications (Cosmos) | 🔄 Rebuild | 🔄 Rebuild | 🔄 Rebuild | 🔄 Rebuild | 🔄 Rebuild |
| Knowledge index | 🔄 Rebuild | 🔄 Rebuild | 🔄 Rebuild | 🔄 Rebuild | 🔄 Rebuild |

### Protection status (for future UI — K-88B-2)

| Status | Condition |
|--------|-----------|
| **Protected** | v3 export < 7 days old AND includes cloud block with `completeness: 'full'` |
| **Partially Protected** | v3 export exists but cloud block missing/partial; OR v2 export only; OR snapshot exists but no file export |
| **No External Backup** | No export file; relies on localStorage / snapshots only |

### Residual risks after v3

| Risk | Mitigation |
|------|------------|
| User never exports; clears site data | K-88A snapshots help only on same browser |
| Export without signing in | Local knowledge + health drafts recovered; cloud domains lost |
| Cloud fetch fails mid-export | Partial export with documented gaps |
| Large vault + cloud → big JSON | ZIP compression; optional cloud sidecar CSVs |
| v3 not yet implemented | **Current state** — knowledge core only in export |

---

## 7. Follow-Up Recommendations

| Branch | Scope |
|--------|-------|
| **K-88B-2** | Implement v3 export build, pre-export validation, shared scope collector |
| **K-88B-3** | Extension + cloud restore apply paths; disaster recovery tests |
| **K-88C** | Recovery Center UI |
| **K-88D** | Snapshot import / restore UI |
| **K-88E** | Recovery validation wizard |

---

## 8. Source References

| Artifact | Path |
|----------|------|
| Export v2 builder | `frontend/src/lib/exportVaultBackup.ts` |
| Import / restore | `frontend/src/lib/importVaultBackup.ts` |
| ZIP export | `frontend/src/lib/vaultBackupZip.ts` |
| Snapshot scope | `frontend/src/lib/vaultSnapshotScope.ts` |
| Snapshot build | `frontend/src/lib/vaultSnapshotBuild.ts` |
| Storage inventory | `frontend/src/lib/storageInventory.ts` |
| CSV cloud export | `frontend/src/lib/csvExport.ts` |
| K-88 audit | `frontend/docs/K-88-storage-integrity-audit.md` |
| K-88A design | `frontend/docs/K-88A-vault-snapshot-design.md` |

---

*Audit complete. No export code changes in K-88B-1.*
