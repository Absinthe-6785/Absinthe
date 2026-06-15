# K-61 — Performance, Mobile UX & Backup Foundation

Branch: `k61-performance-mobile-backup`

## Architecture Summary

K-61 builds on K-59/K-60 stabilized architecture without refactors to NoteView decomposition or the graph engine.

| Layer | Role in K-61 |
|-------|----------------|
| `noteSearch.ts` | Central `noteSearchScore()` for sidebar + workspace ranking |
| `buildWorkspaceSearch.ts` | Command palette uses shared note scoring |
| `NoteView.tsx` | Plain-text search sorts by match quality before user sort |
| `NoteGraphView.tsx` | Sim tick throttle, memoized galaxy map, compact chrome, keyboard nav |
| `CosmosGraphPreviewPanel.tsx` | Desktop rail + mobile bottom sheet with close affordance |
| `exportVaultBackup.ts` | JSON vault manifest (folders + serialized notes) |
| `SettingsView` / `NoteViewSidebar` | Backup entry points |

No data-model changes. No library replacements.

---

## P1 — Performance Audit Findings

### Measured hotspots (code review + structural analysis)

| Surface | Bottleneck | Risk at scale |
|---------|------------|---------------|
| Graph open | Force sim O(n²) repulsion, RAF `setTick` every frame | 1000+ nodes: sustained React re-renders |
| Graph HUD | `buildCosmosVaultAnalysis`, `buildDiscoveryFeed` on every mount | Recomputed per notes array change |
| Sidebar filter | `visibleNotes` full recompute + map render | Linear scan per keystroke |
| Workspace search | Full vault scan per query | Acceptable for <5k notes; no index |
| Note switch | BlockEditor mount + body parse | Dominated by editor, not K-61 scope |

### Improvements applied (low-risk)

1. **Sim tick throttle** — `setTick` every 3 frames while simulation active (`NoteGraphView.tsx`)
2. **Galaxy map memoization** — `buildNoteGalaxyMap` cached per `notes` reference
3. **Search ranking sort** — sidebar returns early with relevance sort, avoiding redundant user sort pass

### Not changed (per spec)

- Force-directed engine algorithm
- Graph library / data model
- NoteView decomposition

### Recommended follow-up (K-62)

- Web Worker for force simulation ticks
- Sidebar list virtualization when `visibleNotes.length > 200`
- Workspace search inverted index for 10k+ vaults

---

## P2 — Mobile UX Findings

### Audit

| View | Gap | Fix |
|------|-----|-----|
| Cosmos | Fixed 280px right rail on phone | Bottom sheet (`layout: sheet`) + backdrop dismiss |
| Cosmos | No close button | X button + Escape key |
| Cosmos | 28px toolbar controls | `TOUCH_TARGET_MIN_PX` (44) when `compactChrome` |
| Schedule day | `py-1` event rows | `min-h-[44px]` timed events, `min-h-[44px]` all-day |
| Schedule week | Small week rows | `min-h-[40px]` event rows |
| Health | Mobile tab buttons | `min-h-[44px]` tab targets |
| Notes sidebar | Hardcoded English export tooltip | i18n `nvExportAllNotes` |

### Preserved (K-60)

- Single-click / tap → preview
- Double-click / double-tap → open note
- No Cosmos redesign

---

## P3 — Export & Backup

### Existing export (audited)

| Format | Entry | Notes |
|--------|-------|-------|
| Single `.md` | Note actions | `serializeNoteMarkdown` |
| Bulk `.md` | Sidebar Save icon | Sequential downloads, deduped filenames |
| Health CSV | Settings date range | `exportAllToCsv` |

### Added

| Format | Entry | Contents |
|--------|-------|----------|
| Vault JSON | Settings → Data Management | `schemaVersion`, `folders`, notes with markdown + properties + relations |
| Vault JSON | Notes sidebar Archive icon | Same manifest |

See `VAULT_BACKUP_FORMATS_DOC` in `exportVaultBackup.ts`.

Non-goals respected: no cloud sync, backend migration, or account work.

---

## P4 — Search Ranking

### Scoring (`noteSearchScore`)

Lower score = higher rank:

| Tier | Score | Example query `Fourier` |
|------|-------|---------------------------|
| Exact title | 0 | Title = "Fourier" |
| Title prefix | 1 | "Fourier Transform" |
| Title contains | 2 | "Intro to Fourier series" |
| Body word start | 3 | Body starts segment with Fourier |
| Body contains | 4 | Mention once in body |
| Tag exact | 5 | `#fourier` |
| Tag partial | 6 | `#fourier-analysis` |

**Fourier Transform** (title) now ranks above a note mentioning Fourier once in the body.

Applied in: sidebar `visibleNotes`, `buildWorkspaceSearch` note rows.

---

## P5 — Cosmos Polish

- Close button on preview panel (desktop + mobile)
- Escape dismisses preview
- Arrow keys cycle previewed nodes when preview open
- Enter/Space on focused node opens preview (consistent with click)
- Double-click still opens note
- Mobile bottom sheet with safe-area padding

---

## P6 — Product Readiness Audit

### First-use / discoverability

| Area | Finding | Severity |
|------|---------|----------|
| Cosmos preview | No visible hint until node clicked | Low — HUD shows select hint |
| Vault backup | Was hidden; now in Settings + sidebar | Fixed |
| Export formats | Undocumented; now in backup module doc | Fixed |
| Graph mode toggle | Small on mobile | Improved via touch targets |
| Empty trash | Clear affordance exists | OK |
| Workspace search | Strong; ranking now title-first | Improved |

### Terminology

- "Cosmos" / "Graph" used interchangeably in UI — consistent enough for K-61
- "Vault backup" vs "Export all .md" — distinct entry points with distinct tooltips

### Dead-end workflows

- Mobile graph preview without close was a dead-end — fixed with sheet dismiss
- No notes → backup shows empty toast — handled

---

## Files Created

- `frontend/src/lib/exportVaultBackup.ts`
- `frontend/src/lib/exportVaultBackup.test.ts`
- `frontend/docs/K-61-performance-mobile-backup.md`

## Files Modified

- `frontend/src/lib/math/noteSearch.ts`
- `frontend/src/lib/math/noteSearch.test.ts`
- `frontend/src/components/views/NoteView.tsx`
- `frontend/src/components/views/NoteGraphView.tsx`
- `frontend/src/components/views/noteview/NoteViewEditorArea.tsx`
- `frontend/src/components/views/noteview/NoteViewSidebar.tsx`
- `frontend/src/components/views/noteview/actions/useNoteImportExportActions.ts`
- `frontend/src/components/views/noteview/useNoteViewActions.ts`
- `frontend/src/components/views/features/knowledge/cosmos/CosmosGraphPreviewPanel.tsx`
- `frontend/src/components/views/features/knowledge/workspace/buildWorkspaceSearch.ts`
- `frontend/src/components/views/features/knowledge/workspace/buildWorkspaceSearch.test.ts`
- `frontend/src/components/views/features/planner/calendar-ui/day/DayEventsSection.tsx`
- `frontend/src/components/views/features/planner/calendar-ui/week/WeekEventRows.tsx`
- `frontend/src/components/views/HealthView.tsx`
- `frontend/src/components/views/SettingsView.tsx`
- `frontend/src/lib/i18n.ts`

---

## Recommended K-62 Roadmap

1. **Graph performance** — Web Worker simulation; pause sim when tab hidden
2. **Sidebar virtualization** — react-window for 500+ visible notes
3. **Backup restore** — import JSON manifest with conflict resolution
4. **ZIP export** — optional JSZip bundle for bulk `.md` + manifest
5. **Mobile Schedule** — swipe day navigation; larger routine toggle controls
6. **Search index** — persistent trigram index for workspace palette at 10k+ scale
7. **Cosmos indicators** — lightweight cluster note-count badges (evaluate in user testing)
