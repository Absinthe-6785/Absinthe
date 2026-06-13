# K-31 — Localization Reality Audit

**Branch:** `k31-product-stabilization`  
**Scope:** Task C — rendered UI (not translation files)

---

## Method

Walked live surfaces in Planner, Archive tab, Dashboard, Dialogs, Workspace, and NoteView chrome. Cross-checked against `i18n.ts` keys vs hardcoded JSX strings.

---

## Fixed in K-31

| Surface | Was | Now |
| ------- | --- | --- |
| Sidebar analytics tab | Analytics / 분석 | Archive / 아카이브 (via `t('analytics')` value update) |
| Day calendar header | `Day View`, `Today`, `Milestone` | `t('dayView')`, `t('plannerToday')`, `t('plannerMilestone')` |
| Week / Month / Agenda headers | English hardcoded | `t('weekView')`, `t('monthView')`, `t('agendaView')` |
| Calendar placeholder empty | English sentence | `t('calendarEmptyRange')` |

Schedule modals (`New Schedule`, `Save Schedule`) and `Weekly Timetable` already used `t('newSchedule')`, `t('saveSchedule')`, `t('weeklyTimetable')` — visible English only when app language is English (correct).

---

## Remaining Visible English (Korean default user)

| Area | Examples | Priority |
| ---- | -------- | -------- |
| NoteView right panel tabs | Outline, Links, Graph labels | P1 |
| NoteView TOC chrome | 목차 is Korean; H1/H2 badges OK | — |
| Workspace smart collections | Mixed EN section titles from knowledge module | P1 |
| Archive home | Period labels (`June 2026`), placeholder copy | P1 |
| Archive browse | “Period view is not available yet.” | P2 |
| Note list rows | `Untitled` default title | P2 |
| Planner legacy column | English tab labels on mobile bar | P2 |
| Settings / Health | Mostly i18n’d; spot-check on change | P3 |
| Dynamic projection strings | Calendar month titles from Luxon `en` locale | P2 |

---

## Language Setting Behavior

- Default language in store: **`en`** until user selects Korean/Japanese in Settings.
- Sidebar uses `getTranslator(appSettings.language)` — respects setting.
- Many NoteView strings use `useTranslation()` — same.
- **Gap:** Some archive projection labels bypass i18n layer entirely.

---

## Recommendations (next milestone)

1. Wire NoteView right-panel tab labels through i18n (K-30.37 backlog).
2. Pass `appSettings.language` into archive projection formatters.
3. Replace list-preview `Untitled` with `t('untitled')` (key exists in note utils).
4. Audit Planner mobile tab bar against calendar mode switcher labels.

---

## Success Criteria

| Criterion | Status |
| --------- | ------ |
| Obvious mislabels (Analytics → Archive) fixed | Met |
| Planner calendar mode headlines localized | Met |
| Audit doc captures remaining debt | Met |
