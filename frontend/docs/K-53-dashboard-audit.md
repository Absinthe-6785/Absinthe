# K-53 Dashboard Audit

## Knowledge Dashboard

| Card | Header | Empty state |
|------|--------|-------------|
| Timeline | `DashboardCardHeader` + History | `DashboardEmptyCard` with Open Timeline CTA |
| Discovery | `DashboardCardHeader` + Compass | `DashboardEmptyCard` with Open Discover CTA |
| Activity | `DashboardCardHeader` + Zap | Still `return null` when no activity |
| Evolution | `DashboardCardHeader` + TrendingUp | Still `return null` when no content |

## Schedule Dashboard

| Element | Pattern |
|---------|---------|
| Day routines/tasks | Uppercase muted labels, inline CRUD |
| Countdowns | Target icon, reviewed filter |
| Empty day hint | Text only |

## Health Dashboard

| Section | Icon size | Metrics |
|---------|-----------|---------|
| Nutrition | 16px Lucide | Intake, bar, weekly avg, goal %, streak |
| Workout | 16px | Sets, weekly volume, PR, recent sessions |
| Habits | 16px | Today routine, toggle, streak, rate, momentum |
| Recovery | 16px | InBody, sleep avg, recovery note, rest day |

## Standardization Applied

- Knowledge empty cards use dashed border + `DashboardEmptyCard`
- Health retains ChevronRight navigation affordance on all cards
