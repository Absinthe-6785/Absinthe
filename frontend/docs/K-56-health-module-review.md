# K-56 Health Module Review

## Before

```
HealthView.tsx (2,057 lines)
├── Inline ProteinTracker (~513 lines)
├── Inline protein constants
├── Workout/routine/block UI
└── HealthDashboardPanel (separate file, ad-hoc SectionLink)
```

## After

```
features/health/
├── nutrition/
│   ├── ProteinTracker.tsx      # Extracted UI (~513 lines)
│   ├── proteinConstants.ts     # Categories, factors, normalize
│   ├── proteinMetrics.ts       # Pure metrics (existing)
│   └── index.ts
├── hooks/
│   ├── useProteinData.ts       # Shared SWR layer
│   ├── useWorkoutRangeMetrics.ts
│   ├── useHabitMetrics.ts
│   └── useRecoveryMetrics.ts
├── HealthDashboardPanel.tsx    # Uses DashboardSection
├── RecoveryLogPanel.tsx
├── HabitQuickPanel.tsx
└── HealthWorkspaceNav.tsx

HealthView.tsx (1,433 lines) — imports ProteinTracker from nutrition/
```

## Data layer

| Hook | Consumers | API |
|------|-----------|-----|
| `useProteinData` | `ProteinTracker`, `HealthDashboardPanel` | SWR: profile, sources, intake, streak |
| `useWorkoutRangeMetrics` | `HealthDashboardPanel` | Weekly sessions, PR |
| `useHabitMetrics` | `HealthDashboardPanel`, `HabitQuickPanel` | Routine completion |
| `useRecoveryMetrics` | `HealthDashboardPanel`, `RecoveryLogPanel` | Sleep trends |

Duplication resolved: protein UI lives in one module; dashboard and tracker share `useProteinData` without inline duplication.

## Import migration

Health panels now use `@/` aliases:

```ts
import { useTranslation } from '@/lib/i18n';
import type { Theme } from '@/types';
import { DashboardSection } from '@/components/common/dashboard';
```

## Module boundaries (preserved)

- No API/schema changes
- `ProteinTrackerProps` unchanged (Theme + showToast signature)
- `HealthDashboardPanelProps` unchanged
- Runtime behavior identical; 1,897 tests pass

## K-57 health targets

1. Extract workout section from `HealthView` → `features/health/workout/`
2. Type `useProteinData` weekly SWR call with explicit generic
3. Shared `HealthSectionShell` for recovery/habits layout patterns
