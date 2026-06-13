# K-31 — Visual Identity Consistency Audit

**Branch:** `k31-product-stabilization`  
**Scope:** P1 — pass 3

---

## Cross-Surface Audit

| Dimension | Planner | Graph | Archive | Workspace | Dashboard |
| --------- | ------- | ----- | ------- | --------- | --------- |
| Card radius | absinthe tokens | inline | `rounded-[24px]` | mixed inline | dashboard cards |
| Section headers | i18n labels | status bar | `font-heading text-base font-bold` | chrome panels | dashboard sections |
| Icon stroke | 2–2.5 | SVG | 2.25 (pass 3) | lucide mixed | lucide mixed |
| Accent usage | primary schedules | node highlight | primary CTAs | accent borders | primary actions |
| Panel hierarchy | calendar shell | canvas + sidebar | card stack | 3-column note | grid |

---

## Pass 3 Low-Risk Fixes

| Change | Rationale |
| ------ | --------- |
| Sidebar icon `strokeWidth` 2.5 → 2.25 | Align with Archive section icon weight |
| Archive mark calendar icon `strokeWidth={2.25}` | Section header hierarchy |
| Archive shell `overflow-y-auto` | Scroll behavior parity with Note/Planner |

---

## Remaining Gaps

| Gap | Notes |
| --- | ----- |
| NoteView inline styles vs Tailwind Archive | Large refactor — out of scope |
| Planner dual nav columns | Legacy duplication |
| Graph vs Archive color tokens | Different background systems |
| Dashboard card padding vs Archive `p-5 lg:p-6` | Minor delta |

---

## Recommendations (Future)

1. Extract shared `SectionCard` class (`rounded-[24px] p-5 lg:p-6 shadow-sm`)
2. Tokenize note chrome colors toward CSS variables
3. Unify empty-state pattern (hint + primary link) app-wide

---

## Success Criteria

| Criterion | Status |
| --------- | ------ |
| Audit completed | Met |
| Low-risk consistency tweaks | Met |
| No redesign | Met |
