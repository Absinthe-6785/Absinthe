# K-67 Workspace Continuity

## Goal

Make Absinthe feel like one connected personal operating system — not isolated Notes, Schedule, Health, and Archive apps.

## Architecture (no routing rewrite)

Three session-scoped navigation layers stack on K-66:

| Key | Purpose |
|-----|---------|
| `absinthe.noteNav.v1` | Note back/forward stack + source |
| `absinthe.noteNav.returnTab` | Cross-workspace return tab (`planner` \| `health` \| `analytics`) |
| `absinthe.noteNav.breadcrumb` | Lightweight breadcrumb segments (i18n key or plain label) |

### Entry points

```
openNote(id, { returnTab?, breadcrumb? })     // cross-tab
navigateToNote(id, source, { breadcrumb? })   // in-tab
openHealthDayNote(date, create, update, crumbs?) // unified day log
returnFromNote() → switchToTab(returnTab)
```

### New modules

| File | Role |
|------|------|
| `lib/noteBreadcrumb.ts` | Session breadcrumb CRUD |
| `lib/healthDayNotes.ts` | `YYYY-MM-DD` day log title convention |
| `hooks/useNoteBreadcrumb.ts` | React subscription hook |
| `components/views/noteview/NoteBreadcrumbBar.tsx` | Breadcrumb UI |
| `components/views/noteview/WorkspaceContextBanner.tsx` | Context hint chips |

### Stack sources (K-67 additions)

`archive | discovery | timeline` added to `NoteNavigationSource` for analytics and in-notes panel flows.

## Priorities delivered

1. **Universal return paths** — Archive, Discovery, Timeline, Schedule → Note → Return
2. **Health day log** — Workout, Nutrition, Recovery share one dated note
3. **Global breadcrumb** — Session-persisted path under note header
4. **Context awareness** — Event / day log / milestone hint chips
5. **Toast standardization** — `success | error | warning | info` + hardcoded toast lint

## Constraints met

- No routing rewrite
- No new major subsystems
- Extends K-66 session navigation only

## Related docs

- [K-67 Navigation Continuity](./K-67-navigation-continuity.md)
- [K-67 Health Integration](./K-67-health-integration.md)
- [K-67 Breadcrumb](./K-67-breadcrumb.md)
- [K-67 Feedback Consistency](./K-67-feedback-consistency.md)
- [K-67 Validation Checklist](./K-67-validation-checklist.md)

## K-68 roadmap (recommended)

1. **Breadcrumb tap navigation** — make segments clickable to jump workspace sections (still no router)
2. **Related content panel** — expand `WorkspaceContextBanner` into sidebar linked notes / countdown / milestone list
3. **Return path for Cosmos** — optional `returnTab` when opening from graph on mobile
4. **Toast queue** — stack multiple toasts instead of replacing
5. **E2E continuity tests** — Playwright flows for Archive → Note → Return and Health day log round-trip
