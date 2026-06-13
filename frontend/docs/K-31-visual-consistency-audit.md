# K-31 — Visual Consistency Pass Audit

**Branch:** `k31-product-stabilization`  
**Scope:** P1 — unify feel without redesign

---

## Observations

| Surface | Card radius | Section headers | Icons |
| ------- | ----------- | --------------- | ----- |
| Sidebar | absinthe-2xl | 9px labels | Lucide 20px — consistent |
| Archive home | 24–32px | font-heading bold | CalendarDays 16px |
| Planner calendar | 24–32px | font-heading bold | Mixed 14–22px |
| NoteView | inline px | custom | GitFork, mixed |
| Workspace | 16–24px | mixed EN/ko | Star/Orbit/Compass |

---

## Pass 2 Improvements

| Change | Effect |
| ------ | ------ |
| Archive placeholder uses same i18n/header pattern as home | Less “broken branch” feel |
| Archive empty CTA styled as primary text link | Consistent with app accent |
| Graph active stroke weight | Clearer selection hierarchy |
| Sidebar Archive icon (pass 1) | IA/visual alignment |

---

## Not Changed (out of scope)

- NoteView → Tailwind migration
- Planner legacy column layout
- Workspace panel full icon audit

---

## Coherence Score

**6/10 → 6.5/10** — Archive and graph slightly more aligned; NoteView dialect unchanged.

---

## Quick Wins Remaining

1. NoteView right panel tab icons → uniform 12px stroke
2. Archive section headers → shared `text-base font-bold` (already mostly aligned)
3. Planner legacy column icon size cap at 18px

---

## Success Criteria

| Criterion | Status |
| --------- | ------ |
| Document pass without redesign | Met |
| Low-risk visual tweaks | Met |
