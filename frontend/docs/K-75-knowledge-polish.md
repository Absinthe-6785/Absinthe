# K-75 — Knowledge Workflow & UI Consistency Polish

Polish release: no new subsystems. Focus on coherence, usefulness, and shared sizing.

## UI consistency

### Action tokens (`frontend/src/theme/actionTokens.ts`)

| Token | Value |
|-------|-------|
| `ACTION_SIZE_SM` | 32px |
| `ACTION_SIZE_MD` | 40px |
| `ACTION_SIZE_LG` | 48px |
| `ICON_SIZE_SM` | 12px |
| `ICON_SIZE_MD` | 14px |
| `ICON_SIZE_LG` | 16px |
| `TOOLBAR_HEIGHT` | 40px |

### Applied surfaces

- **Notes** — `.btbtn` / `.bicon-btn` standardized to 40×40 (44 touch on compact)
- **Notes header** — icon sizes unified to 14px
- **Cosmos** — toolbar height uses `toolbarControlHeight()` (40 desktop / 44 touch)
- **Schedule** — day schedule edit/delete buttons use 44px touch targets
- **Card headers** — `DashboardCardHeader` uses `CARD_HEADER_ICON_SIZE`

### Shared component

- `frontend/src/components/common/IconActionButton.tsx` — reusable square icon actions

## Knowledge workflow

### Related notes

Merged three overlapping sections into two:

1. **Most related** — top 6 by composite score
2. **Worth revisiting** — incoming links + recency (replaces Recently Connected + Frequently Referenced)

### Discovery

Removed low-value sections from feed collection and panel:

- `recently-active-area` (vanity health labels)
- `emerging-topic` (overlaps weak-hub)

Vault health strip always shown when metrics available (3 actionable metrics: connected %, isolated count, active this week).

### Cosmos

- **HUD** — removed tier breakdown, per-area rows, growing clusters, large areas, core/hub vanity counts; kept isolated, opportunities, weak areas, discovery actions
- **Preview** — removed duplicate backlinks/galaxy line and decorative “highly connected” badge; kept isolated signal only

### Search

- Intelligence enrichment deferred to top 20 note hits (performance)

### Timeline

- Highlights cap reduced to 5 items

## Performance

- `NoteGraphView` discovery feed includes `historyEvents` (aligned with context panel)
- `buildWorkspaceSearch` two-pass enrichment
- `groupRelatedNotes` precomputes incoming link counts

## Product debt

- Deleted unused `ArchiveModeSwitcher.tsx` (dead since K-71)

## Verification

```bash
npm run typecheck  # pass
npm run build      # pass
npm run test       # pass (+ k75KnowledgePolishAudit.test.ts)
```

## Remaining UX debt (post K-75)

- Tailwind workspaces still use ad-hoc CTA classes (K-64 `primaryButtonClass` deferred)
- Cosmos HUD discovery block still mirrors Discover tab counts
- Timeline overview remains dense; further section pruning possible
- `DiscoveryKind` union still includes deprecated kinds for badge backward compatibility
- Orphan i18n keys: `k70RelatedRecentlyConnected`, `k70RelatedFrequentlyReferenced`, `k38HudEmergingTopics`

## Files modified

| Area | Files |
|------|-------|
| Tokens | `actionTokens.ts`, `IconActionButton.tsx` |
| Notes UI | `useNoteViewStyles.ts`, `NoteViewEditorArea.tsx`, `NoteView.tsx` |
| Knowledge | `groupRelatedNotes.ts`, `RelatedNotesPanel.tsx`, `discoveryEngine.ts`, `DiscoveryPanel.tsx`, `VaultHealthStrip.tsx`, `vaultHealthMetrics.ts`, `buildWorkspaceSearch.ts`, `recentKnowledgeHighlights.ts`, `DashboardCardHeader.tsx` |
| Cosmos | `NoteGraphView.tsx`, `CosmosGraphPreviewPanel.tsx` |
| Schedule | `DayScheduleTimeline.tsx` |
| Archive | removed `ArchiveModeSwitcher.tsx` |
| i18n | `i18n.ts` |
| Tests | `groupRelatedNotes.test.ts`, `vaultHealthMetrics.test.ts`, `knowledgeIntelligenceAudit.test.ts`, `k75KnowledgePolishAudit.test.ts` |
