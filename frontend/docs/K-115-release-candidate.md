# K-115 — Release Candidate & Product Hardening

Validation, polish, and release readiness pass after K107–K114. No schema, storage, IndexedDB, knowledge-engine, or Cosmos changes.

**Branch:** `k115-release-candidate`

---

## Architecture overview

Absinthe is a multi-domain personal workspace:

```text
┌─────────────────────────────────────────────────────────┐
│ AppContent (bootstrap once, tab shell, global shortcuts)│
├──────────┬──────────┬──────────┬──────────┬─────────────┤
│ Notes    │ Health   │ Planner  │ Archive  │ Recipe      │
│ NoteView │ HealthView│ PlannerView│ AnalyticsView│ RecipeView│
├──────────┴──────────┴──────────┴──────────┴─────────────┤
│ GlobalSearchHost (Search workspace — Ctrl+Shift+F)      │
├─────────────────────────────────────────────────────────┤
│ useNotesStore + notesSyncClient (bootstrap / delta)     │
│ IndexedDB / localStorage persistence                    │
└─────────────────────────────────────────────────────────┘
```

Startup path (K-114 guarded):

1. `initNotesStorage` — local hydrate
2. `hydrateFromDB` — coalesced cloud sync (full once, then `updated_after`)
3. `knowledgeIndexService.buildFromNotes`
4. `runPeriodicSnapshotSlots`

---

## Domain map

| Tab | Alt | View | Primary projection |
|-----|-----|------|-------------------|
| Notes | Alt+1 | `NoteView` | — (store + index) |
| Health | Alt+2 | `HealthView` | `HealthProjection` |
| Planner | Alt+3 | `PlannerView` | `PlannerProjection` |
| Archive | Alt+4 | `AnalyticsView` | `ArchiveProjection` |
| Recipe | Alt+5 | `RecipeView` | `RecipeProjection` |
| Search | Ctrl+Shift+F | `GlobalSearchHost` | `SearchProjection` |

Cross-domain cohesion (K-113): shared recent activity, relative dates, deep links between domains.

---

## Projection map

| Projection | Builder | Consumer |
|------------|---------|----------|
| HealthProjection | `buildHealthProjection.ts` | `HealthView` |
| PlannerProjection | `buildPlannerProjection.ts` | `CalendarShell` |
| ArchiveProjection | `buildArchiveProjection.ts` | `useArchiveProjection` |
| RecipeProjection | `buildRecipeProjection.ts` | `useRecipeProjection` |
| SearchProjection | `buildSearchProjection.ts` | `GlobalSearchHost` |
| RecentActivityProjection | `buildRecentActivityProjection.ts` | Dashboard / sidebar |

All six are **single-pass, view-local** — no global projection store, no circular builder imports.

Audits: `k115ProjectionAudit.ts`

---

## Keyboard matrix

| Shortcut | Action | Scope |
|----------|--------|-------|
| Ctrl+F | Document search in note | Notes |
| Ctrl+Shift+F | Workspace search palette | Global |
| Ctrl+Alt+T | Open/create daily note | Notes |
| Ctrl+Z | Undo | Editor |
| Ctrl+Y / Ctrl+Shift+Z | Redo | Editor |
| Alt+1–5 | Switch tabs (Notes → Recipe) | Global |
| Escape | Close sort menu / search modal | Contextual |

Audits: `k115KeyboardAudit.ts`

---

## Performance matrix

Large vault note counts: **1000, 3000, 5000, 10000**

| Domain | Measurement |
|--------|-------------|
| Search | Title filter over vault |
| Note open | Lookup by id |
| Planner | Schedule note scan |
| Recipe | Body filter |
| Archive | Active note filter |

Synthetic benchmarks in `k115PerformanceAudit.ts`; server payload sizing from `k114LargeVaultAudit.ts`.

---

## Recovery flows

| Scenario | Path |
|----------|------|
| Sync failure | `syncError` banner → `retrySync()` |
| Offline | `initNotesStorage` local-first |
| Empty vault | Bootstrap full sync |
| Snapshot restore | `vaultSnapshotStore` + `useVaultRestoreFlow` |
| Recovery Center | Settings → `RecoveryCenterPanel` |
| Force full re-sync | `hydrateFromDBFull()` (recovery mode) |

Audits: `k115RecoveryAudit.ts`

---

## Render production validation

**Expected sequence:**

```text
GET /api/notes          (bootstrap — once)
GET /api/note_folders   (bootstrap — once)
GET /api/notes?updated_after=...  (steady state)
```

**Forbidden:** repeated unconditional `GET /api/notes` loops.

Guards: `notesBootstrapStarted`, `runCoalescedHydrate`, `RequestMemoryWatchdog` (RSS before/after/delta, request id, duration).

Audits: `k115RenderAudit.ts`, `k114SyncPathAudit.ts`

---

## QA checklist

### A — Startup (`k115StartupAudit.ts`)

- [ ] Cold start < acceptable TTI for 1000 notes
- [ ] Warm start skips full re-fetch
- [ ] Bootstrap runs once per session
- [ ] No duplicate hydration

### B — Long session (`k115SessionAudit.ts`)

- [ ] 1h / 2h tab switching
- [ ] Repeated edits (600 ms debounce)
- [ ] Search / planner usage without memory growth
- [ ] Request budget bounded with delta sync

### C — Mobile 320 / 375 / 768 (`k115MobileAudit.ts`)

- [ ] Headers, toolbars, More menus
- [ ] 44 px touch targets
- [ ] Empty states per domain
- [ ] Recipe Studio, Planner, Search, Archive, Health

### D — Desktop (`k115DesktopAudit.ts`)

- [ ] Panel widths bounded
- [ ] Overflow scroll
- [ ] Sticky sections
- [ ] No dead empty space

### E — Keyboard (`k115KeyboardAudit.ts`)

- [ ] Full RC matrix wired

### F — Projections (`k115ProjectionAudit.ts`)

- [ ] Six projections independent

### G — Recovery (`k115RecoveryAudit.ts`)

- [ ] All flows reachable from Settings

### H — Performance (`k115PerformanceAudit.ts`)

- [ ] 10k vault synthetic pass

### I — Render (`k115RenderAudit.ts`)

- [ ] Delta sync adopted, no GET loops

---

## Audit modules

| Module | Focus |
|--------|-------|
| `k115StartupAudit.ts` | Cold/warm/TTI, bootstrap guards |
| `k115SessionAudit.ts` | Long-session policy |
| `k115MobileAudit.ts` | Width matrix + touch |
| `k115DesktopAudit.ts` | Layout panels |
| `k115KeyboardAudit.ts` | Shortcut wiring |
| `k115ProjectionAudit.ts` | Six projections, no cycles |
| `k115RecoveryAudit.ts` | Error recovery paths |
| `k115PerformanceAudit.ts` | Large vault matrix |
| `k115RenderAudit.ts` | Production sync validation |

Tests: `k115StartupAudit.test.ts`, `k115Audits.test.ts`

```powershell
npm test -- k115
```

---

## Known limitations

1. **Bootstrap effect deps** — `AppContent` still lists `t` in `useEffect` deps; guarded by `notesBootstrapStarted` ref so hydration runs once, but migrate toast may not re-fire on locale change mid-session.
2. **Synthetic performance** — `k115PerformanceAudit` uses in-memory benchmarks, not Playwright; real-device mobile QA is manual.
3. **Large vault** — 10k notes increases initial bootstrap payload; delta sync mitigates steady-state cost.
4. **No schema changes in K-115** — recovery and sync behavior inherit K-114; no new migration paths.
5. **Search Ctrl+Shift+F vs Notes Ctrl+F** — document search (Ctrl+F) and workspace search (Ctrl+Shift+F) are intentionally separate surfaces.

---

## Verification

```powershell
npm run typecheck
npm test
npm run build
npm test -- k115
```

Expected: Release Candidate quality — confidence and stability, not new functionality.
