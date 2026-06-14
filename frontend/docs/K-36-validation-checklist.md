# K-36 — Validation Checklist

**Branch:** `k36-cosmos-intelligence`

---

## Automated gates

- [x] `npm run typecheck` — 0 errors
- [x] `npm run build` — PASS
- [x] `npm run test` — 1794 / 1794
- [x] `cosmos/intelligence/*.test.ts` — 9 tests PASS

---

## Importance engine (Task A)

- [ ] High-backlink note classifies as Major or Core Hub
- [ ] Note with no links classifies as Isolated
- [ ] Area hub note classifies as Core Hub
- [ ] Score is stable across reloads (deterministic)

---

## Insights tab (Task D)

- [ ] Insights tab visible in Knowledge Context panel
- [ ] Importance section shows classification + score
- [ ] Galaxy and area labels appear for linked notes
- [ ] Suggested connections list navigates on click
- [ ] Opportunities show actionable copy
- [ ] Gaps section appears for weak galaxies

---

## Cosmos HUD (Task G)

- [ ] Analysis block shows core hubs, isolated, opportunities, weak areas
- [ ] Top 3 area health rows render
- [ ] Selected note shows importance tier label

---

## Search (Task H)

- [ ] Note search results show importance badge (Core Hub, Satellite, etc.)
- [ ] Subtitle shows area · galaxy · connection metadata when available

---

## Opportunities & suggestions (Tasks B, C)

- [ ] Orphan note appears in vault opportunities
- [ ] French Day 18/19 pair suggests each other (title + link signals)
- [ ] Uncategorized note triggers assign-area opportunity

---

## Area health & gaps (Tasks E, F)

- [ ] Multi-note galaxy shows health score 0–100
- [ ] High orphan ratio triggers isolated-cluster gap
- [ ] Galaxy without hub triggers missing-hub gap

---

## Regression

- [ ] Existing Cosmos graph rendering unchanged
- [ ] Links / Properties / Outline tabs still work
- [ ] Workspace search non-note results unchanged

---

## Sign-off

| Role | Date | Notes |
| ---- | ---- | ----- |
| Dev | 2026-06-13 | Automated gates PASS |
| QA | | Manual checklist above |
