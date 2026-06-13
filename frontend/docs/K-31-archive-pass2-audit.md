# K-31 — Archive Recovery Pass 2 Audit

**Branch:** `k31-product-stabilization`  
**Scope:** P1 — pass 3  
**Prior score:** 5.5 / 10

---

## Pass 2 Baseline

- Archive home empty CTA → Notes tab
- Placeholder i18n for unavailable branch views
- Tab rename Analytics → Archive

---

## Pass 3 Improvements (Low-Risk)

| Section | Change |
| ------- | ------ |
| Recent milestones | Empty hint (`archiveMilestoneEmptyHint`) + CTA |
| Browse links | Empty hint + CTA |
| Mark calendar | Empty hint + CTA; click hint when marks exist (`archiveMarkCalendarClickHint`) |
| Area pills | Empty hint + CTA |
| Archive shell | `overflow-y-auto` for scroll parity with other tabs |

**Navigation depth unchanged:** Day click → trace; milestone/area → `openNote`; browse → `openArchiveBrowseDestination`.

---

## Discoverability

| Entry | Path |
| ----- | ---- |
| Mark day | Mark calendar cell → trace day view |
| Mark month | Month label button → month navigation |
| Milestone | Recent transitions → note |
| Area | Area pill → area note |
| Empty states | All major home sections → Notes CTA |

---

## Remaining Blockers

| Blocker | Priority |
| ------- | -------- |
| Period / Area / Timeline branch shells (placeholder only) | P0 next |
| Luxon locale for month labels | P2 |
| Archive nav tabs below fold on mobile | P2 |

---

## Score Impact

**Archive: 5.5 → 6.5** — actionable empty states on all home sections; mark calendar interaction hint.

---

## Success Criteria

| Criterion | Status |
| --------- | ------ |
| No redesign | Met |
| Improved empty-state actionability | Met |
| Direct note access preserved | Met |
| Audit doc | Met |
