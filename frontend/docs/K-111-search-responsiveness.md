# K-111 — Search Responsiveness & Cohesion

Elevate **Search** from a Notes-centric command palette into a **cross-domain workspace** spanning Notes, Planner, Health, Recipe, and Archive. Performance, projection, and UX only — no schema, storage, IndexedDB, knowledge-engine, or Cosmos changes.

## Before / After

| Area | Before (K-101) | After (K-111) |
|------|----------------|---------------|
| Scope | Notes, folders, tags, collections | **Notes + Planner + Health + Recipe + Archive** |
| Architecture | Inline `buildWorkspaceSearch` in palette | **`SearchProjection`** single-pass read model |
| Grouping | Result kind (note, tag, folder…) | **Domain** (Notes, Planner, Health, Recipe, Archive) |
| Recent | Flat recent selections | **Today / Earlier** + clear history |
| Cards | Title + subtitle | Icons, category labels, relative dates, highlights, stronger selection |
| Host | `NoteView` only | **`GlobalSearchHost`** in `AppContent` — any tab |
| Shortcut | Ctrl+Shift+F switched to Notes tab | Opens search **in place**, focuses input |
| Esc | Close only | **Clear query first**, then close |
| Performance | Full list render | Memoized projection + virtual list (≥50) |

## Grouping Matrix

| Domain | Sources | Navigation |
|--------|---------|------------|
| Notes | `buildWorkspaceSearch` | Note handlers (folder, tag, collection, path) |
| Planner | schedules, todos, routines, weekly schedules | Switch to Planner tab |
| Health | workouts, exercise blocks | Switch to Health tab |
| Recipe | `/api/recipes` (SWR when open) | Switch to Recipe tab |
| Archive | Deleted notes (`deletedAt`) | Switch to Analytics + note handler |

## SearchProjection Matrix

| Slice | Builder | UI |
|-------|---------|-----|
| `query` | input state | Search input |
| `results` | flat merged | Virtual list rows |
| `groupedResults` | domain groups | Collapsible sections |
| `counts` | per-domain totals | Footer count |
| `highlights` | `matchQueryRanges` | Card title marks |
| `recentSearches` | `loadSearchRecent` | Today / Earlier panel |

## Performance Matrix

| Concern | Approach |
|---------|----------|
| Projection | Single `buildSearchProjection` per query revision |
| Highlights / counts / groups | Built inside projection (memoized via `useSearchProjection`) |
| Large result sets | `@tanstack/react-virtual` when ≥50 rows |
| Recipes fetch | SWR only while search modal open |

## Keyboard Matrix

| Key | Behavior |
|-----|----------|
| Ctrl+Shift+F | Open search, focus + select input |
| Ctrl+K | Open search (Notes sidebar / keyboard) |
| Esc | Clear query if non-empty; otherwise close |
| ↑ / ↓ | Move selection |
| Enter | Open selected result |

## Mobile Matrix

| Width | Verified |
|-------|----------|
| 320 | Modal width, 44px touch targets |
| 375 | Input + cards |
| 768 | Same modal, scrollable results |

Hooks: `data-k111-search-modal`, `data-k111-search-input`, `data-k111-search-card`.

## UI-only storage

| Key | Purpose |
|-----|---------|
| `absinthe-search-recent-v2` | Cross-domain recent selections |
| `absinthe-search-sections` | Domain section collapse prefs |
| `absinthe-workspace-search-state` | Persisted query (session) |

## QA Checklist

- [ ] Ctrl+Shift+F opens search from Planner / Health / Recipe without tab switch
- [ ] Results grouped by domain with collapsible sections
- [ ] Cards show icon, category, relative date, highlight
- [ ] Recent searches: Today / Earlier; Clear history works
- [ ] Esc clears query then closes
- [ ] ↑↓ + Enter navigation
- [ ] Empty states: no query, no results, no recent
- [ ] Virtual list at 50+ results
- [ ] `npm run typecheck` / `npm test -- k111` / `npm run build` pass

## Audits

| File | Scope |
|------|-------|
| `k111SearchProjectionAudit.ts` | Single-pass projection |
| `k111SearchGroupingAudit.ts` | Domain sections + collapse |
| `k111SearchCardAudit.ts` | Result cards |
| `k111RecentSearchAudit.ts` | Recent + clear |
| `k111SearchPerformanceAudit.ts` | Memo + virtual |
| `k111KeyboardAudit.ts` | Shortcuts |
| `k111SearchEmptyStateAudit.ts` | ProductEmptyState |
| `k111SearchMobileAudit.ts` | 320 / 375 / 768 |
| `k111SearchLayoutAudit.ts` | Recent → results layout |

## Screenshots

> Before: Notes-only command palette in NoteView.
>
> After: Global search modal with Recent searches, domain-grouped results, improved cards.

_Add screenshots after manual QA._
