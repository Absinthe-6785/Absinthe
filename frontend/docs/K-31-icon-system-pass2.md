# K-31 — Icon System Pass 2

**Branch:** `k31-product-stabilization`  
**Scope:** P1 — pass 3 (document + minor cleanup)

---

## Hierarchy Rules

| Tier | Size | Stroke | Usage |
| ---- | ---- | ------ | ----- |
| Primary nav | 20px | 2.25 | Sidebar tabs (Note, Archive, Planner, …) |
| Section header | 16px | 2.25 | Archive card titles (Mark calendar) |
| Inline action | 11px | default | Properties/tags delete, add buttons |
| Utility footer | 20px | 2.25 | Settings, theme toggle, sign out |

**Pass 3 change:** Sidebar primary icons normalized from 2.5 → 2.25 to match Archive section headers.

---

## Semantic Map

| Surface | Icon | Semantics | Status |
| ------- | ---- | --------- | ------ |
| Sidebar Note | `BookOpen` | Reading/writing | OK |
| Sidebar Archive | `Archive` | Long-term record (was Analytics chart) | Fixed pass 1 |
| Sidebar Planner | `Calendar` | Scheduling | OK |
| Sidebar Health | `Dumbbell` | Fitness | OK |
| Sidebar Recipe | `BookMarked` | Reference collection | OK |
| Archive mark calendar | `CalendarDays` | Heatmap / daily marks | OK |
| Workspace pin | pin toggle | Saved context | OK |
| Graph | force layout nodes | Knowledge links | No lucide — OK |

---

## Misleading / Inconsistent (Deferred)

| Issue | Recommendation |
| ----- | -------------- |
| `BookOpen` vs `BookMarked` similarity | Keep — distinct tabs (Note vs Recipe) |
| Archive `CalendarDays` vs Planner `Calendar` | Acceptable — different contexts |
| Graph no sidebar entry | Graph lives in Note tab — document in onboarding |

---

## Decisions

1. **Stroke weight 2.25** is the product default for navigation and section headers.
2. **Archive uses `Archive`**, not chart/analytics glyphs.
3. **Small inline icons (11px)** inherit lucide default stroke — do not force 2.25 at pill scale.

---

## Success Criteria

| Criterion | Status |
| --------- | ------ |
| Hierarchy documented | Met |
| Sidebar stroke aligned | Met |
| Semantic audit | Met |
