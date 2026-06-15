# K-63 Mobile Workflow Consistency

## Scope

Reviewed Schedule, Health, Notes, and Cosmos touch patterns for K-63.

## Findings

### Schedule (K-62 baseline)

- Swipe left/right for day/week navigation
- Hint strings: `scheduleSwipeDayHint`, `scheduleSwipeWeekHint`
- Touch targets on navigation controls meet 44px minimum

### Health

- Tab bar uses `min-h-[44px]` on primary tabs
- Workout blocks use `py-3.5` on primary actions
- Touch routing via `elementsFromPoint` for drag interactions

### Notes (K-63 changes)

- Sidebar backup/restore icon buttons: `min-h-[44px] min-w-[44px]` on Archive and Restore
- Vault restore modal: scrollable content, `max-h-[90vh]`, full-width action buttons
- Import accepts `.zip` and `.json` from mobile file picker

### Cosmos

- Pan/zoom via touch on graph canvas
- Preview panel closes on overlay tap and Escape
- Keyboard hint shown when preview active (desktop; harmless on mobile)

## Consistency Patterns

| Pattern | Schedule | Health | Notes | Cosmos |
|---------|----------|--------|-------|--------|
| 44px touch targets | ✓ | ✓ | ✓ (sidebar icons) | N/A (graph) |
| Bottom sheet / modal | — | — | Restore modal | Preview panel |
| Swipe navigation | ✓ day/week | — | — | Pan canvas |
| Hint text | ✓ | — | Tooltips | Keyboard hint |

## K-63 Improvements

1. Notes sidebar backup controls aligned to 44px touch standard
2. Restore modal responsive layout with stacked actions
3. Settings vault section: stacked buttons on narrow screens (`flex-col sm:flex-row`)

## Remaining Gaps (K-64 candidates)

- Health: optional swipe between tabs (Schedule parity)
- Notes: explicit swipe hint on mobile restore flow
- Cosmos: larger tap hit area on small nodes at low zoom
