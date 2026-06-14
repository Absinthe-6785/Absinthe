# K-56 Import Structure

## Path aliases introduced

### Configuration

| File | Change |
|------|--------|
| `tsconfig.json` | `"baseUrl": "."`, `"paths": { "@/*": ["src/*"] }` |
| `vite.config.ts` | `resolve.alias: { '@': path.resolve(__dirname, './src') }` |
| Vitest | Inherits Vite config — no separate file |

### Available aliases

| Alias | Resolves to |
|-------|-------------|
| `@/types` | `src/types` |
| `@/lib` | `src/lib` |
| `@/hooks` | `src/hooks` |
| `@/components` | `src/components` |
| `@/store` | `src/store` |
| `@/features` | N/A — use `@/components/views/features/...` |

## Migration scope (K-56)

### Migrated (~30 files)

**Planner calendar-ui** — all files under:
- `calendar-ui/agenda/`
- `calendar-ui/day/`
- `calendar-ui/month/`
- `calendar-ui/week/`

Before:
```ts
import type { Theme } from '../../../../../../types';
import { useTranslation } from '../../../../../../lib/i18n';
```

After:
```ts
import type { Theme } from '@/types';
import { useTranslation } from '@/lib/i18n';
```

**Health panels:**
- `HealthDashboardPanel.tsx`
- `RecoveryLogPanel.tsx`
- `ProteinTracker.tsx`

**Dashboard:**
- `UnifiedWorkspaceDashboard.tsx` → `@/components/common/dashboard`

### Not migrated (K-57)

| Area | Deepest import | Files |
|------|----------------|-------|
| Block editor | `../../../../../../../` (7 levels) | ~6 files in `features/block-editor/` |
| Knowledge cosmos | `../../../../../../` (6 levels) | onboarding, actions panels |
| Knowledge database controls | 6 levels | TableViewControls, etc. |
| Legacy views | `../../types` | AppContent, views at shallow depth — already fine |

## Import depth audit

| Depth | Count (approx.) | Status |
|-------|-----------------|--------|
| 7 `../` segments | 6 | Block editor — K-57 |
| 6 segments | ~25 | Partially migrated (calendar-ui done) |
| ≤5 segments | Majority | Acceptable or use alias |

## Circular dependency check

No new circular imports detected after hook extraction. NoteView hooks import from `features/knowledge` (one-way). `common/dashboard` re-exports knowledge card headers (acceptable coupling for consolidation).

## Convention going forward

1. New files under `src/` should prefer `@/types`, `@/lib/i18n`, `@/hooks/*`
2. Feature-internal imports stay relative (`./hooks/useProteinData`)
3. Cross-feature imports go through `@/components/views/features/...` or feature barrels
