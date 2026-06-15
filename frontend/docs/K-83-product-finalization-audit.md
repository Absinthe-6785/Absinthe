# K-83 — Product Finalization Audit & Real Usage Validation

K-83 is a refinement and validation release — not a feature release. It audits real-world friction, completes cross-toggle operation gaps from K-82, tightens knowledge navigation defaults, and documents remaining UX debt before long-term maintenance.

---

## Part 1 — Cross-Toggle Drag Completion (P0)

### Audit matrix

| Scenario | Size | Drag | Duplicate | Delete | Indent/Outdent | Move between toggles |
|----------|------|------|-----------|--------|----------------|----------------------|
| Single toggle (open) | 10–100 | **Working** | **Working** (K-83 fix) | **Working** | Single-block only | **Working** |
| Nested toggles | 10–100 | **Working** | **Working** | **Working** | Single-block only | **Working** |
| Multi-toggle tree | 50–100 | **Working** | **Working** | **Working** | Single-block only | **Working** |
| Collapsed toggle tree | any | **Partial** | **Partial** | **Partial** | N/A (children hidden) | **Partial** |
| Toggle header + all children selected | any | **Working** (`minimalDragIds`) | **Working** | **Working** | N/A | **Working** |
| Partial range incl. toggle header | any | **Working** (K-83 expand) | **Working** (K-83 fix) | **Working** (K-83 expand) | N/A | **Working** |
| Toggle header left-zone gutter | any | **Working** (K-83) | — | — | — | — |
| Gutter select collapsed children | any | **Broken** (by design — not in DOM) | — | — | — | — |

### Root causes fixed in K-83

1. **Duplicate double-clone** — `multiBlockOps` and `collectBlocksForCopy` did not dedupe ancestor+descendant ids. Selecting toggle header + child duplicated the subtree twice.
2. **Partial toggle ranges** — Shift+click across toggle boundaries could include header + subset of children; unselected siblings were silently deleted or moved. `expandToggleHeadersInSelection` now treats any selected toggle header as the full subtree for ops.
3. **Toggle header gutter zone** — Normal blocks had a 56px left shell zone for gutter drag; toggle headers did not. Wired in `ToggleBlock.tsx`.
4. **Shift+Arrow endpoints** — Used `Set` iteration order instead of document-order min/max after Ctrl+click additive selection.

### Deferred (documented, not rewritten)

- Collapsed-toggle children cannot be selected until expanded (DOM + virtualization constraint)
- Multi-block indent/outdent not implemented (single active block only)
- Drag grip on unselected block drags only that block even when others are selected

### Files changed

- `dragSelection.ts` — `expandToggleHeadersInSelection`, `normalizedOpIds`
- `multiBlockOps.ts` — uses `normalizedOpIds`
- `blockCopy.ts` — `collectBlocksForCopy` uses `normalizedOpIds`
- `ToggleBlock.tsx`, `SingleBlock.tsx` — header shell gutter zone
- `useEditorKeyboard.ts` — document-order shift+arrow endpoints
- Tests: `dragSelection.test.ts`, `multiBlockOps.test.ts`, `blockCopy.test.ts`

---

## Part 2 — Real Study Workflow Audit

### Simulated workflow

```
Create note → Write → Wiki link → Open linked note → Back → Search → Move blocks
→ Related note → Cosmos → Return → Continue writing
```

### Friction findings

| Friction | Frequency | Severity | K-83 action |
|----------|-----------|----------|-------------|
| Context panel opens on Outline (often empty) | Every session | Medium | **Fixed** — opening panel with connections → Links tab |
| Panel starts closed; user must discover AlignLeft | Every session | Medium | Documented; no change (intentional focus mode) |
| Structure/Sources scroll before Connections on linked notes | Daily | Low | Already fixed K-82 (collapsed defaults) |
| Wiki link creation requires panel or `[[` knowledge | Daily | Low | Kept — `handleStartWikiLink` opens Links |
| Workspace search (Ctrl+F) separate from in-doc find | Hourly | Low | K-81 intentional split |
| Return from Cosmos/linked note requires breadcrumb or back stack | Daily | Low | Working; breadcrumb + nav stack present |
| Classification hidden on compact/mobile chrome | Daily | Medium | **Deferred** — read-only kind chip recommended |
| Weak topic toggle only in overflow on mobile | Hourly | Low | K-82 status chip in context strip |

### Prioritized friction (post-K-83)

**Every session:** Panel closed by default (acceptable for writing-first UX).

**Daily:** Mobile classification discoverability; Relations tab overlaps Links Structure.

**Hourly:** Rule/database “save current query” still decoupled from sidebar (K-81 debt).

---

## Part 3 — Knowledge Context Simplification

### Usage model (realistic vault)

Users spend most time in:

1. **Related Notes / Backlinks / Referenced** (Connections group)
2. **Outline** (long structured notes)
3. **Graph** (exploratory jumps)

Less frequent: Insights, Properties, Stats tag cloud, Relations tab (duplicates Structure).

### K-83 improvements

| Change | Rationale |
|--------|-----------|
| Open panel → **Links** when `noteConnectionCount > 0` | Connections visible immediately |
| **Worth Revisiting** collapsed when **Most Related** has items | Reduces scroll in Discover/Graph related sections |
| Structure/Sources collapsed when connections exist | K-82 — retained |

### Not changed (by design)

- Primary tab bar still shows Graph, Insights, Properties (discoverability for new users)
- No graph engine or index rewrites
- Relations tab kept (deferred demotion — needs usage telemetry)

---

## Part 4 — Metadata Hierarchy Audit

### Final model

| Field | Type | Meaning | Where shown |
|-------|------|---------|-------------|
| **Note kind** | Classification | source / literature / permanent / concept — *what the note is* | Header selector (wide); workflow indicator |
| **Weak topic** | **Status** | Per-note study flag (`weakTopic: yes`) | Header group (wide); context strip chip; overflow (compact) |
| **Favorite (star)** | **Metadata** | User-curated quick access | Header star; sidebar Starred folder; graph pin tier |
| **Tags** | **Metadata** | Freeform labels + filter | Header chips; Tags tab; Stats cloud (redundant) |
| **Cosmos tier** | **Computed** | core-hub, connected, isolated, etc. | Insights tab; search palette — *not* header classification |

### Answers

- **Is Weak Topic truly a status?** Yes — K-82 Model A confirmed. Not note kind, not analytics-only.
- **Is Favorite metadata?** Yes — explicit user action, separate from classification.
- **Are classifications discoverable?** Wide chrome yes; compact chrome partial (kind hidden, weak topic visible).
- **Do users understand hierarchy?** Risk: “classification” in Insights (Cosmos) vs note kind. UI copy should say “Note type” vs “Cosmos tier” (deferred copy pass).

No schema changes in K-83.

---

## Part 5 — Archive Usage Audit

### Current surface (K-71/K-72 unified grid)

| Section | Value | Notes |
|---------|-------|-------|
| Recent Transitions (calendar + milestones) | **High** | Primary entry for reflection |
| Areas (pills + Discovery link) | **High** | Jump to area notes |
| Timeline (range links) | **Medium** | Secondary navigation |
| Browse (period chips + links) | **Medium** | Deep browse |
| Branch views (`ArchiveBranchView`) | **Low** | Not mounted — test-only |
| Legacy analytics heatmaps | **Low** | Rollback path only |

### K-83 action

- No archive UI removed (confidence not high enough for production deletion)
- **Deferred:** Remove `ArchiveHomeView`, `ArchiveBranchView`, `ArchivePlaceholderView` after test migration

---

## Part 6 — Information Density Audit

### Findings (>40% empty or single-line containers)

| Area | Issue | K-83 action |
|------|-------|-------------|
| Notes — context panel Outline on unheaded notes | Empty TOC | Open Links when connected |
| Notes — Properties tab empty groups | Large empty sections | Deferred collapse |
| Knowledge — Stats tag cloud | Duplicates Tags tab | Documented |
| Cosmos — Insights on isolated notes | Sparse cards | Acceptable |
| Schedule — month-only calendar | Intentional whitespace | K-80 design |
| Health — workout library column | K-81 capped width | Acceptable |
| Archive — 2×2 grid cells | Some sparse vaults show hints | K-72 empty hint present |

### Principle

Improve density via **smarter defaults and collapsible groups**, not smaller fonts or removed breathing room.

---

## Part 7 — Dead UI & Dead Code Cleanup

| Item | Status | Rationale |
|------|--------|-----------|
| Stale `NoteView.tsx` imports (OutlinePanel, LinksContextPanel, etc.) | **Removed** | Logic lives in `NoteContextPanelBody` / `NoteViewEditorArea` |
| `ArchiveBranchView`, `ArchivePlaceholderView`, `ArchiveHomeView` | **Deferred** | Test dependencies; not user-facing |
| `LegacyAnalyticsView` | **Kept** | Rollback behind `ARCHIVE_SHELL_ENABLED` |
| Relations tab duplicate of Links Structure | **Deferred** | Needs telemetry before removal |
| Stats tag cloud duplicate | **Deferred** | Low harm |
| Barrel imports in `NoteView.tsx` (unused panel components) | **Deferred** | Large import block; separate cleanup PR |

---

## Part 8 — Large Vault Validation

### Automated coverage (existing)

- `editorPerformanceAudit.test.ts` — 100–2000 block documents
- `blockSelection.test.ts` — 120 blocks with nested toggles
- `virtualBlockList.test.ts` — virtualization windows
- Knowledge index — O(n) scans; acceptable to ~1000 notes in browser

### Expected scaling (document-order ops)

| Vault size | Search | Related/backlinks | Cosmos | Context panel | Navigation |
|------------|--------|-------------------|--------|---------------|------------|
| 200 notes | Good | Good | Good | Good | Good |
| 500 notes | Good | Acceptable | Acceptable | Good | Good |
| 1000 notes | Acceptable | Acceptable | Heavy graph layout | Good | Acceptable |

### Bottlenecks (no rewrite in K-83)

- Full-graph render without focus note at 500+ nodes
- Workspace search palette rebuild on each keystroke (mitigated by debounce)
- Markdown parse on note switch for very large bodies (virtualization helps editing)

### Manual QA recommended

- 500–1000 block single note editing
- 500+ note vault Cosmos open
- Mobile note editing + context panel overlay

---

## Part 9 — Product Philosophy Validation

| Workspace | Expected responsibility | Drift? |
|-----------|------------------------|--------|
| **Notes** | Knowledge creation | None |
| **Knowledge / Cosmos** | Knowledge discovery | Minor overlap: sidebar dashboard vs context panel |
| **Health** | Workout tracking | None |
| **Schedule** | Future commitments | None (K-80 simplified) |
| **Timetable** | Fixed recurring schedule | None |
| **Archive** | Reflection and transitions | None |

**Overlap notes:** Sidebar `WorkspaceDashboardView` exposes discovery/timeline entry points that duplicate context panel tabs — intentional dual entry for different mental modes (browse vs edit).

---

## Verification

```bash
npm run typecheck   # pass
npm run build       # pass
npm run test        # pass (1962+ tests)
```

### Manual QA checklist

- [ ] Large note editing (500+ blocks)
- [ ] Cross-toggle selection (shift+click, gutter)
- [ ] Cross-toggle drag (header zone, nested toggles)
- [ ] Knowledge navigation (panel open → Links on connected notes)
- [ ] Schedule create/edit
- [ ] Workout logging
- [ ] Archive browse
- [ ] Mobile note editing

---

## Remaining UX Debt

1. Collapsed-toggle children not selectable until expanded
2. Multi-block indent/outdent
3. Compact chrome: read-only note kind chip
4. Relations tab demotion or merge with Links Structure
5. Stats tag cloud deduplication
6. Context More menu keyboard navigation
7. Archive branch view dead code removal
8. NoteView barrel import cleanup
9. Large vault Cosmos graph performance
10. Weak topic chip → click to toggle

---

## Recommended Post-K83 Roadmap

1. **Maintenance mode** — bug fixes and small polish only
2. **Telemetry pass** — tab click frequency to validate Relations/Stats demotion
3. **Mobile metadata strip** — read-only kind + compact classification
4. **Archive dead code removal** — migrate tests, delete branch views
5. **Incremental density** — collapsible Properties groups, empty-state tab routing
6. **Editor** — multi-block indent/outdent if user demand appears

---

## Affected Files (K-83)

- `dragSelection.ts`, `dragSelection.test.ts`
- `multiBlockOps.ts`, `multiBlockOps.test.ts`
- `blockCopy.ts`, `blockCopy.test.ts`
- `ToggleBlock.tsx`, `SingleBlock.tsx`
- `useEditorKeyboard.ts`
- `NoteViewEditorArea.tsx`
- `RelatedNotesPanel.tsx`
- `NoteView.tsx` (stale import cleanup)
- `frontend/docs/K-83-product-finalization-audit.md`
