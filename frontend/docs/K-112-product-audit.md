# K-112 — Product Audit & Simplification

After K-95–K-111 stabilization, a product-wide audit focused on **subtraction, cohesion, and consistency**. No schema, storage, IndexedDB, knowledge-engine, or Cosmos changes.

## Domain identities

| Domain | Role | Primary surface |
|--------|------|-----------------|
| Notes | Knowledge | Editor, sidebar, workspaces |
| Health | Body | Workouts, nutrition, blocks |
| Planner | Time | Calendar, agenda, timetable |
| Archive | History | Deleted, snapshots, timeline, restore |
| Recipe | Cookbook | Recipe Studio projection |
| Search | Navigation | Global cross-domain modal |
| Cosmos | Visualization | Graph mode inside Notes |
| Settings | Utility | General, storage, recovery, export |

## Disposition table

| Item | Disposition | Rationale |
|------|-------------|-----------|
| `WorkspaceSearchPalette.tsx` | **Remove** | Superseded by K-111 `GlobalSearchHost` |
| `common/SettingsView.tsx` | **Remove** | Dead legacy file |
| `workspaceSearchOpen` state | **Remove** | Unused after search lift |
| Dashboard “New note” | **Remove** | Sidebar + Ctrl+N canonical |
| Dashboard “Open search” | **Remove** | Sidebar + shortcuts canonical |
| Sidebar vault export/restore toolbar | **Remove** | Settings → Export/Recovery |
| Mobile More → Settings | **Remove** | Sidebar Settings tab |
| Editor More → Settings (mobile) | **Remove** | Sidebar Settings tab |
| Mobile More → Export all | **Remove** | Settings → Export |
| Archive collapsible empty hints | **Keep** (collapse) | Low-friction; CTA in section body |
| Sidebar dark mode quick toggle | **Keep** | Quick access; Settings has full theme |
| Ctrl+K search shortcut | **Keep** | Alias to global search |
| Ctrl+Shift+F search shortcut | **Keep** | Documented global shortcut |

## Keep / Collapse / Remove matrix

| Surface | Keep | Collapse | Remove |
|---------|------|----------|--------|
| Notes sidebar chrome | New note, search trigger, filters | Workspace dashboard | Duplicate dashboard actions |
| Search | Global modal, list filter, doc search | — | Legacy palette |
| Settings | 5 sections | Storage vs Recovery overlap (future) | Legacy SettingsView |
| Archive | All K-109 sections | Default collapsed prefs | — |
| Recipe | Recipe Studio IA | Ingredients/History default collapsed | — |
| Mobile More menus | Density, shortcuts, create event | — | Settings, vault export |

## Terminology normalization (K-112)

| Before | After |
|--------|-------|
| Recent history (Archive) | Recent activity |
| Time lens | Timeline lens |
| Search workspace | Search |
| Workspace search (Ctrl+K) | Search (Ctrl+Shift+F) in hints |

Domain-specific labels retained where meaningful: **Recently viewed**, **Recently cooked** (Recipe), **Restore tools** (Archive), **Collections** (per domain).

## Projection sanity

| Projection | Single-pass | Legacy removed |
|------------|-------------|----------------|
| HealthProjection | ✓ | — |
| PlannerProjection | ✓ | — |
| ArchiveProjection | ✓ | — |
| RecipeProjection | ✓ | — |
| SearchProjection | ✓ | WorkspaceSearchPalette |

## QA checklist

- [ ] New note: sidebar button + Ctrl+N only (no dashboard duplicate)
- [ ] Search: Ctrl+Shift+F and Ctrl+K open global search from any tab
- [ ] Settings: single entry via sidebar (not mobile More menus)
- [ ] Vault backup/restore: Settings only (not note-list toolbar)
- [ ] Archive section label reads “Recent activity”
- [ ] Timeline sidebar reads “Timeline lens”
- [ ] Search modal title reads “Search”
- [ ] No regression in note CRUD, planner, health, recipe, archive flows
- [ ] `npm run typecheck` / `npm test -- k112` / `npm run build` pass

## Audits

| File | Scope |
|------|-------|
| `k112SurfaceInventoryAudit.ts` | All visible surfaces |
| `k112ActionAudit.ts` | Duplicate actions removed |
| `k112SettingsAudit.ts` | Settings IA |
| `k112NavigationAudit.ts` | Tab roles |
| `k112EmptyStateAudit.ts` | ProductEmptyState coverage |
| `k112TerminologyAudit.ts` | Label normalization |
| `k112MobileAudit.ts` | 320 / 375 / 768 |
| `k112LayoutAudit.ts` | Density & zones |
| `k112ProjectionAudit.ts` | Single-pass projections |

## Screenshots

> Before: duplicate New note / search on dashboard; vault export icons in note toolbar; Settings in mobile More menus.
>
> After: streamlined chrome; canonical paths documented above.

_Add screenshots after manual QA._
