# K-64 Visual Consistency Audit

## Card Shells (already aligned)

Schedule, Health, Settings share:

```
rounded-[24px] lg:rounded-[32px]
theme.card
p-5 lg:p-6
```

Knowledge NoteView uses inline styles — intentional legacy; not refactored in K-64.

## Button Hierarchy

| Surface | Primary CTA | K-64 adjustment |
|---------|-------------|-----------------|
| Schedule/Health/Settings | `bg-primary rounded-xl py-3.5` | Unchanged |
| NoteView `.bwbg` | Inline accent, 7px radius | **12px radius, taller padding** |
| Knowledge panels | 10px accent outline buttons | **min-height 36px** on empty-state actions |
| Cosmos HUD | 9px inline buttons | Now interactive (no style change) |

## Spacing

| Area | Pattern |
|------|---------|
| Health/Planner cards | `gap-4 lg:gap-5` |
| Note sidebar header | `7px 10px` inline |
| Context panel | 210–230px width |

Gap: Knowledge inline padding vs Tailwind cards — acceptable; full unification is K-65+ scope.

## Typography

| Area | Style |
|------|-------|
| Schedule/Health headings | `font-heading text-lg/2xl` |
| Knowledge section headers | 10px uppercase |
| Settings | `font-heading text-lg` |

No changes in K-64 — documented for future token pass.

## Empty States

Two systems remain:

1. **Knowledge** — `KnowledgePanelEmpty` (full opacity, accent actions)
2. **Schedule/Health** — Tailwind `EmptyState` (50% opacity icon)

K-64 bridged gap: Health blocks empty now passes `onClick` for actionable pattern.

## Icon Usage

- Lucide icons consistent across views
- Note sidebar uses 11–14px icons in compact toolbar
- Health/Schedule use 16–18px in card headers

## K-65 Visual Roadmap

- Shared `primaryButtonClass` token for NoteView + Tailwind views
- Reduce empty-state opacity on Schedule/Health to match Knowledge “active” feel
- i18n for remaining hardcoded Korean strings in NoteView editor chrome
