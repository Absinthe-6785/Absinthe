# Knowledge-30.16 — Archive Home Default Landing

## Scope

First user-visible Archive release. Archive Home becomes the default surface when opening the Analytics tab. No tab rename, no legacy deletion, no Period / Area / Timeline implementation.

Builds on K-30.10–K-30.15 (projection, shell, Home sections).

---

## Flag Decision

**`ARCHIVE_SHELL_ENABLED` is retained and set to `true`.**

| Aspect | Decision |
| ------ | -------- |
| Location | `frontend/src/components/views/features/archive/archiveShellConfig.ts` |
| Value | `true` (K-30.16) |
| Why keep the flag | One-line rollback without reverting Archive Home code |
| Rollback | Set to `false` → legacy Analytics widgets render again |

The flag is no longer a “pre-release gate.” It is a **rollback switch** until legacy Analytics removal (K-30.17+).

---

## Analytics Integration

```
Analytics tab (unchanged label)
  └── AnalyticsView
        └── if ARCHIVE_SHELL_ENABLED → ArchiveShell (mode: home)
              └── ArchiveHomeView (projection-driven)
        └── else → legacy Analytics body (~720 lines, preserved)
```

**Entry point:** `AppContent.tsx` → `activeTab === 'analytics'` → `AnalyticsView` (unchanged routing).

**User-visible change:** Opening Analytics shows **Archive** / *What remains when you look back?* instead of Period Overview.

---

## Legacy Preservation

Legacy code is **not deleted**. When `ARCHIVE_SHELL_ENABLED === true`, the legacy JSX path is skipped but remains in `AnalyticsView.tsx`.

### Unused while Archive is enabled

| Asset | Location | Status |
| ----- | -------- | ------ |
| Period Overview header + date range | `AnalyticsView.tsx` | Skipped |
| Time range controls (Today / Weekly / Monthly / Custom) | `AnalyticsView.tsx` | Skipped |
| Activity This Week summary grid | `AnalyticsView.tsx` | Skipped |
| Scheduled Time by Category | `AnalyticsView.tsx` | Skipped |
| Exception Days list | `AnalyticsView.tsx` | Skipped |
| Activity Calendar (16-week heatmap) | `AnalyticsView.tsx` | Skipped — replaced by `ArchiveMarkCalendar` |
| Workout Records week grid | `AnalyticsView.tsx` | Skipped |
| Today's Routine Marks | `AnalyticsView.tsx` | Skipped |
| Today's Schedule | `AnalyticsView.tsx` | Skipped |
| Weekly Timetable + CRUD modal | `AnalyticsView.tsx` | Skipped |
| Legacy SWR fetches (heatmap, schedules range, workouts, exceptions) | `AnalyticsView.tsx` | Still invoked by hooks before early return* |

\*Hooks run before the Archive early return today. This is acceptable for K-30.16; a follow-up may guard fetches behind the flag to avoid unused network calls.

### Still active elsewhere

Planner, Health, and backend APIs used by legacy Analytics remain unchanged.

---

## Archive Home Audit

| Section | Visible | Order | Notes |
| ------- | ------- | ----- | ----- |
| Mark Calendar | ✓ | 1 | `data-archive-mark-calendar` |
| Recent Transitions | ✓ | 2 | `data-archive-recent-milestones` |
| Concerns | ✓ | 3 | `data-archive-area-pills` |
| Browse | ✓ | 4 | `data-archive-browse` |

**Frame:** Archive / What remains when you look back?

**Productivity language:** None in Archive Home components. Tests assert no score / streak / rank / percent / Activity This Week copy.

**Section completeness:** `data-archive-home-complete="true"` on Home root.

---

## Quality Review

Reviewed via code audit and automated tests. No redesign applied; no blocking issues found.

| Scenario | Finding | Blocks rollout? |
| -------- | ------- | --------------- |
| Desktop layout | Vertical stack (`flex-col gap-6`), card sections | No |
| Mobile layout | `px-2 lg:px-4`, calendar `overflow-x-auto`, responsive radii | No |
| Empty vault | Global hint + per-section empty messages | No |
| Large vault | 5-year calendar span; horizontal scroll on narrow viewports; projection caps milestone/area lists | No |
| No notes | All empty flags true; Browse still shows default destinations | No |
| No areas | “No areas recorded yet.” | No |
| No milestones | “No milestones recorded yet.” | No |
| No marks | Calendar empty message; Browse still populated from projection | No |

**Non-blocking follow-ups (out of scope):**

- Guard legacy SWR fetches when Archive is enabled (performance)
- Period / Area / Timeline branch implementation (K-30.17+)

---

## Accessibility Review

| Area | Finding | Action |
| ---- | ------- | ------ |
| Keyboard navigation | Interactive elements are `<button type="button">` with `focus-visible:ring` | OK |
| Focus order | DOM order matches visual section order (frame → calendar → milestones → areas → browse) | OK |
| Button semantics | Browse, milestones, areas, calendar cells use buttons + `aria-label` | OK |
| Section labels | Each section has `aria-label` on `<section>` | OK |
| Empty states | Plain text paragraphs; not live regions | Acceptable for K-30.16 |
| Calendar density | Many small day cells; keyboard traversal is lengthy | Document only — no change |

No high-confidence accessibility defects requiring fix before rollout.

---

## Testing

| Test file | Coverage |
| --------- | -------- |
| `analyticsViewArchiveLanding.test.ts` | AnalyticsView → ArchiveShell, legacy hidden, empty Home, section order, mobile classes, flag true |
| `archiveShell.test.ts` | Flag true, shell defaults to home |
| Existing archive section tests | Rendering, empty states, no productivity language |

---

## Explicit Non-Goals (confirmed)

- No Analytics tab rename
- No legacy Analytics removal
- No Period / Area / Timeline routes
- No Archive Home redesign
- No new Home sections

---

## Success Criteria

✓ Normal user opening Analytics sees Archive Home first.

✓ Product identity shifts toward “history” without renaming the tab.

✓ Rollback: set `ARCHIVE_SHELL_ENABLED = false`.
