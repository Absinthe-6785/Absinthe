# K-43 Search Experience Review

---

## Search surfaces

| Mode | Trigger | Component | Scope |
|------|---------|-----------|-------|
| List filter | Sidebar input | `NoteView` | Note list only |
| Workspace search | Ctrl+K | `WorkspaceSearchPalette` | Notes, projects, paths, collections, tags |
| Document search | Ctrl+F | Block editor | Current note body |

---

## Workspace result metadata (`buildWorkspaceSearch.ts`)

| Field | Shown in palette | Notes |
|-------|------------------|-------|
| Title | Yes | 12px bold |
| Subtitle | Yes | Area · galaxy · connection count (unlabeled) |
| Importance badge | Yes | Pill, accent |
| Tier hint | Yes | Explain lines — overlaps badge semantically |
| Actions available | Yes | Accent line |
| Discovery opportunity | Yes | Faint line |
| Tags on note rows | No | Tags are separate result kind |

Enrichment applies to **note** results only when `KnowledgeIndexService` is passed.

---

## Density assessment

**Concern:** Up to 5 stacked lines per note row in a 360px listbox.

**Verdict:** Rich for power users; may overwhelm on first use.

**Recommendations (K-44):**

1. Collapse tier hint behind “Why this tier?” expander (match Insights pattern).
2. Label subtitle segments (“Area”, “Connections”).
3. Surface top tag on note row when query matched via tag.
4. Workspace search shortcuts to open Discover/Timeline panels (not implemented).

---

## Performance (K-43 fix)

- **Before:** `buildNoteGalaxyMap` called once per matching note per keystroke.
- **After:** Single galaxy map hoisted per `buildWorkspaceSearch` call.
- **Before:** `buildDiscoveryFeed` rebuilt inside palette independently of `NoteView`.
- **After:** Optional `discoveryFeed` prop reused from parent memo.
