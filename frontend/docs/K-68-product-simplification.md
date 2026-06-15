# K-68 Product Simplification & Workflow Cleanup

Branch: `k68-product-simplification` (from `main` @ cd3e0b7)

---

## 1. Health Simplification Summary

| Before | After |
|--------|-------|
| Dashboard · Nutrition · Workout · Habits · Recovery | **Workout · Nutrition** |

**Workout** is now the default health landing. It consolidates:
- Workout session logging
- Workout history (calendar)
- Recovery notes (`RecoveryLogPanel`)
- Condition / InBody tracking
- Day log links

**Removed from navigation:**
- **Dashboard** — large empty summary cards, low density
- **Habits** — duplicated Planner routine concept; split-day routine setup remains in Workout
- **Recovery** — merged into Workout right column

**Nutrition** stays a dedicated full-width tab with improved intake dropdown.

---

## 2. Nutrition Bug Root Causes

### Bug A — Saved foods missing in Add Intake dropdown
| | |
|---|---|
| **Symptom** | Custom Entry and first canonical food visible; saved entries between them absent |
| **Root cause** | Outer filter used `normalizeProteinCategory()`; inner `<option>` filter used strict `(s.category \|\| 'Other') === cat`. Legacy Korean `기타` and emoji-prefixed categories (`🐟 Fish`) failed the inner match |
| **Fix** | `sourcesByCategory` memo with consistent normalization; `기타` → `Other` mapping in `proteinConstants.ts` |

### Bug B — Rows between Custom Entry and White Fish unselectable
| | |
|---|---|
| **Symptom** | Phantom rows in native `<select>`; clicks hit nothing |
| **Root cause** | Empty `<optgroup>` headers from Bug A; select inside `overflow-hidden` parent |
| **Fix** | Render optgroups only when category has sources; `relative z-10` on select wrapper |

### Bug C — Occasional UI lag
| | |
|---|---|
| **Symptom** | Stutter on every intake add/delete |
| **Root cause** | `mutateIntake` revalidated 30-day protein range in parallel on each mutation |
| **Fix** | Intake mutations revalidate daily log only; weekly metrics refresh on date change / profile save |

---

## 3. Planner Redesign Findings

### Month view
- **Before:** Empty 42-cell grid; max 2 note events/day; no schedule blocks
- **After:** Up to 3 note events + 2 schedule blocks per cell; blocks show `startTime` + title; combined overflow label
- Projection `overflowEventCount` aligned to max-visible cap (3)

### Agenda view
- **Before:** Events-only grouped list; schedules excluded; mostly empty container
- **After:** `AgendaStreamList` — chronological stream of schedules, events, todos, milestones with date headers (`Jun 15 → 09:00 Workout`)

### Countdown placement (recommendation)
| View | Current | Recommendation |
|------|---------|----------------|
| Day | `DayCountdownStrip` inline | Keep — contextual to selected day |
| Week | Sidebar `ScheduleCountdownPanel` | Keep in planning column |
| Month | Sidebar panel | Hide in dashboard-only modes (K-69) |
| Agenda | `AgendaCountdownSection` above stream | Keep pinned — D-day semantics differ from timed stream |

**Do not** merge countdowns into the chronological stream; they serve different mental models.

### Schedule modal
- Category buttons now set paired theme color (Study→gold, Workout→blue, etc.)
- Selected category uses colored background instead of generic primary fill

---

## 4. Layout Consistency Audit

| Screen | Finding | K-68 action |
|--------|---------|-------------|
| Health Dashboard | Removed — was >60% empty | Nav collapse to 2 tabs |
| Health Workout | Duplicate protein panel removed | Protein only in Nutrition |
| Nutrition | Full-width dedicated tab | Improved |
| Planner Month | `min-h-[88px]` cells reserved | Blocks/events fill cells |
| Planner Agenda | Empty container | Stream fills column |
| Notes | No K-68 changes | Card rhythm already consistent |

### CLS / layout shift
- Month cells: fixed `min-h-[88px] lg:min-h-[96px]` prevents grid collapse
- **Remaining:** Async protein/workout panels lack skeleton placeholders (K-69)
- **Remaining:** Schedule block fetch for full month range causes late chip injection (K-69)

### Card rhythm
Shared patterns preserved: `rounded-[24px] lg:rounded-[32px]`, `p-5 lg:p-6`, `font-heading` headers. No global token refactor in K-68 scope.

---

## 5. Product Density Audit

| Location | Empty space (est.) | Recommendation | Implemented |
|----------|-------------------|----------------|-------------|
| Health Dashboard | ~65% | Remove tab | ✅ |
| Health Recovery tab | ~70% | Merge into Workout | ✅ |
| Health Habits | Duplicates Planner | Remove tab | ✅ |
| Planner Month grid | ~80% on sparse months | Event + block chips | ✅ |
| Planner Agenda | ~75% | Chronological stream | ✅ |
| Workout left column (mobile) | Tab switching hides panels | Acceptable for mobile | — |
| Schedule countdown sidebar + agenda | Duplicate D-days | Hide sidebar in dashboard modes | K-69 |

---

## 6. Files Modified

```
frontend/src/components/views/HealthView.tsx
frontend/src/components/views/features/health/HealthWorkspaceNav.tsx
frontend/src/components/views/features/health/HealthDashboardPanel.tsx
frontend/src/components/views/features/health/nutrition/ProteinTracker.tsx
frontend/src/components/views/features/health/nutrition/proteinConstants.ts
frontend/src/components/views/features/health/nutrition/proteinConstants.test.ts
frontend/src/components/views/features/health/hooks/useProteinData.ts
frontend/src/components/views/PlannerView.tsx
frontend/src/components/views/features/planner/calendar/buildPlannerCalendarProjection.ts
frontend/src/components/views/features/planner/calendar-ui/month/monthCalendarPresentation.ts
frontend/src/components/views/features/planner/calendar-ui/month/MonthCalendarCell.tsx
frontend/src/components/views/features/planner/calendar-ui/month/monthCalendar.test.ts
frontend/src/components/views/features/planner/calendar-ui/agenda/agendaCalendarPresentation.ts
frontend/src/components/views/features/planner/calendar-ui/agenda/AgendaStreamList.tsx
frontend/src/components/views/features/planner/calendar-ui/agenda/AgendaCalendarView.tsx
frontend/src/components/views/features/planner/calendar-ui/agenda/agendaView.test.ts
frontend/docs/K-68-product-simplification.md
```

---

## 7. Verification Results

```bash
cd frontend
npm run typecheck   # PASS
npm run build       # PASS
npm run test        # PASS — 270 files, 1948 tests
```

### Manual QA checklist
- [ ] Health: Workout default, Nutrition tab, Recovery panel in Workout
- [ ] Nutrition: Add Intake shows all saved foods; no phantom select rows
- [ ] Planner: Month cells show events/blocks; Agenda chronological stream
- [ ] Schedule: Category color matches selection
- [ ] No Habits/Dashboard/Recovery nav items

---

## 8. Before / After Screenshots

Screenshots require a running dev server with authenticated session. Capture manually:

| Area | Before | After |
|------|--------|-------|
| Health nav | 5 tabs | 2 tabs (Workout first) |
| Workout layout | Protein duplicate + separate Recovery tab | Recovery inline, no protein |
| Nutrition dropdown | Missing foods, ghost rows | Full category-grouped list |
| Planner month | Empty cells | Event + schedule chips |
| Planner agenda | Sparse event groups | Date-header stream |
| Schedule modal | Generic primary on all categories | Per-category colors |

Suggested paths: `/health` (Workout, Nutrition), `/planner` (month, agenda views), New Schedule modal.

---

## 9. Remaining UX Debt (post K-68)

1. **Orphaned components:** `HealthDashboardPanel.tsx`, `HabitQuickPanel.tsx` — unused, safe to delete in K-69
2. **i18n keys:** `healthNavDashboard`, `healthNavHabits`, `healthNavRecovery` still in locale files
3. **Month schedule fetch:** Blocks only indexed for anchor-date range, not full month
4. **CLS skeletons:** Protein chart, workout history, planner async panels
5. **Countdown dedup:** Hide `ScheduleCountdownPanel` when agenda/day already shows countdowns
6. **Theme chips:** Apply `THEME_COLORS` to month/week schedule block chips
7. **Screenshot automation:** Dev auth fixture for visual regression
