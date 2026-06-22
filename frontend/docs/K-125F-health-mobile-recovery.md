# K-125F — Health Mobile Recovery & Analytics Simplification

Restore fast mobile workout flow and simplify analytics presentation.
UI and interaction only — no metric, store, or hydration changes.

## Analytics redesign

- **Keep:** weekly/monthly summary, PR, recent sessions, exercise history
- **Remove:** workout streak
- **Charts:** behind collapsible section, collapsed by default
- **Defaults:** analytics panel expanded (summary visible); PR/recent/history/charts collapsed

## Mobile workout flow

Order in workout tab:

1. Today's workout + save
2. InBody quick input (`HealthInbodyQuickPanel`)
3. Analytics
4. Supporting panels (desktop)

## Interaction fixes

- **Library blocks:** delete/edit hidden on mobile; overflow menu + long-press (`WorkoutBlockCard`)
- **Workout cards:** delete via overflow menu on mobile; overlap guarded with `isolate` / `z-0`
- **Library tags:** single-row horizontal scroll chips
- **App navigation:** Settings + theme in mobile More sheet (`Sidebar`)

## Files

| File | Role |
|------|------|
| `HealthAnalyticsPanel.tsx` | No streak, 2-col summary, charts collapsible |
| `HealthView.tsx` | Mobile flow, workout overflow, overlap fix |
| `HealthInbodyQuickPanel.tsx` | Mobile InBody quick entry |
| `HealthNavigation.tsx` | Mobile blocks/routine/workout tabs |
| `WorkoutRoutinePanel.tsx` | Routine setup extraction |
| `WorkoutBlockCard.tsx` | Library card with mobile overflow |
| `HealthBlockLibrary.tsx` | Horizontal tag scroll |
| `Sidebar.tsx` | Mobile More menu for settings/theme |
| `healthSectionPrefs.ts` | `analyticsCollapsed: false` |

## Verification

```bash
cd frontend
npm run typecheck
npm run build
npm test -- k125f k107HealthPerformance k121HealthAnalytics k125c
```
