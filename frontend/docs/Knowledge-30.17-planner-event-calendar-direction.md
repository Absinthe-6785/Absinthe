# Knowledge-30.17 — Planner, Event System, and Calendar Direction

## Scope

Architecture and product direction only. **No implementation, no tab rename, no new routes, no UI redesign.**

Builds on K-30.0–K-30.16. Archive Home is live (K-30.16). Analytics tab now surfaces Archive; legacy Analytics widgets remain in code but are hidden. Planner is the least-defined major surface and the natural home for operational widgets redistributed from Analytics.

**Success questions this document answers:**

1. *What should Planner become after Archive exists?*
2. *If a user opens Absinthe every day for five years, what should be the first thing they see?*

---

## Executive Summary

**Planner should become the forward execution surface** — the place to plan and do today and this week — not a second Note tab, not a history view, and not a productivity dashboard.

**Recommended target identity:**

| Surface | Question | Time horizon |
| ------- | -------- | ------------ |
| **Note** | What am I capturing and exploring? | Now → months (trace) |
| **Planner** | What am I doing next, and when? | Today → weeks (execution) |
| **Archive** | What remains when I look back? | Months → years (history) |
| **Health** | How am I logging the body today? | Today (domain ops) |

**Primary architectural recommendation:**

1. **Remove Memo from Planner** — it duplicates Note and splits folder UX.
2. **Make Calendar the Planner landing page** — Month / Week / Day / Agenda modes inside the existing Planner tab.
3. **Unify dated anchors around Knowledge Events** — merge D-Day into Events over time; keep hourly Schedule blocks as a complementary primitive.
4. **Keep Routines and daily Todos** as lightweight execution checklists in Planner.
5. **Absorb legacy Analytics operational widgets** (Weekly Timetable, today’s schedule/routine panels) into Planner during redistribution — not into Archive.
6. **Keep Note-first default landing** — daily opens should start in capture/trace, not planning or history.

---

## Planner Audit

### Current inventory

Source: `PlannerView.tsx` (~908 lines, monolithic). No `features/planner/` module yet.

| # | Section | Location | Data source | Mobile tab |
| - | ------- | -------- | ----------- | ---------- |
| 1 | **Routines** | Col 1 | `GET /api/routines_with_logs?date=` | Planner |
| 2 | **Tasks (Todos)** | Col 1 | `GET /api/todos?date=` | Planner |
| 3 | **D-Day** | Col 2 | `GET /api/schedules/ddays` (`is_dday: true`) | (under Memo col) |
| 4 | **Memo** | Col 2 | `useNotesStore` + `/api/notes` | Memo |
| 5 | **Calendar** | Col 3 | `GET /api/schedules/dates` → `markedDates` | Calendar |
| 6 | **Timeline** | Col 3 | `GET /api/schedules?date=` (30-min grid) | Timeline |

**Overlays:** Schedule modal, D-Day modal, routine exception modal, confirm dialogs — all inline.

**Pending redistribution from legacy Analytics** (hidden since K-30.16, still in `AnalyticsView.tsx`):

| Widget | Verdict for Planner |
| ------ | ------------------- |
| Weekly Timetable + CRUD | **MOVE → Planner** |
| Today’s Schedule (daily detail) | **MERGE → Planner Day view** |
| Today’s Routine Marks | **MERGE → Planner Day view** (already exists as Routines) |
| Workout week toggles | **REMOVE from Planner** — belongs in Health |
| Activity / heatmap summaries | **REMOVE** — Archive owns mark visualization |

---

### Section classification

| Section | Verdict | Rationale | Overlap |
| ------- | ------- | --------- | ------- |
| **Routines** | **KEEP** | Daily habit execution is core Planner value; feeds Archive mark density via `routine_logs` | Health has separate `health_routines` (workout templates) — rename collision only |
| **Tasks (Todos)** | **REWORK** | Useful for lightweight daily checklist; parallel to Knowledge task note templates with no sync | Note task templates use properties (`dueDate`, `status`) — potential future merge |
| **D-Day** | **MERGE** | Countdown dates are dated anchors — same conceptual job as Knowledge Events | Archive reads passed D-Days as history; Events already archive via note mark index |
| **Memo** | **REMOVE** | Full note CRUD embedded in Planner; shares store with NoteView but different folder UX | Note owns capture; Memo is legacy duplication (K-30.0 flagged this) |
| **Calendar (month picker)** | **REWORK** | Becomes Planner landing — not just a date picker for other widgets | Health also has month calendar (`calendarUtils.ts`) — share grid primitive, not merge surfaces |
| **Timeline (hour grid)** | **REWORK** | Survives as **Day** mode inside Calendar — not a separate top-level concept | Distinct from Note trace lenses and Knowledge DB timeline view |
| **Weekly Timetable** (Analytics legacy) | **MOVE → KEEP** | Recurring weekly plan template — forward planning, not Archive | Currently Analytics-only via `weeklySchedules` prop |

---

### Verdict summary

```
KEEP     → Routines
REWORK   → Tasks, Calendar, Timeline (as Calendar modes)
MERGE    → D-Day → Events (long-term)
REMOVE   → Memo
MOVE IN  → Weekly Timetable, today-schedule panels (from legacy Analytics)
```

---

### What Planner should **not** become

| Anti-pattern | Why |
| ------------ | --- |
| Second Note tab | Capture, linking, areas, trace lenses belong in Note |
| Archive duplicate | History, mark calendar, milestones — Archive owns these |
| Performance dashboard | Streaks, completion %, rankings — retired K-30.3 |
| Home dashboard | Violates trace philosophy; adds aggregation without purpose |
| Unified “life OS” | Recipe, Health, Note stay domain-specific |

---

## Event Architecture

### Two parallel time systems today

Absinthe currently maintains **two unconnected time models**:

| System | Storage | Examples | UI |
| ------ | ------- | -------- | -- |
| **Knowledge (Notes)** | `notes.properties` | Events, Milestones, Areas | NoteView, Archive projections |
| **Planner (Supabase)** | `schedules`, `todos`, `routines`, `routine_logs` | Timeline blocks, D-Days, daily todos, habit marks | PlannerView, Health (workouts) |

There is **no foreign key, sync, or bridging layer** between them.

### Knowledge Event model (existing)

Property keys in `dailyTraceModels.ts`:

```
type = 'event'
eventDate        (required, YYYY-MM-DD)
eventTime        (optional)
eventEndDate     (optional range)
eventEndTime     (optional)
```

Logic: `eventNotes.ts`, UI: `EventNoteDialog.tsx`, projections: `buildDailyTraceProjection.ts`, Archive mark index: `buildNoteMarkIndex.ts` (multi-day ranges).

**Milestones** are a sibling overlay on the same note entity (`milestoneDate`, `milestoneLabel`, `milestoneKind`) — not mutually exclusive with Events in code.

### Planner Schedule / D-Day model (existing)

```
Schedule { id, text, start_time, end_time, is_dday, color, category, date }
DDay     → Schedule row with is_dday=true, dummy 00:00 times
Todo     → { id, text, done } scoped to date
Routine  → { id, text, done, is_active } + per-day routine_logs
```

Timeline renders Schedules on a 48-slot half-hour grid. D-Days are a filtered schedule list with client-side D-N countdown.

---

### Comparison: current vs future primitives

| Role | Current | Future (recommended) |
| ---- | ------- | -------------------- |
| **Significant dated anchor** (exam, travel, deadline, phase start) | D-Day (Planner) **and** Event (Note) — duplicated | **Event (Note-backed)** — single source |
| **Transition / phase boundary** | Milestone (Note) | **Milestone (Note)** — unchanged |
| **Time-boxed planned activity** (Study 9–11, Meeting 2–3) | Schedule / Timeline block | **Schedule block** — keep; optional link to Event note |
| **Recurring weekly template** | WeeklySchedule (Analytics legacy) | **Weekly template in Planner** |
| **Daily habit execution** | Routine + routine_logs | **Routine** — keep |
| **Daily task checklist** | Todo (date-scoped API) | **Todo** short-term; optional promotion to note task |
| **Countdown presentation** | D-Day UI | **Event with countdown display** in Planner Agenda |

---

### Should Events become the central planning primitive?

**Partially yes — for dated anchors. No — for hour-level planning.**

| Primitive | Central? | Reason |
| --------- | -------- | ------ |
| **Events** | **Yes — for “what happens when”** | Cross-surface visibility (Note capture → Planner calendar → Archive history); already supports ranges; archive-worthy |
| **Milestones** | **Yes — for “what changed”** | Remains Note-only; surfaced in Archive Home |
| **Schedules (Timeline blocks)** | **Yes — for “how time is allocated today”** | Hour grid is operational; Events do not replace time-boxing |
| **Routines** | **Yes — for “daily execution habits”** | Checkbox completion is a different interaction than calendar anchors |
| **Todos** | **Secondary** | Keep until note-task integration is designed; not central |

**Cleanest architecture:**

```
Knowledge layer (Note properties)
  Events      ──► Planner Calendar (Agenda / Month markers)
  Milestones  ──► Archive (Recent Transitions)
  Areas       ──► Archive (Concerns) + Note lenses

Operational layer (Supabase)
  Schedules   ──► Planner Day timeline (hour grid)
  Routines    ──► Planner Day checklist + Archive mark density
  Todos       ──► Planner Day checklist
  Weekly tmpl ──► Planner Week template
```

**D-Day migration path:** Treat D-Day rows as legacy Event equivalents. New significant dates should be created as Note Events. Planner countdown widget reads from Events projection (with optional legacy D-Day read during transition). Archive already prefers note-derived milestones; D-Day history can remain in heatmap via schedules table until migrated.

**Three “Timeline” concepts — disambiguation:**

| Name | Location | Fate |
| ---- | -------- | ---- |
| Planner Timeline | Hour grid in PlannerView | **Rename → Day view** inside Calendar |
| Note Trace lenses | Daily / range trace in NoteView | **Keep in Note** — exploration, not planning |
| Knowledge DB Timeline | Gantt over arbitrary date properties | **Keep in Note workspace** — database presentation |

Do not collapse these into one UI. Align naming in docs and navigation labels only.

---

## Calendar Evaluation

### Problem

Planner’s “Calendar” is currently a **month date picker** that drives Routines, Tasks, and Timeline. It is not a planning surface — it selects `selectedDate` for other widgets.

Health also embeds a month calendar (`buildCalendarDays()` shared utility) with different affordances (no mark dots).

### Recommendation: Calendar inside Planner, as landing page

**Do not add a new top-level tab** (constraint). Evolve the existing Planner tab.

**Proposed Planner structure:**

```
Planner (tab unchanged)
├── Calendar (default landing)
│   ├── Month   — marks, events, D-Day/legacy countdown badges
│   ├── Week    — schedule blocks + events + routines summary
│   ├── Day     — current Timeline hour grid + routines + todos
│   └── Agenda  — chronological list (events + timed blocks + todos)
├── Routines    — management view (optional; may live in Day sidebar)
└── Settings    — weekly template, default category/color (from SettingsView defaults)
```

### Should Timeline survive?

**Yes — as Day mode**, not as a peer tab name.

| Mode | Purpose | Replaces |
| ---- | ------- | -------- |
| **Day** | Hour-level execution (current Timeline) | Timeline mobile tab |
| **Agenda** | Scan what’s coming (events + blocks + todos) | Partial D-Day list |
| **Week** | See allocation across days | Nothing today — new composition |
| **Month** | Orient in time; jump to day | Current Calendar picker |

The hourly grid answers *“What slot am I in right now?”* Agenda answers *“What’s on my plate?”* Both are needed; neither belongs in Archive or Note default views.

### Use case coverage

| Use case | Best mode | Primary primitive |
| -------- | --------- | ----------------- |
| Meetings | Agenda / Day | Event (note) or Schedule block |
| Exams / deadlines | Month / Agenda | Event (note) — replaces D-Day |
| Travel | Month / Agenda | Event with date range |
| Study plans | Week / Day | Schedule blocks + optional Event link |
| Personal events | Agenda | Event (note) |
| Daily habits | Day | Routines |
| Quick tasks | Day | Todos |

### Calendar vs Archive mark calendar

| | Planner Calendar | Archive Mark Calendar |
| - | ---------------- | --------------------- |
| Intent | Plan and execute forward | Observe marks looking back |
| Interaction | Edit schedules, check routines | Read-only density |
| Horizon | Days → weeks | Years |
| Data | Schedules, todos, routines, events | Domain marks + note activity |

Same visual language (card chrome, calendar grids) is fine; **different projections and mutations**.

---

## Landing Surface Evaluation

### Current default

| Behavior | Value |
| -------- | ----- |
| `activeTab` initial state | `'note'` (K-26) |
| Sidebar first tab | Note (K-30.1) |
| Analytics tab content | Archive Home (K-30.16) |

### Options analyzed

#### A — Note-first (current) ✓ Recommended

**First screen:** Note → All Notes / last workspace / capture-ready editor.

| Strengths | Weaknesses |
| --------- | ---------- |
| Aligns with Record → Trace → History lifecycle | Users who open only for planning must switch tabs |
| Matches K-26, K-28, K-29 investment | Planner discovery is lower |
| Capture-first identity (“what matters now”) | |
| Archive handles return visits without competing for default | |

**Five-year daily open:** User continues paths, writes, links — the product’s core loop.

#### B — Planner-first

**First screen:** Calendar Day or Agenda.

| Strengths | Weaknesses |
| --------- | ---------- |
| Strong for schedule-heavy users | Reverts to productivity-app identity (K-30.0 problem) |
| Surfaces time immediately | Demotes capture and trace — the differentiated philosophy |
| | Conflicts with K-30.1 navigation realignment |

**Verdict:** Reject as default. Offer **optional** “open Planner on launch” in Settings later if demand exists — not a philosophy change.

#### C — Calendar-first

Same as B with broader month framing. Same rejection rationale — scheduling is not the product’s primary question.

#### D — Home Dashboard

Aggregated widgets: today’s tasks, marks, upcoming events, streaks.

| Strengths | Weaknesses |
| --------- | ---------- |
| Familiar pattern from productivity apps | Violates K-28 anti-goals if it includes scores/streaks |
| Single glance | Duplicates Archive + Planner + Note without depth |
| | Creates a third “summary” layer to maintain |
| | Dashboard for dashboard’s sake — no clear improvement to trace philosophy |

**Verdict:** Reject. Archive Home already serves as the **non-dashboard** historical orientation layer. Note serves active work. Planner serves forward execution. A dashboard adds aggregation without answering a distinct question.

---

### Answer: five-year daily open

> **Note** — the place to continue capture, linking, and trace exploration.

Rationale:

- **Day 1–30:** Capture habits form in Note.
- **Month 1–12:** Trace lenses and Areas become valuable in Note.
- **Year 1–5:** Archive grows as the return layer; Planner is visited intentionally for scheduling sessions; Health for workout days.

The first screen should answer: *“What am I working on?”* not *“How am I performing?”* (Analytics legacy) or *“What’s on my calendar?”* (Planner).

**Secondary entry:** Users who live in Planner can pin or remember tab order — but the **product default** stays Note-first.

---

## Localization Strategy

### Current state

| Area | Behavior | Issue |
| ---- | -------- | ----- |
| **Sidebar / Planner chrome** | `useTranslation()` → en/ko/ja via `i18n.ts` | Good for static strings |
| **Archive period labels** | `formatTraceMonthHeading` → `formatCalendarMonthLabel` uses `toLocaleDateString(undefined, …)` | Uses **browser locale**, not `appSettings.language` |
| **Archive hook** | `buildArchiveHomeProjection` accepts `locale?` but `useArchiveHomeProjection` does not pass it | Inconsistent: tests show English; runtime may show Japanese if browser is ja |
| **Browse links** | `buildArchiveBrowseLinks` uses English literals: `'Custom'`, `'All areas'`, `'Timeline'` | Not i18n-keyed |
| **Quarter labels** | Hard-coded `Q1`–`Q4` in trace/archive helpers | Acceptable globally; Korean may prefer different convention |
| **D-Day labels** | `D-3`, `D-Day`, `D+2` — English convention in Planner | Culturally familiar in ko/ja contexts |
| **Planner dates** | Mixed Luxon/`formatDate` from AppContent | No centralized locale-aware date formatter |

Observed in K-30.16 tests: browse label `2026年6月` when browser locale is Japanese — projection layer is locale-sensitive but **not app-settings-aware**.

---

### Recommended formatting strategy

**Principle:** One locale resolver per surface render:

```typescript
resolveAppLocale(appSettings.language) → 'en' | 'ko' | 'ja' | …
```

Pass `locale` into all projection builders and formatters. Do not rely on `undefined` (browser default) in product surfaces.

| Surface | Static copy | Dates / periods | Times |
| ------- | ----------- | --------------- | ----- |
| **Archive** | i18n keys for frame, section titles, browse labels (`Custom`, `All areas`, `Timeline`) | `formatArchivePeriodLabel(ref, locale)` wrapping existing trace formatters | N/A on Home |
| **Note / Trace** | Existing i18n | Extend trace formatters to accept locale param | `HH:mm` localized via `Intl` or fixed 24h per locale preference |
| **Planner / Calendar** | Existing Planner i18n keys | Month/weekday headers via locale; `selectedDate` display | Schedule `start_time` / `end_time` — keep 24h or respect locale setting |
| **Events** | Dialog copy via i18n | Event date display uses same formatter as Trace | Optional time suffix |

**English-first defaults:** `appSettings.language` defaults to `'en'`; all formatters fall back to English when key missing.

**Korean / Japanese:** Full UI strings already exist in `i18n.ts` for Planner chrome. Gap is **dynamic date/period strings** in Archive and Calendar — fix in projection layer, not in components.

**Quarter / period naming:**

| Locale | Month | Quarter | Year |
| ------ | ----- | ------- | ---- |
| en | June 2026 | Q2 2026 | 2026 |
| ko | 2026년 6월 | 2026년 2분기 (or Q2 2026) | 2026년 |
| ja | 2026年6月 | 2026年Q2 (or 第2四半期) | 2026年 |

Recommend shared module: `formatPeriodLabel(kind, y, m?, q?, locale)` used by Note trace, Archive, and Planner calendar headers.

**Do not block K-30.17 redistribution on i18n** — but wire locale through projections before Calendar landing ships.

---

## Recommended Direction

### Planner identity (target)

> **Planner answers: *What am I doing next — and when?***

Planner is the **forward execution surface** inside a trace-oriented product:

- **Calendar-first within the tab** (Month / Week / Day / Agenda)
- **Routines + Todos** on Day view
- **Schedule blocks** for hour-level allocation
- **Events** (note-backed) for dated anchors — replacing D-Day over time
- **Weekly template** absorbed from legacy Analytics
- **No Memo** — link to Note instead

### Primitive ownership (target)

| Primitive | Owner | Surfaces |
| --------- | ----- | -------- |
| Capture, link, explore | Note | NoteView |
| Event, Milestone, Area | Note properties | Note, Archive projections, Planner Agenda |
| Hour schedule, weekly template | Supabase schedules | Planner Day/Week |
| Daily habits | Supabase routines | Planner Day, Archive marks |
| Daily tasks | Supabase todos (short-term) | Planner Day |
| Body logging | Supabase workouts | Health |
| Historical marks | Projections | Archive |

### What Planner becomes (one sentence)

**A calendar-centered execution tab** for planning and doing today and this week — absorbing operational widgets from retired Analytics, shedding Memo duplication, and converging dated anchors on Knowledge Events.

---

## Migration Path

Phased — aligns with K-30.9 sequence after K-30.16.

| Phase | Milestone | Deliverable |
| ----- | --------- | ----------- |
| **0** | K-30.17 (this doc) | Direction locked; no code |
| **1** | K-30.18 | Absorb Weekly Timetable + today panels from legacy Analytics into Planner |
| **2** | K-30.19 | Remove Memo from Planner; add “Open in Note” affordances where needed |
| **3** | K-30.20 | Calendar landing in Planner — Month + Day (current Timeline) |
| **4** | K-30.21 | Week + Agenda modes; Event projection feed into Calendar |
| **5** | K-30.22 | D-Day → Event migration (read legacy, write new as Events) |
| **6** | K-30.23+ | Optional todo ↔ note-task bridge; locale formatter unification |
| **Parallel** | K-30.21 (tab rename) | Analytics → Archive sidebar label when IA stable |

**Principles:**

1. **Projection before UI** — e.g. `buildPlannerCalendarProjection(notes, schedules, todos, routines, date, locale)` before new Calendar components.
2. **Extract Planner module** — follow Archive pattern (`features/planner/`), reduce `PlannerView.tsx` monolith.
3. **No Archive leakage** — operational widgets never return to Analytics/Archive tab.
4. **Rollback** — feature flags per phase where user-visible behavior changes.

---

## Risks

| Risk | Severity | Mitigation |
| ---- | -------- | ---------- |
| **Dual time systems persist too long** | High | Explicit D-Day → Event migration phase; document which API to use for new data |
| **Memo removal disrupts users** | Medium | Detect Memo tab usage; migration message pointing to Note; shared store means no data loss |
| **Planner scope creep** | Medium | Reject dashboard; keep Health and Note boundaries |
| **Event/Schedule confusion** | Medium | Clear UX labels: “Event” (anchor) vs “Block” (allocated time) |
| **Locale inconsistency** | Medium | Pass `appSettings.language` into projections before Calendar ships |
| **Monolith extraction regression** | Medium | Incremental extraction with tests per widget (Archive model) |
| **Legacy Analytics hook cost** | Low | Guard SWR fetches behind `ARCHIVE_SHELL_ENABLED` when removing legacy body |
| **Weekly Timetable duplication** | Low | Verify Planner doesn’t already partially implement before move |
| **Routine naming collision** | Low | Document Planner Routines vs Health Routine Setup in UI copy |

---

## Relationship to Prior Milestones

| Milestone | Relationship |
| --------- | -------------- |
| K-30.5 | Archive vs Planner domain rules — Planner keeps forward planning |
| K-30.9 | Widget redistribution map — K-30.17+ execution target |
| K-30.16 | Archive Home live — Planner is now the undefined surface |
| K-30.1 / K-26 | Note-first default — reaffirmed |
| K-28 / K-29 | Events, Milestones, Areas stay Note-backed — Planner consumes projections |

---

## Decision Record

| Question | Decision |
| -------- | -------- |
| What should Planner become? | Calendar-centered **forward execution** tab |
| What stays? | Routines, Todos, Schedule blocks, Weekly template |
| What moves? | Analytics operational widgets → Planner |
| What merges? | D-Day → Events (long-term) |
| What goes? | Memo (from Planner) |
| Events as central primitive? | **Yes for dated anchors**; no for hour grid |
| Calendar surface? | **Inside Planner, as landing** — Month/Week/Day/Agenda |
| Timeline name? | **Survives as Day mode** |
| Default first screen (5-year user)? | **Note-first** |
| Dashboard? | **Rejected** |

---

*K-30.17 — architecture and product direction only. Implementation begins at widget redistribution (K-30.18).*
