# K-48 Schedule Layout Review

## Problem

Day view felt like a prototype: large card padding, empty sections hidden, duplicate 1920px timeline below the calendar shell, and a full Memo column duplicating Notes.

## View decisions

### Day — **primary workspace**

- **Keep** as default calendar mode.
- **Merge** schedule CRUD into `DayScheduleTimeline` + existing schedule modal (no second timeline).
- **Always show** section shells: Events, Schedule, Weekly template, Routines, Tasks — with compact empty states.
- **Reduce** card padding (`p-3 lg:p-4`, tighter gaps).
- **Side panel**: D-Day, Routines, Tasks (unchanged CRUD).

### Week — **orientation + time grid**

- **Keep** seven-column layout.
- **Show** legacy 48-slot timeline for proportional editing (schedules sparse in week context).
- Empty hint i18n-only; grid stays visible.

### Month — **anchor + density**

- **Keep** 42-cell grid; primary navigation into Day via date select.
- **Show** legacy timeline when month mode active (schedule block editing).
- Mark dots (`markedDates`) deferred — data still available from API.

### Agenda — **upcoming lens**

- **Keep** as rolling horizon list (countdowns, events, blocks, todos).
- **Hide** duplicate timeline; agenda is read-focused in shell.
- Interactive schedule edits via Day view or week/month timeline.

## Removed / simplified

| Before | After |
|--------|-------|
| CalendarShell Day + 1920px timeline + Memo column | Shell Day + tasks panel |
| 3 mobile tabs (Timeline, Tasks, Memo) | 2 tabs; timeline tab hidden in Day/Agenda |
| Hidden empty sections | Visible section headers + "None" |
| Hardcoded English empty copy | `schedule*EmptyHint` i18n keys |

## Information density principles (K-48)

1. One schedule surface per mode — no duplicate representations.
2. Section headers always visible in Day view for scannability.
3. CRUD stays where users already learned it (routines/tasks columns, schedule modal).
4. Notes live in Note tab exclusively.

## Future (K-49+)

- Wire routine/todo toggle into Day view rows (read-only summaries today).
- Collapse D-Day into note-backed countdowns only.
- Month mark dots from `markedDates` projection.
