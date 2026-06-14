# K-43 Validation Checklist

## Discoverability & consistency
- [ ] Context panel subtitle lists timeline
- [ ] Timeline tab tooltip shows vault-growth disambiguation
- [ ] Note-required tabs show select-note empty when no active note
- [ ] Sidebar Notes + Dashboard labels use i18n (not hardcoded Korean)
- [ ] Empty Cosmos unlinked body localized in ko/ja

## Performance
- [ ] Workspace search builds one galaxy map per query
- [ ] Dashboard reuses `discoveryFeed` from NoteView
- [ ] Search palette accepts shared `discoveryFeed`
- [ ] Timeline reuses single `areaEvolution` for recent summary

## Regression
- [ ] Discover + Timeline tabs work without active note
- [ ] Ctrl+K search still enriches note results
- [ ] Dashboard discovery card still appears when feed non-empty

## Constraints
- [ ] No AI / embeddings / renderer redesign
- [ ] No Planner / Archive redesign

## Verification
- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] `npm run test`

## Dashboard hierarchy (reference)
1. Onboarding (tour / start) when applicable
2. Timeline + Discovery cards (when data exists)
3. Recent activity insights
4. Knowledge review
5. Learning paths
