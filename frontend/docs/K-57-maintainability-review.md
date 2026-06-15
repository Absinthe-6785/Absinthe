# K-57 Maintainability Review

Branch: `k57-noteview-knowledge-refactor`  
Date: 2026-06-15

## Executive summary

K-57 addresses the two largest maintainability debts flagged in K-56: monolithic `NoteView.tsx` and monolithic `knowledge/index.ts`. Both are now decomposed into focused modules with unchanged public APIs and passing typecheck.

## Metrics

| File / area | Before (K-56) | After (K-57) | Δ |
|-------------|---------------|--------------|---|
| `NoteView.tsx` | 3,433 | 2,770 | −663 (−19%) |
| `knowledge/index.ts` | ~1,055 | 78 | −977 (−93%) |
| `noteview/` total | ~530 | 2,186 | +1,656 (extracted) |

## Objectives completed

| Priority | Deliverable | Status |
|----------|-------------|--------|
| P1 | `NoteContextPanelBody.tsx` extraction | **Done** — 582 lines |
| P2 | `useNoteViewActions.ts` extraction | **Done** — 979 lines |
| P3 | Knowledge domain barrels (8 new) | **Done** |
| P4 | Root knowledge barrel under 80 lines | **Done** — 78 lines |
| P5 | Block-editor `@/` migration | **Partial** — 5 menu/selection files |
| P6 | Architecture audit docs | **Done** — K-57 doc set |

## Module boundaries established

```
noteview/          → NoteView orchestration (state, panels, actions, context body)
knowledge/
  components/      → UI panels re-exported via components/index.ts
  maps/            → Concept/learning-path domain logic
  academic/        → Projects, milestones
  analytics/       → Dashboard insight builders
  research/        → Literature workflow
  study/           → Study notes, weak topics
  review/          → Maintenance/review queues
  references/      → Footnote extraction
```

## Risk assessment

| Risk | Mitigation | Residual |
|------|------------|----------|
| Barrel export drift | Root `export *` preserves API | Low |
| Prop drilling in context panel | Documented groups for K-58 refactor | Medium |
| Large `useNoteViewActions` | Single responsibility (mutations); split by domain in K-58 | Medium |
| Deep cosmos/database imports | Tracked in import audit | Low (no runtime impact) |

## Behavior preservation

- No API/schema changes
- No UX redesign
- Context panel tabs unchanged
- Knowledge barrel public surface unchanged (typecheck confirms)

## Remaining debt

| Item | Priority | Target |
|------|----------|--------|
| `NoteViewSidebar.tsx` / `NoteViewEditorArea.tsx` | P1 | K-58 |
| `useNoteViewStyles.ts` | P2 | K-58 |
| Cosmos/database `@/` migration (~17 files) | P2 | K-58 |
| Slim `NoteContextPanelBody` props | P3 | K-58 |
| `useNoteViewActions` domain split | P3 | K-58 |
| NoteView &lt; 2,000 lines | P1 | K-58 |

## K-58 roadmap

1. Sidebar + editor area extraction → `NoteView.tsx` under 2,000 lines
2. Migrate cosmos onboarding/actions + database controls to `@/`
3. Group context panel props into typed sub-objects
4. Optional: nested `knowledge/panels/index.ts` for context-panel-only exports
5. Consider `query`/`views`/`collections` import lint rule (barrel-only from outside knowledge)

## Related docs

- [K-57-noteview-decomposition.md](./K-57-noteview-decomposition.md)
- [K-57-knowledge-module-review.md](./K-57-knowledge-module-review.md)
- [K-57-validation-checklist.md](./K-57-validation-checklist.md)
