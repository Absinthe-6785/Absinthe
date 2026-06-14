# K-55 Type Audit

Branch: `k55-type-debt-reduction`  
Date: 2026-06-14

## Summary

| Metric | Before | After |
|--------|--------|-------|
| `typecheck:editor` | PASS | PASS |
| `typecheck:undefined` (TS2304) | PASS (0) | PASS (0) |
| `typecheck:app` | **87 errors** | **0 errors** |
| `npm run build` | PASS | PASS |
| `npm run test` | PASS (1897) | PASS (1897) |

Goal was &lt; 30 errors; stretch goal was 0. **Stretch goal achieved.**

---

## Error Categories (Before — 87 total)

| Category | TS codes | Count | Root cause |
|----------|----------|-------|------------|
| **Import path resolution** | TS2307 | 22 | `calendar-ui/{agenda,day,month,week}/` files used 5-level `../` to `types`; needed 6. Archive/knowledge paths similarly off by one segment. |
| **Missing property on domain types** | TS2339 | 24 | `Schedule.end_next_day`, `Routine.is_exception_day`, `Workout.sort_order`, `ProteinIntakeLog.amount_g`, `Theme.text` used at runtime but absent from `src/types/index.ts`. |
| **Type assignability** | TS2322 | 10 | `Promise<boolean>` returned from `api()` inside `showConfirm(() => …)` expecting `void \| Promise<void>`. `Theme` prop mismatches in health panels. |
| **Argument type mismatch** | TS2345 | 7 | `NoteView` panels passed `NoteBase \| null` where `NoteBase` required; `AreaRangeTraceProjection` narrowing incomplete. |
| **Nullable handling** | TS18047 | 6 | `activeNote` possibly null in context panels despite runtime guards. |
| **Readonly modifier misuse** | TS1354 | 4 | `readonly` on indexed access types in `agendaCalendarPresentation.ts` params. |
| **Missing required props** | TS2741 | 3 | `Theme.text` missing from interface and `buildThemeClasses()`. |
| **Implicit any** | TS7006 | 3 | Sort callback params in `buildPlannerViewPayloads.ts` (caused by readonly array inference). |
| **Unintentional comparison** | TS2367 | 3 | Dead `nodeTier === 'star'` in galaxy tier branch; dead `healthSection !== 'nutrition'` inside habits/workout branch. |
| **Missing exports** | TS2305 | 2 | `Language` imported from `types` instead of `lib/i18n`; `AgendaTodoList` not re-exported from `agenda/index.ts`. |
| **Duplicate identifier** | TS2300 | 2 | `buildNoteGalaxyMap` imported twice in `NoteView.tsx`. |
| **SWR untyped fallback** | TS2740 | 1 | `LegacyAnalyticsView` `useSWR` without generic → `{}` inferred. |
| **Incomplete Record** | TS2741 | 2 | `graphLabels.ts` missing `weak` edge kind after `EdgeSemanticKind` expansion. |

---

## Affected Modules

### High density (10+ errors)

| Module | Errors | Complexity |
|--------|--------|------------|
| `NoteView.tsx` | 22 | Medium — nullable guards, duplicate import, CSS shadowing, workspace union narrowing |
| `calendar-ui/*/` (planner) | 18 | **Low** — mechanical import depth fix |
| `HealthView.tsx` | 11 | Low–medium — domain types + callback wrapping |
| `PlannerView.tsx` | 9 | Low — domain types + `void api()` in confirm handlers |

### Medium density (3–9 errors)

| Module | Errors | Complexity |
|--------|--------|------------|
| `buildPlannerViewPayloads.ts` | 7 | Low — mutable `PlannerAgendaItem[]` + import |
| `LegacyAnalyticsView.tsx` | 2 | Low — `useSWR<Schedule[]>` |
| `graphLabels.ts` | 4 | Low — import paths + `weak` labels |
| Archive feature | 3 | Low — import paths + `Language` source |

### Low density (1–2 errors)

- `graphScalePolicy.ts`, `WeeklyTimetableSection.tsx`, `HealthDashboardPanel.tsx`, `agendaCalendarPresentation.ts`, `buildThemeClasses.ts`, `agenda/index.ts`

---

## Fixes Applied (by category)

### Domain type alignment (`src/types/index.ts`)

- `Theme.text: string`
- `Schedule.end_next_day?: boolean`
- `Routine.is_exception_day?: boolean`
- `Workout.sort_order?: number`
- `ProteinIntakeLog.amount_g?: number`

### Import path corrections

- `calendar-ui/{agenda,day,month,week}/` → `../../../../../../types` (6 levels to `src/`)
- `ArchiveShell.tsx` → `../../../../types`
- `archive/home/archiveMarkCalendarPresentation.ts` → `../../knowledge/archive`
- `useArchiveHomeProjection.ts` → `Language` from `lib/i18n`
- `graphLabels.ts` → `../../../../lib/i18n`, `./graph/knowledgeUniverse/edgeVisualization`

### SWR / data layer

- `LegacyAnalyticsView`: `useSWR<Schedule[]>(…)` 
- `fetcher.ts` already generic (`<T = unknown>`) — no change required
- Health hooks (`useProteinData`, `useWorkoutRangeMetrics`) already typed — verified

### React / callback typing

- `showConfirm` handlers wrapped with `void api(…)` in `PlannerView`, `HealthView`, `WeeklyTimetableSection`
- `ProteinTrackerProps` uses shared `Theme` + `showToast` signature from `BaseViewProps`

### NoteView hardening

- Removed duplicate `buildNoteGalaxyMap` import
- `globalThis.CSS?.escape()` avoids local `CSS` string shadowing
- `activeNote &&` guards on context panels
- `'id' in workspaceActivation` narrowing for discriminated union
- `AreaRangeTraceProjection` cast after `'notesTouched' in` guard

### Planner calendar

- `PlannerAgendaItem[]` mutable builder array
- `AgendaTodoList` export added
- `readonly` removed from indexed-access parameter types

---

## tsconfig Coverage (P5)

| Config | Scope | Status |
|--------|-------|--------|
| `tsconfig.editor.json` | Block editor only (explicit glob includes) | PASS — intentional narrow scope |
| `tsconfig.app.json` | Full `src/`, excludes `**/*.test.*` | PASS — covers health, schedule, notes, knowledge, settings, hooks, store, lib |
| `tsconfig.json` | Base strict config, `include: ["src"]` | Extended by both above |

### Intentional exclusions

- `**/*.test.ts`, `**/*.test.tsx` — excluded from app typecheck (run via vitest, not tsc)
- Block editor files outside `tsconfig.editor.json` globs — covered by `tsconfig.app.json` instead

### Feature folder coverage in `tsconfig.app.json`

All major folders under `src/` are included via `"include": ["src"]`:

- `components/views/features/health` ✓
- `components/views/features/planner` ✓
- `components/views/NoteView.tsx` (notes) ✓
- `components/views/features/knowledge` ✓
- `components/views/SettingsView.tsx` ✓
- `hooks/`, `lib/`, `store/`, `theme/` ✓

---

## Verification

```bash
npm run typecheck          # editor + undefined + app
npm run typecheck:undefined
npm run typecheck:app
npm run build
npm run test
```

All PASS as of K-55 completion.
