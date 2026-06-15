# K-81 — Notes Workflow Refinement & Knowledge UX

## Rationale

Real-world usage exposed friction in the highest-frequency Notes workflows: caret placement on click, hidden note creation, duplicate search surfaces, buried knowledge context, and workout layout shift. K-81 is a refinement pass — not new features or architecture.

## Part 1 — Caret Placement

### Root cause

Inactive blocks render as `.be-editable-static` (`contentEditable={false}`). Activation chained several `'end'` fallbacks:

1. `getCaretOffsetFromPoint` returned `null` on static DOM → `onActivate('end')`
2. `requestAnimationFrame` delayed offset read past useful browser selection
3. `SingleBlock.handleContentMouseDown` forced `'end'` on padding clicks
4. Static `onFocus` unconditionally activated at end
5. `applyFocusCommand` painted in rAF without passing caret into first paint

### Fix

| File | Change |
|------|--------|
| `EditableBlock.tsx` | Synchronous click offset; native selection fallback; removed static `onFocus → end` |
| `SingleBlock.tsx` | `paintEditableLive` with caret on activation; point-map on shell clicks |

## Part 2 — Note Creation Discoverability

- Permanent **+ New Note** button above note list (`data-noteview-new-note-btn`)
- Empty state **Create First Note** retained
- Mobile: workspace search + menu in list header; creation via prominent button

## Part 3 — Search Workflow Simplification

| Before | After |
|--------|-------|
| Sidebar text search + workspace search | **Workspace search only** (Ctrl+K, sidebar trigger) |
| List filtered by sidebar query | **All / Recent / Favorites** filter chips |
| Ctrl+F → sidebar input | Ctrl+F → workspace search palette |

In-document find remains via compact **Find in note** field in editor toolbar (separate from vault search).

## Part 4–5 — Knowledge Context

### Links tab order (usage-first)

1. **Connections** — Related Notes → Backlinks → Referenced Notes
2. Structure — concept, relations, learning path
3. Sources

### Tab bar grouping

Primary: Outline · Links · Graph · Insights · Properties  
**More ▾** menu: Actions · Discover · Timeline · Tags · Relations · Stats

### Scroll

Removed duplicate `overflowY: auto` on `NoteView` context wrapper — single scroll owner per panel.

## Part 6 — Note Header Cleanup

- Classification + Weak Topic grouped in one bordered **status** cluster (`data-note-header-classification-group`)
- Weak topic styled as inline status chip (no separate border box)

## Part 7 — Workout Layout Stability

- Today's Workout card wrapper always reserves `WORKSPACE_CARD.workoutHero` dimensions
- Skeleton renders **inside** the same card shell (no mount/unmount size jump)
- Library + Routine column: `42%` → `48%`, `max-w-[480px]` → `max-w-[540px]`

## Part 8 — Knowledge Navigation Audit (design review)

With 200+ notes / 60+ relations, expected improvements:

| Flow | Before | After |
|------|--------|-------|
| Find related note | Scroll Links → Structure first | Related Notes at top of Connections |
| Backlink discovery | Below concept hub | Second in Connections (after Related) |
| Context scan | 11 horizontal tabs | 5 primary + More menu |
| Graph dominance | Equal tab weight | Graph tab retained; links prioritized in Links panel |

Manual QA recommended on realistic vault for scroll depth confirmation.

## Affected Files

- `EditableBlock.tsx`, `SingleBlock.tsx`
- `NoteView.tsx`, `NoteViewSidebar.tsx`, `NoteViewEditorArea.tsx`
- `useNoteViewState.ts`, `useNoteViewSidebarProps.ts`
- `useNoteKeyboardActions.ts`
- `KnowledgeContextPanel.tsx`, `LinksContextPanel.tsx`, `NoteContextPanelBody.tsx`
- `WeakTopicToggle.tsx`, `HealthView.tsx`
- `i18n.ts`

## Verification

```bash
npm run typecheck
npm run build
npm run test
```

## Remaining UX Debt

1. Day/week calendar files still on disk (unrelated; from K-80)
2. `searchQuery` still powers in-document find — separate from workspace search by design
3. Weak topic hidden in compact chrome — accessible via overflow / Properties
4. Context panel "More" menu does not close on outside click yet
5. Rule/database "save current query" no longer tied to sidebar search
