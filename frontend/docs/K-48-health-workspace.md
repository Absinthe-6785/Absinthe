# K-48 Health Workspace Foundation

## Goal

Evolve Health from a protein-island + workout panels into a navigable workspace without overbuilding backend or new panels.

## Structure

```
Health
├── Dashboard   — at-a-glance hint (stub; aggregates in K-49)
├── Nutrition   — ProteinTracker (full-width)
├── Workout     — today's session, calendar, inline nutrition on desktop
├── Habits      — exercise blocks + split routine setup
└── Recovery    — InBody + calendar (shared with workout layout for now)
```

## Implementation

| Piece | Path | Notes |
|-------|------|-------|
| Nav shell | `features/health/HealthWorkspaceNav.tsx` | Lucide icons, i18n labels |
| Integration | `HealthView.tsx` | `healthSection` state; section gating |
| Protein | Inline `ProteinTracker` | Categories use Lucide + i18n (no emoji) |
| Mobile | Existing block/routine/workout/protein tabs retained | Desktop uses workspace nav |

## UX improvements (K-48)

- Protein panel title aligned with **Nutrition** naming
- Category labels localized (`proteinCategory*`)
- Removed emoji from protein goal/intake toasts and session labels
- Workout memo header uses `t('memo')` instead of `📝 MEMO`
- Card hierarchy matches Note/Cosmos: `rounded-[24px]`, primary accent, compact nav pills

## Extensibility

- Add `HealthDashboardPanel.tsx` in K-49 with workout lock status, protein %, InBody snapshot
- Split `ProteinTracker` to `features/health/nutrition/` when nutrition grows beyond protein
- Recovery section can absorb sleep/HRV when data model exists — no storage changes in K-48

## Out of scope (K-48)

- New API endpoints
- AI meal suggestions
- Telemetry
