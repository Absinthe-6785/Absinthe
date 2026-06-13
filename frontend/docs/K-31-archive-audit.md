# K-31 — Archive Review

**Branch:** `k31-product-stabilization`  
**Scope:** Task H — usefulness & discoverability (P1)

---

## Summary

Archive **looks complete** (heatmap, milestones, browse links, area pills) but remains **functionally sparse** compared to Notes/Planner. K-30.16–30.19 replaced legacy Analytics widgets with `ArchiveShell`; identity is clearer after K-31 sidebar rename (Analytics → Archive).

---

## Usefulness

| Section | Value | Interaction |
| ------- | ----- | ----------- |
| Mark calendar | Visual history | Day/month cells largely **non-navigating** |
| Recent milestones | Good recap | Opens notes via `openNote` |
| Area pills | Subject grouping | Opens notes; limited filtering |
| Browse links | Period shortcuts | Rendered; **home wiring incomplete** for some targets |
| Heatmap | At-a-glance density | Weakest interactivity (K-30.34) |

---

## Discoverability

- Tab label was **“Analytics”** until K-31 — mismatched user mental model. Fixed: **Archive / 아카이브**.
- Opening a note from Archive **does not switch to Notes tab** (K-30.33) — users may not see navigation happen.
- No deep link from calendar cell → filtered note list.
- Period drill-down placeholders: “Period view is not available yet.”

---

## Navigation

```
Sidebar Archive tab
  → ArchiveShell
    → Home (default)
    → Browse / Period (partial)
    → openNote → NoteView? (same tab — confusing)
```

**Gap:** Archive feels like a dashboard, not a browsing hub.

---

## Empty States

- Global empty competes with partially-filled sections.
- Milestones/areas lack “create milestone” CTA on empty.
- Browse empty is a dead-end without fallback actions.
- K-30.53 improved copy; CTAs still thin.

---

## User Value Assessment

| Persona | Value today |
| ------- | ----------- |
| Daily reviewer | Medium — milestones + heatmap glance |
| Deep researcher | Low — no bibliography surfacing here |
| Planner user | Low — archive disconnected from calendar |
| New user | Low — pretty but unclear next step |

---

## Quick Wins (stabilization-safe)

1. ✅ Sidebar label/icon alignment (K-31).
2. Switch to Notes tab when opening a note from Archive (small routing fix — candidate next PR).
3. Wire browse link clicks to trace lenses or filtered collections.
4. Single CTA on empty home: “Go to Notes” / “Mark a milestone”.

---

## Score

**4/10** user value vs **7/10** visual completeness — the core product tension.

---

## Recommended Next Milestone

Chronological drill-down (K-31.0 roadmap): month → week → day → notes list, with deep links from heatmap cells.
