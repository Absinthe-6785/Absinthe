# K-73 Workflow Restoration

Branch: `k73-workflow-restoration`

## Goal

Restore proven daily workflows from pre-K-72 Health layout, redesign Protein Tracker around repeat logging, fix planner hierarchy issues, and audit workspace density — without new subsystems, storage changes, or AI features.

---

## Part 1 — Health Restoration Summary

**Reversed (K-72)**
- `WorkoutHistoryPanel` — low-value month session list removed
- `CompactWorkoutCalendar` — week-strip-only picker removed

**Restored (K-71 proven layout)**
- Bottom supporting row: **Calendar | InBody | Protein Tracker (compact)**
- Full month grid on desktop + horizontal day banner on mobile (`WorkoutMonthCalendar`)
- Workout dots on dates with logged sessions

**Unchanged (correct)**
- Tabs: Workout + Nutrition only
- Left: Workout Library + Routine Setup
- Right hero: Today's Workout
- Recovery data-only merge into workout memo

**Visual hierarchy**
| Surface | Tier |
|---------|------|
| Today's Workout | `WORKSPACE_CARD.hero` |
| Routine Setup / Library | `WORKSPACE_CARD.md` |
| Calendar | `WORKSPACE_CARD.md` |
| InBody / Protein compact | `WORKSPACE_CARD.sm` |

---

## Part 2 — Protein Tracker Redesign

**Workflow order (full mode)**
1. Daily progress — large `112 / 172g`, %, remaining
2. Quick Add — frequent/recent/seed foods, one-click log
3. Today's Timeline — chronological (`created_at`), most recent first
4. Manual add form (dropdown + custom)
5. Food Library (collapsible) — sources + goal profile

**Quick Add ranking** (`proteinQuickAdd.ts`)
- localStorage recent IDs
- Use-count frequency
- Seed names: protein shake, chicken breast, eggs, milk, tuna, greek yogurt

**Compact mode** (workout bottom row)
- Progress + horizontal Quick Add + recent timeline preview
- Link to full Nutrition tab

**Type fix**
- `ProteinIntakeLog.created_at` added for timeline sorting

---

## Part 3 — Planner Workflow Audit

### Day view
- Section order: schedules → events → countdowns → **tasks** → routines
- Routines de-emphasized when no schedules (`compactEmpty` on `DayRoutineSummary`)

### Week view
- Week grid + selected day details — **sufficient**; no structural change

### Month view
- Kept 50/50 split (grid | detail panel) — **recommended** over inline cell density
- Month right panel extended with:
  - Notes created (`DayMilestonesSection`)
  - Workout + protein summary (`SelectedDayHistoryExtras`)

---

## Part 4 — Schedule / Countdown / Timetable

| Item | Recommendation |
|------|----------------|
| Weekly timetable | **Keep removed** — no reinstatement |
| Countdowns | **Keep integrated** in `SelectedDayDetailPanel` |
| Agenda UI | **Keep removed** — projection code remains as low-priority debt |
| Agenda routes/state | No user-facing routes; verify only on cleanup pass |

---

## Part 5 — Workspace Consistency

- Health supporting row aligned to `sm`/`md` tiers per usage frequency
- Protein full mode uses `hero`; compact uses `sm`
- Schedule month shell retains `WORKSPACE_CARD.lg` reserved height

**Density fixes**
- Protein: removed fixed `320px` tab panes; timeline scroll capped at 200px
- Day view: routines no longer precede tasks

---

## Part 6 — UX Debt Reclassification (K-68–K-72)

| Priority | Item |
|----------|------|
| **Critical** | — (none blocking daily workflow after K-73) |
| **High** | Month cells still sparse for at-a-glance review — mitigated by history panel |
| **High** | Agenda projection dead code — bundle size / maintenance |
| **Medium** | Health not wrapped in `WorkspaceLayout` split (mobile tabs) |
| **Medium** | Exception modal no in-calendar trigger (K-71) |
| **Low** | K-72 workout history i18n keys unused |
| **Low** | Vault health strip hide heuristic edge cases |

---

## Files Modified

| File | Change |
|------|--------|
| `HealthView.tsx` | K-72 bottom row → calendar + InBody + protein compact |
| `WorkoutMonthCalendar.tsx` | **New** — full month calendar |
| `ProteinTracker.tsx` | Redesign: progress, quick add, timeline, library |
| `proteinQuickAdd.ts` | **New** — ranking + time format |
| `types/index.ts` | `created_at` on intake logs |
| `SelectedDayDetailPanel.tsx` | Month history + task/routine reorder |
| `DayMilestonesSection.tsx` | **New** |
| `SelectedDayHistoryExtras.tsx` | **New** |
| `DayRoutineSummary.tsx` | `compactEmpty` prop |
| `i18n.ts` | K-73 strings |
| `WorkoutHistoryPanel.tsx` | **Deleted** |
| `CompactWorkoutCalendar.tsx` | **Deleted** |

---

## Verification

```bash
cd frontend
npm run typecheck
npm run build
npm run test
```

### Manual QA checklist
- Workout: log, load routine, day note, date switch
- Nutrition: quick add, custom food, saved food, timeline
- Planner: day/week/month, date select, countdowns
- Archive: browse, timeline, areas

---

## Remaining UX Debt After K-73

1. Agenda projection code removal (when safe)
2. Month grid density vs readability tradeoff — monitor with history panel usage
3. `WorkspaceLayout` wrapper for Health desktop split
4. Protein pinned foods (explicit pin UI) — future if quick-add ranking insufficient
