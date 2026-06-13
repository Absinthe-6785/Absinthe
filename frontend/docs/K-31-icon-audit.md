# K-31 — Icon System Audit

**Branch:** `k31-product-stabilization`  
**Scope:** Task E — icon consistency (P1)

---

## Implemented in K-31

| Location | Before | After |
| -------- | ------ | ----- |
| Sidebar Archive tab | `BarChart2` (analytics metaphor) | `Archive` (domain-accurate) |

---

## Sidebar Icon Family

| Tab | Icon | Metaphor | Assessment |
| --- | ---- | -------- | ---------- |
| Note | `BookOpen` | Reading/writing | Good |
| Health | `Dumbbell` | Fitness | Good |
| Archive | `Archive` | Storage/review | Fixed in K-31 |
| Planner | `Calendar` | Scheduling | Good |
| Recipe | `BookMarked` | Reference | Good |
| Settings | `Settings` | Utility | Good |
| Theme | `Sun` / `Moon` | Mode | Good |

**Stroke weight:** All use `strokeWidth={2.5}` — consistent.

---

## Planner Icons

- Calendar mode switcher: text labels + minimal icons — OK.
- Weekly Timetable: `CalendarDays` — functional, not aligned with celestial motif (K-30.53).
- Timeline: clock/grid metaphors in legacy column — mixed Lucide sizes (14–22px).

---

## Archive Icons

- Mark calendar: `CalendarDays` — readable but generic.
- Browse links: chevrons + folder metaphors — OK.
- Missing compass/orbit identity from K-30.53 target palette.

---

## Dashboard / Workspace

- Workspace mode: `LayoutDashboard` in NoteView header.
- Smart collection groups: Star / Orbit / Compass (K-30.49) — best-aligned area.
- Trace lenses: mixed icons (`Sparkles`, `FolderKanban`) — P2 cleanup.

---

## Graph / Research / Study

- Local graph panel: `GitFork` — graph-adjacent but duplicates “network” metaphor.
- Full-screen `NoteGraphView`: minimal chrome icons.
- Research/Study dashboards: panel-specific Lucide picks without shared size grid.

---

## Hierarchy Recommendations

1. **Primary nav (sidebar):** 20px, stroke 2.5 — keep as canonical.
2. **Section headers:** 16px, stroke 2.
3. **Inline actions:** 14px, stroke 2.
4. **Decorative empty states:** 32px emoji OR 24px Lucide — pick one pattern.

---

## Visual Language Recommendations

- Adopt K-30.53 celestial trio (Star / Orbit / Compass) for knowledge navigation only.
- Keep domain literals (Calendar, Archive, Dumbbell) for top-level tabs — do not over-metaphor.
- Remove `BarChart2` from any user-facing Archive/knowledge surface.

---

## Remaining Issues

| Issue | Priority |
| ----- | -------- |
| Workspace trace icon alignment | P2 |
| Graph `GitFork` vs unified graph glyph | P2 |
| Planner legacy column icon sizes | P3 |
