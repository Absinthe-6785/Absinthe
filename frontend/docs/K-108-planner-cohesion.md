# K-108 — Planner Cohesion

Branch: `k108-planner-cohesion`

## Philosophy

Planner is **not** a task manager or GTD inbox. It organizes:

- **Today** — daily note, schedule timeline, routine summary, tiered upcoming
- **Routine** — weekly timetable (separate tab + summary cards)
- **Upcoming** — Today / Tomorrow / Later with relative labels
- **Calendar** — month grid for date navigation and event overview

## Information architecture

```
Today
────────────
Today's note
Today's schedule
Routine today        ← weekly slots for today's weekday
Upcoming             ← Today / Tomorrow / Later tiers

Month Calendar       ← lazy-mounted on scroll

Timetable Summary    ← link to full timetable tab
```

### Before / After

| Before (K-105) | After (K-108) |
|----------------|---------------|
| 58% month / 42% today side-by-side | Today-first vertical stack |
| Upcoming separate card | Upcoming embedded in Today card |
| Timetable summary unwired | Routine today + bottom summary wired |
| Per-date upcoming labels only | Today / Tomorrow / Later tiers + relative labels |
| Month always mounted | Month grid lazy via `IntersectionObserver` |

## PlannerProjection

Single-pass workspace projection (`buildPlannerProjection.ts`):

| Field | Purpose |
|-------|---------|
| `todayItems` | Unified agenda for today's timeline |
| `upcomingItems` | Flat chronological upcoming list |
| `groupedUpcoming` | Today / Tomorrow / Later tier sections |
| `timetableToday` | Weekly slots matching today's weekday |
| `calendar` | Existing `PlannerCalendarProjection` |

## Calendar interaction flow

1. **Click month cell** → selects date (`onAnchorDateChange`)
2. **Today's schedule** → `DayScheduleTimeline` with view/edit actions
3. **Click schedule block** → `ScheduleEventDetailPanel`
4. **Edit / Delete / Duplicate** → modal or confirm from detail panel or agenda menu
5. **Empty day hover** → ring highlight + aria-label (`data-k108-month-cell-empty`)

## Performance

- `PlannerProjection` built once in `CalendarShell`
- Month grid deferred until visible (`data-k108-planner-month-lazy`)
- Upcoming list deferred until visible (`useElementVisible` in `UpcomingAgendaPanel`)

Run: `npm test -- k108`

## Mobile (320 / 375 / 768)

- Today panel: 44px touch targets on note button
- Month grid: horizontal scroll not required; full-width cells
- Detail panel: full-screen overlay on mobile
- Timetable: standalone tab with day-grouped mobile layout

## Audits

| File | Scope |
|------|-------|
| `k108PlannerIaAudit.ts` | IA section order |
| `k108TimetableAudit.ts` | Routine today + summary |
| `k108UpcomingAudit.ts` | Tier grouping |
| `k108CalendarAudit.ts` | Click → edit flow |
| `k108PlannerPerformanceAudit.ts` | Projection benchmarks |
| `k108PlannerMobileAudit.ts` | Breakpoint targets |

## QA checklist

- [ ] Today panel appears first on Schedule tab
- [ ] Routine today shows weekday slots; click opens Timetable tab
- [ ] Upcoming groups: Today, Tomorrow, Later with relative dates
- [ ] Month calendar loads on scroll
- [ ] Empty month cells show hover affordance
- [ ] Schedule click → detail → edit/delete/duplicate works
- [ ] Timetable summary at bottom opens full timetable
- [ ] `npm run typecheck` PASS
- [ ] `npm test` PASS
- [ ] `npm test -- k108` PASS
- [ ] `npm run build` PASS

## Verification

```powershell
npm run typecheck
npm test
npm run build
npm test -- k108
```
