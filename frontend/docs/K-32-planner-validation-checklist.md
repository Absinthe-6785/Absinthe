# K-32 — Planner Validation Checklist

**Branch:** `k32-planner-consolidation`

Run automated checks first:

```bash
cd frontend
npm run typecheck
npm run build
npm run test
```

---

## Day (CalendarShell Day mode + Timeline column)

- [ ] Add schedule from Day view
- [ ] Edit schedule from Day view
- [ ] Delete schedule from Day view
- [ ] Add schedule from Timeline column (+ button)
- [ ] Routine checkbox toggles
- [ ] Memo note create/edit
- [ ] D-Day add/edit/delete

---

## Week

- [ ] Period prev/next navigation
- [ ] Event rows render
- [ ] Today button jumps to current date

---

## Month

- [ ] Month grid navigation
- [ ] Date selection updates Timeline/Routines date

---

## Agenda

- [ ] Range label displays
- [ ] Empty range hint when no items
- [ ] Countdown / list items render

---

## Timetable

- [ ] Add first activity (empty CTA)
- [ ] Edit block (click grid block)
- [ ] Delete block (modal)
- [ ] Expand/collapse toggle

---

## Mobile

- [ ] CalendarShell visible without legacy mini-calendar
- [ ] Three tabs: Tasks | Memo | Timeline
- [ ] No `data-planner-legacy-mini-calendar` in DOM

---

## Localization

- [ ] **EN** — Calendar Today button, exception label, timetable empty hint
- [ ] **KO** — Same surfaces in Korean
- [ ] **JA** — Same surfaces in Japanese

---

## Sign-off

| Role | Date | Pass/Fail |
| ---- | ---- | --------- |
| Dev | | |
| QA | | |
