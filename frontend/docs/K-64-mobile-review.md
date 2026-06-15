# K-64 Mobile Review

## Touch Target Standard

`TOUCH_TARGET_MIN_PX = 44` from `responsiveLayout.ts` — target for all primary controls.

## Notes

| Control | K-63 | K-64 |
|---------|------|------|
| Vault backup/restore icons | 44×44px | Unchanged |
| Create note `+` | Small padding | 44×44px |
| Note list rows `.bni` | ~36px effective | `min-height: 44px` |
| Context panel tabs | 8×4px padding | `min-height: 44px` when compact |
| Mobile editor back | Cleared selection | Preserves selection; 44px button |

## Cosmos

| Control | K-64 change |
|---------|-------------|
| Toolbar (compact) | Already 44px from K-60 |
| Node hit area | Invisible halo `max(r+12, 22)` on compact |
| Preview sheet | `TOUCH_TARGET_MIN_PX` on Open/Close — unchanged |

### Gap (K-65)

- Pan/zoom still mouse-oriented; touch pan works on canvas but no dedicated touch node drag
- Search input fixed 140px width truncates on narrow screens

## Schedule

| Control | Status |
|---------|--------|
| Mobile planner tabs | 44px — reference pattern |
| Routine/task rows | 44px height |
| Todo edit/delete | Now `opacity-100` on mobile (was hover-only) |
| Day swipe | K-62 hints retained |

## Health

| Control | K-64 change |
|---------|-------------|
| Workout sub-tabs | Already 44px |
| Workspace nav compact | Added `min-h-[44px]` |
| Block edit/delete | Visible on touch |
| Empty blocks | Tap to create |
| Tag filter chips | Still `py-1` — minor gap |

## Consistency Matrix

| Pattern | Notes | Cosmos | Schedule | Health |
|---------|-------|--------|----------|--------|
| 44px primary actions | ✓ | ✓ toolbar | ✓ | ✓ |
| Hover-only controls fixed | — | — | ✓ todos | ✓ blocks |
| Actionable empty states | ✓ | ✓ context | — | ✓ blocks |
| Swipe navigation | — | pan | ✓ day/week | — |

## Recommendations (K-65)

- Health tab swipe (Schedule parity)
- Larger Cosmos search field on mobile
- Explicit swipe hint on Health sections
