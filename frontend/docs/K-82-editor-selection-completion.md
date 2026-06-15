# K-82 — Editor Selection Completion & Knowledge Navigation Refinement

## Rationale

K-78–K-81 addressed caret placement, search unification, and knowledge context layout. Remaining friction centered on **multi-block editing across toggle boundaries** and **long-document usability**. K-82 completes the selection model and polishes knowledge navigation UX debt.

## Part 1 — Cross-Toggle Selection

### Root cause

`blockSelection.ts` used **same-parent sibling ranges** only. Toggle headers and children have different parents in the block tree, so shift+click fell back to single-block selection.

### Design decision: Tree preorder (document order)

Selection now uses `flattenBlockIds` — **depth-first preorder**, matching:

- Arrow block navigation (`useEditorBlockEditing`)
- Multi-block delete/duplicate (`multiBlockOps.ts`)
- Drag ordering (`dragSelection.ts`)

This is not DOM/visual row order (which would require collapsed-toggle filtering). Tree preorder matches user expectation for open toggles: header immediately precedes its children.

### Fix

| File | Change |
|------|--------|
| `blockSelection.ts` | `getDocumentOrderedIds`; shift+click and Shift+Arrow use full document order |
| `blockGutterSelection.ts` | Gutter drag uses document order |
| `blockSelection.test.ts` | Cross-toggle cases + 120-block stress test |

**Example:** Shift+click from `a` to `c` → `['a', 'b', 't', 'c']`

## Part 2 — Cross-Toggle Drag & Move

Multi-block ops already used `flattenBlockIds`. With cross-toggle selection fixed:

- **Delete / duplicate / indent / outdent** operate on document-ordered selection
- **`minimalDragIds`** when toggle header and children are both selected, drag moves the toggle subtree via the header id (children ids filtered as descendants)

### Deferred edge cases

- Gutter drag from **toggle header shell** (no gutter strip on `ToggleBlock.tsx`) — header selectable via shift+click, not gutter drag
- **Collapsed toggle** children not in DOM — cannot select hidden children until expanded
- Selecting toggle header **and** all children includes redundant ids; drag uses `minimalDragIds`

## Part 3 — Large Document QA

Automated coverage:

- `blockSelection.test.ts` — 120 blocks with periodic nested toggles; full-document shift range
- Existing virtualization + flatten paths scale linearly

### Manual QA recommended

| Size | Focus |
|------|-------|
| 100–250 blocks | Selection, scroll, toolbar |
| 500–1000 blocks | Virtual scroll + shift range latency |

## Part 4 — Knowledge Navigation Audit

| Task | K-81 | K-82 improvement |
|------|------|------------------|
| A: Find related note | Links tab, Connections first | Structure/Sources **collapsed** when connections exist |
| B: Find backlinks | In Connections group | Same — less scroll to reach |
| C: Understand connections | Context strip chips | Weak topic status chip when flagged |
| D: Jump between notes | Workspace search + links | More menu closes on outside click / Escape |

Estimated click reduction: Structure/Sources collapsed saves 1–2 scroll screens on notes with active connections.

## Part 5 — Knowledge Context Density

**Chosen approach:** Option C (collapsible groups) + K-81 connection ordering preserved.

- **Connections** — always expanded
- **Structure** — collapsible, **collapsed by default** when `connectionsCount > 0`
- **Sources** — collapsible, **collapsed by default** when `connectionsCount > 0`

`KnowledgePanelSection` gained `collapsible` + `defaultCollapsed` props.

## Part 6 — More Menu Polish

`KnowledgeContextPanel` More ▾ menu now closes on:

- Outside pointer down
- Escape key
- Focus moving outside menu

## Part 7 — Weak Topic Final Decision

**Model: A — Status** (not classification, not analytics signal)

- Grouped with classification in header (wide chrome)
- **Context strip chip** when active — visible in compact chrome
- **Overflow menu toggle** in compact/mobile header actions

Rationale: Weak topic is a per-note study flag (`weakTopic: yes` + tag), not a note kind. Status chip pattern matches review/tier chips.

## Part 8 — Notes Workflow Audit

No regressions expected in:

- Create note (+ New Note button, K-81)
- Search (workspace palette, K-81)
- Wiki / related navigation (links panel order)
- Multi-select + move (K-82 selection fix)

## Part 9 — Cleanup

- Exported `getDocumentOrderedIds` from selection barrel
- `getSiblingOrderedIds` retained but deprecated for legacy callers
- No schema or tree model changes

## Affected Files

- `blockSelection.ts`, `blockSelection.test.ts`, `selection/index.ts`
- `blockGutterSelection.ts`, `blockGutterSelection.test.ts`
- `KnowledgePanelSection.tsx`, `LinksContextPanel.tsx`
- `KnowledgeContextPanel.tsx`
- `NoteContextStrip.tsx`, `NoteEditorHeaderActions.tsx`, `NoteViewEditorArea.tsx`

## Verification

```bash
npm run typecheck
npm run build
npm run test
```

## Remaining UX Debt

1. Toggle header gutter drag not wired
2. Collapsed-toggle children excluded from selection until expanded
3. Large-doc manual QA at 500–1000 blocks
4. Context More menu: no arrow-key navigation inside menu
5. Rule/database “save current query” still decoupled from sidebar search (K-81)
