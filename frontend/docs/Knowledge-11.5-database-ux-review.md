# Knowledge-11.5 — Database UX Review

## Scope

Usability and architecture cleanup for the Database Layer after K-10 (Board) and K-11 (Calendar). No new features — consolidate duplicated patterns before Relations/Rollups.

---

## 1. Architecture Report

### Current layering (validated)

```
DatabaseView { query, presentation, presentationConfig }
        ↓
filterByDatabaseView → filterNotes (unchanged)
        ↓
table  → prepareDatabaseViewRows      → DatabaseTableView
board  → prepareDatabaseBoardLanes     → DatabaseBoardView
calendar → prepareDatabaseCalendarBuckets → DatabaseCalendarView
        ↓
WorkspaceActivation { kind: 'database-view', id }
```

Architecture remains sound. K-11.5 addresses **incremental UX drift**, not model redesign.

---

## 2. UX Audit

| Area | Finding | Severity |
| ---- | ------- | -------- |
| Presentation switcher | Duplicated in `DatabaseViewControls` and `DatabaseViewsSection` create form | Medium |
| Property key inputs | Board `groupBy`, Calendar `dateProperty`, Table add-column use similar free-text inputs with different labels | Medium |
| Note cards | `BoardCard` and `CalendarCard` duplicate title/tags/active styling | Low |
| NoteView wiring | 7 handlers + 5 memos for database presentation dispatch | Medium |
| Empty states | "No matching notes" repeated across three views | Low |
| Create vs edit UX | Create form uses same presentation options but separate component tree | Medium |

**No blocking UX issues.** Consolidation reduces drift risk.

---

## 3. Shared Component Audit

| Component | Role today | Consolidation |
| --------- | ---------- | ------------- |
| `DatabaseViewControls` | Single config surface for active view | ✅ Keep — canonical edit surface |
| `DatabaseViewsSection` | Sidebar CRUD + create form | Share presentation/property primitives |
| `DatabaseTableView` | Table rendering | Keep — unique layout |
| `DatabaseBoardView` | Kanban lanes | Use shared `DatabaseNoteCard` |
| `DatabaseCalendarView` | Month grid | Use shared `DatabaseNoteCard` |
| `databaseFieldValues` | Property resolution | ✅ Already shared |
| `databasePresentationConfig` | Config normalize/switch | ✅ Already shared |

---

## 4. Shared Configuration Audit

| Presentation | Config key | Property UX pattern |
| ------------ | ---------- | ------------------- |
| Table | `columns`, `sort` | Multi-column list + sort pickers |
| Board | `groupBy` | Single property key |
| Calendar | `dateProperty` | Single property key |

**Pattern:** Board and Calendar share a **single property key selector** (`DatabasePropertyKeyField`). Table uses extended column management.

Presentation switching preserves cached table config via `presentationConfig` + legacy `columns`/`sort` sync (K-10 behavior unchanged).

---

## 5. Technical Debt Assessment

| Item | Status after K-11.5 |
| ---- | ------------------- |
| Duplicated presentation `<select>` | ✅ Extracted to `DatabasePresentationSwitcher` |
| Duplicated property inputs | ✅ Extracted to `DatabasePropertyKeyField` |
| Duplicated note cards | ✅ Extracted to `DatabaseNoteCard` |
| NoteView presentation dispatch | ✅ Consolidated in `DatabaseViewPanel` |
| Three prepare pipelines | ✅ Unified entry via `prepareDatabaseViewPresentation` |
| Future Timeline/Gallery | ✅ `DatabaseViewPresentation` + discriminated union ready |

**No persistence changes.** Backward compatibility preserved.

---

## 6. Consolidation Plan (implemented)

### Phase 1 — Shared primitives
- `databasePresentationMeta.ts` — labels, options, property field presets
- `DatabasePresentationSwitcher` — single control pattern Table ↔ Board ↔ Calendar
- `DatabasePropertyKeyField` — unified property key input
- `DatabaseNoteCard` — shared card for board/calendar

### Phase 2 — Pipeline unification
- `prepareDatabaseViewPresentation()` — single dispatch over three prepare functions

### Phase 3 — Panel consolidation
- `DatabaseViewPanel` — controls + renderer; simplifies `NoteView` wiring

### Out of scope (future milestones)
Relations, Rollups, Formulas, Timeline, Gallery, automations.

---

## Review Question Answers

1. **Can DatabaseViewControls be the single configuration surface?** Yes — already is for active views; create form shares primitives via `DatabasePresentationSwitcher` + `DatabasePropertyKeyField`.

2. **Can presentation switching be standardized?** Yes — one switcher component used in controls and create form.

3. **Can property selection UX be unified?** Partially — board/calendar share `DatabasePropertyKeyField`; table retains column-specific UI (by design).

4. **Can shared helpers be extracted?** Yes — `databaseFieldValues`, `databasePresentationConfig`, and new meta/prepare/panel modules.

5. **Can future presentations fit?** Yes — add to `DatabaseViewPresentation`, extend `DatabasePresentationConfig` union, add prepare branch + view component.

---

## Validation

Expected: `npm run typecheck` PASS · `npm test` PASS · `npm run build` PASS · no behavior regressions.
