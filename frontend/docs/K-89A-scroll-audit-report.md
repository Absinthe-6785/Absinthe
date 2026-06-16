# K-89A Scroll Audit Report

## Knowledge Context More menu

**Issue:** More dropdown had no `maxHeight` or `overflowY`. On narrow layouts with a horizontally scrolled tab bar, a growing menu could clip off-screen.

**Fix:** `KnowledgeContextPanel` More menu — `maxHeight: min(280px, 50vh)`, `overflowY: auto`, `overscrollBehavior: contain`.

## Nested scroll containers

| Location | Issue | Fix |
|----------|-------|-----|
| Properties tab | Double `overflowY: auto` on wrapper + `NotePropertiesPanel` | Outer wrapper `overflow: hidden`; single scroll on panel body |
| Timeline activity | `TimelineActivityFeed` inner `maxHeight: 420` inside scrolling `TimelinePanel` | Panel mode (`compact=false`) renders flat list; parent panel scrolls |
| Context panel body | Scroll chaining to editor | `overscrollBehavior: contain` on panel body shell |

## Editor scroll smoothness

**Issue:** Wheel at editor scroll boundary could chain to parent layout (trackpad “bounce” into adjacent panels).

**Fix:** `editor-drop-zone` scroll root — `overscrollBehavior: contain`.

**Remaining sources of perceived jank (documented, not redesigned):**

- Virtual block remeasure on height changes
- TOC scroll spy rAF work on long documents
- Outline navigation smooth-scroll + virtual scroll retry

These are acceptable for K-89A scope; future work can profile with Performance panel.

## Sidebar note list

Virtual list scroll container — `overscrollBehavior: contain` to avoid chaining when list is scrolled to end.

## Regression coverage

Scroll structure changes are covered by existing panel mount tests; Timeline feed non-compact path uses simplified list rendering verified at build/typecheck time.
