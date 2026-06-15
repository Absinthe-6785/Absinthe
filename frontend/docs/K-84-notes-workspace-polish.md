# K-84 — Notes Workspace Polish

Workflow polish pass for the Notes workspace: information architecture, discoverability, layout consistency, and header density. No new features.

---

## Before / After (layout)

### Sidebar toolbar

**Before**

```text
┌──────────────────────────┐
│  🔍 Search (Ctrl+K)      │  ← separate row
├──────────────────────────┤
│  [ + + New Note ]        │  ← full-width, duplicate +
└──────────────────────────┘
```

**After**

```text
┌──────────────────────────┐
│ Search (Ctrl+K) │ + New  │  ← single 28px row
└──────────────────────────┘
```

Mobile note list: `[🔍] [+]` icon pair. Collapsed sidebar: icon-only search + plus.

### Note header

**Before**

```text
Title | Kind | Weak | … | Mark Event | Mark Milestone | Mark Area | ⭐ | ⎘ | 📋 | …
#tag (wrapped vertically)
Context strip (separate band)
```

**After**

```text
Title
[Kind] [Weak] [EJU] [Unclassified] …     ← 24px status cluster
#TOEFL #English #Voca +2                  ← horizontal, nowrap overflow
────────────────────────────────────────
[Reading|Graph] ⭐ 📋 ⋯ Panel             ← actions toolbar (8px gap)
Editor toolbar (Find in note…)
```

---

## Search IA rationale

| System | Entry | Behavior |
|--------|-------|----------|
| **Global Search** | Sidebar search row, `Ctrl+K` | Opens `WorkspaceSearchPalette` (notes, tags, workspaces, projects) |
| **Find in Note** | Editor toolbar input, `Ctrl+F` | Document-local search; sets `searchScope` to `document` |

Removed ambiguity: `Ctrl+F` no longer opens the workspace palette. Sidebar search is a trigger only — no separate list-filter search box.

---

## Header IA rationale

- **Title row** — navigation, title, folder, sync only (metadata vs actions separated).
- **Status cluster** — classification select, weak-topic chip, and `NoteContextStrip` chips at unified **24px** height.
- **Tags** — single horizontal row; overflow as `+N` before expand.
- **Actions toolbar** — always-visible **Favorite**, **Copy**, **More**; secondary ops in More:
  - Mark Event / Milestone / Area
  - Weak topic toggle (compact chrome)
  - Duplicate
  - Trash (archive)
  - Export `.md`

Eliminates medium-width overlap (`Mark EventMilestoneMark Area`). Minimum **8px** gap between action controls.

---

## Sidebar density decisions

| Change | Detail |
|--------|--------|
| Nav row height | `.bfi` padding `4px 10px`, `min-height: 28px`, font `11px` |
| Section labels | `.bseclbl` reduced padding/font |
| Trace counts | `Today (n)`, `This Month (n)` from trace projections |
| Favorites | `Favorites (n)` right-aligned count (replaces badge pill) |
| New Note | Removed full-width CTA that pushed list down |

Counts use `buildDailyTraceProjection` (today activities) and `buildRangeLensProjection` (month `notesTouched`).

---

## New Note discoverability rationale

- Single **+** icon (label `New Note` without leading `+` in i18n).
- Co-located with search — the two highest-frequency sidebar actions share one row.
- Still available: `Ctrl+N`, empty states, Cosmos HUD, dashboard quick actions.

---

## Knowledge Context Panel (review only)

No redesign. Confirmed unchanged:

- Resizable width via `useResizablePanelWidth`
- Limits **180–400px**, `localStorage` key `absinthe-knowledge-panel-width`
- Primary tabs + More overflow for secondary tabs

---

## 24px system

Standardized across:

- `NoteClassificationSelector` (pill select)
- `WeakTopicToggle` (status chip, not action button)
- `NoteContextStrip` `ContextChip`
- `TagChip` (`size="sm"`)
- `NoteEditorHeaderActions` icon buttons (desktop)

---

## Remaining UX debt

| Item | Notes |
|------|-------|
| Tag overflow on very narrow headers | `+N` expand still needed; no ResizeObserver-based dynamic fit |
| Compact chrome classification | Kind/weak toggles only in More menu + context strip weak chip |
| Note list row height | `.bni` still `min-height: 44px` for touch targets |
| Cosmos / graph create note | Separate entry point (intentional) |
| Workspace palette vs knowledge query syntax | Advanced `tag:` queries still share `searchQuery` state with find-in-note |

---

## Files changed

- `NoteViewSidebar.tsx` — unified toolbar, counts, density
- `NoteViewEditorArea.tsx` — header hierarchy, compact tags
- `NoteEditorHeaderActions.tsx` — Favorite / Copy / More structure
- `useNoteKeyboardActions.ts` — `Ctrl+F` → find in note
- `NoteClassificationSelector.tsx`, `WeakTopicToggle.tsx`, `TagChip.tsx`, `NoteContextStrip.tsx` — 24px chips
- `useNoteViewStyles.ts` — denser sidebar CSS
- `NoteView.tsx` — sidebar trace counts
- `useNoteViewSidebarProps.ts` — prop wiring
- `i18n.ts` — `nvNewNoteBtn` without duplicate `+`

---

## Verification

```bash
npm run typecheck   # pass
npm run build       # pass
npm run test        # 1962/1962 pass
```
