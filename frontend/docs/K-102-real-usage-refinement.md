# K-102 — Real Usage Refinement

Branch: `k102-real-usage-refinement` (not committed until review)

## Summary

Follow-up to K-101 focused on date correctness, trash UI, sidebar density, desktop layout balance, read mode polish, planner quality, and settings cleanup. No schema, storage, IndexedDB, knowledge-engine, or Cosmos changes.

## Workstreams

### A — Date & time correctness

**A1** Centralized `k102DateFormat.ts` with locale-aware `resolveIntlLocale`, relative labels (Today / Yesterday / N days ago / short date / full year), timezone-safe `YYYY-MM-DD` keys.

**A2** Wired into daily note, recent activity, note rows, planner agenda headers.

- Audit: `k102DateAudit.ts`

### B — Trash UI cleanup

Icon-only restore and permanent delete with tooltips; flex-wrap on trash header to prevent text overflow.

- Audit: `k102TrashAudit.ts`

### C — Sidebar density

- Recent activity defaults collapsed; shows Last Opened + Recent Edited only (3 items each)
- Timeline lens defaults collapsed; quarter/year/custom hidden when collapsed
- Note list width 228px desktop

### D — Desktop layout balancing

| Width | Notes | Planner | Settings |
|-------|-------|---------|----------|
| 320px | _TODO screenshot_ | _TODO_ | _TODO_ |
| 375px | _TODO_ | _TODO_ | _TODO_ |
| 768px | _TODO_ | _TODO_ | _TODO_ |
| 1024px | _TODO_ | _TODO_ | _TODO_ |
| 1440px | _TODO_ | _TODO_ | _TODO_ |

- Reading max-width 680px
- Planner upcoming panel min-height on desktop; right column max 340px

### E — Read mode polish

Stronger `.bshl` highlight, search toolbar spacing, existing Ctrl+F / Esc flows retained.

- Audit: `k102ReadModeAudit.ts`

### F — Planner quality

Detail panel button alignment, upcoming scroll min-height, relative agenda date headers.

- Audit: `k102PlannerAudit.ts`

### G — Settings cleanup

Tighter card padding, removed redundant section subtitles, max-width 3xl.

- Audit: `k102SettingsAudit.ts`

### H — Bug checklist

- [ ] Empty vault CTAs work
- [ ] Ctrl+Alt+T opens/creates daily note without duplicate
- [ ] Search query persists across tabs
- [ ] Esc closes workspace / document search
- [ ] Trash restore + permanent delete (icon buttons, no overflow)
- [ ] Planner edit / duplicate / delete from upcoming + detail
- [ ] Relative dates on note rows and agenda headers
- [ ] Responsive pass at 320 / 375 / 768 / 1024 / 1440

## Before / after

| Area | Before | After |
|------|--------|-------|
| Dates | Mixed `toLocaleDateString(undefined)` | Shared locale + relative labels |
| Trash actions | Full text buttons overflow | Icon buttons + tooltips |
| Activity sidebar | 5 groups expanded by default | Collapsed; 2 compact groups |
| Settings | Wide cards + redundant copy | Tighter layout, cleaner hierarchy |

## Verification

```bash
npm run typecheck   # PASS
npm test            # PASS (2465 passed)
npm run build       # PASS
npm test -- k102    # PASS (13 tests)
```
