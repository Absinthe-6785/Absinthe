# K-56 Dashboard Architecture

## Three dashboard surfaces

| Domain | Entry | Pattern |
|--------|-------|---------|
| **Knowledge** | `WorkspaceDashboardView` → `UnifiedWorkspaceDashboard` | Inline-style cards + `DashboardCardHeader` / `DashboardEmptyCard` |
| **Health** | `HealthDashboardPanel` | Tailwind `Theme` cards via `DashboardSection` |
| **Schedule** | `PlannerView` calendar modes (`day` / `agenda`) | `CalendarShell` — no shared card primitive |

## Shared primitives (K-56)

Location: `src/components/common/dashboard/`

| Component | Use case | Styling |
|-----------|----------|---------|
| `DashboardCardHeader` | Knowledge card titles (Lucide + label) | `NoteChromeColors` inline |
| `DashboardEmptyCard` | Knowledge empty states | Dashed border + CTA |
| `DashboardSectionTitle` | Knowledge section headings | Muted 10px label |
| `DashboardSection` | Health navigable section cards | Tailwind `Theme` |

### Consolidation changes

1. **`DashboardSectionTitle`** — moved from local function in `UnifiedWorkspaceDashboard.tsx` to shared module; knowledge dashboard now imports from `@/components/common/dashboard`.

2. **`DashboardSection`** — replaces inline `SectionLink` in `HealthDashboardPanel.tsx`; preserves `data-health-dashboard-section` attributes and `onClick` override behavior for workout/habit shortcuts.

3. **Re-exports** — `common/dashboard/index.ts` re-exports knowledge `DashboardCardHeader` and `DashboardEmptyCard` for a single import path.

## Knowledge dashboard cards

| Card | Uses shared header? | Uses empty card? |
|------|-------------------|------------------|
| `DiscoveryDashboardCard` | ✓ | ✓ |
| `TimelineDashboardCard` | ✓ | ✓ |
| `KnowledgeActivityCard` | ✓ | — |
| `KnowledgeEvolutionCard` | ✓ | — |

## Schedule dashboard

Planner "dashboard mode" = `calendarViewMode === 'day' || 'agenda'`. Uses calendar projection components, not card grid. Future K-57 could add `DashboardSection` for planner summary widgets if needed.

## Health dashboard sections

| Section | `sectionId` | Navigation |
|---------|-------------|------------|
| Nutrition | `nutrition` | `onNavigate('nutrition')` |
| Workout | `workout` | `onOpenWorkoutHistory` or `onNavigate('workout')` |
| Habits | `habits` | `onOpenRoutine` or `onNavigate('habits')` |
| Recovery | `recovery` | `onNavigate('recovery')` |
