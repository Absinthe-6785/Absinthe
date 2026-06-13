# K-31 — Locale Consistency Audit (Pass 5)

**Branch:** `k31-product-stabilization`  
**Scope:** Visible dates follow `appSettings.language` (P1)

---

## Findings (Before)

| Surface | Issue |
| ------- | ----- |
| Archive projection | `buildArchiveHomeProjection` accepted `locale` but hook never passed it |
| Browse static labels | Hardcoded Korean in `buildArchiveBrowseLinks` |
| Period refs | `formatTraceMonthHeading` used browser default via `toLocaleDateString(undefined)` |
| Database calendar/timeline | Month header used browser locale |
| Planner | Already uses `resolvePlannerLocale` ✓ |

---

## Fixes

| Area | Change |
| ---- | ------ |
| `i18n.ts` | `resolveIntlLocale(language)` → `ko-KR` / `ja-JP` / `en-US` |
| `useArchiveHomeProjection` | Passes `resolveIntlLocale(appSettings.language)` into projection |
| `buildArchiveBrowseLinks` | `resolveArchiveBrowseStaticLabels(locale)` + localized month refs |
| `formatCalendarMonthLabel` | Optional `locale` parameter |
| `formatTraceMonthHeading` | Forwards locale |
| `DatabaseCalendarView` / `DatabaseTimelineView` | Month label uses app locale |

---

## Still Browser-Dependent

- Archive frame title/subtitle strings (projection literals, not dates)
- Graph footer counter strings
- Database weekday row (`Sun`–`Sat`) in calendar grid

---

## Tests

- Existing Korean-default browse tests unchanged (default app language `ko`)
- `archiveBrowseLabels` derived from i18n keys (`nvCustomRange`, `archiveBrowseAllAreas`, `archiveViewTimeline`)

---

## Status

**Done** — Archive month/period labels and database month headers respect app language.
