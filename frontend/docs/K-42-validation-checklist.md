# K-42 Validation Checklist

## Timeline core
- [ ] `buildKnowledgeTimeline` returns snapshots for month/quarter/all
- [ ] Empty vault shows timeline empty state

## UI
- [ ] Timeline tab in context panel
- [ ] Month / Quarter / All time toggles rebuild timeline
- [ ] Milestones section shows achieved/pending
- [ ] Area evolution with trend indicators
- [ ] How is this calculated? expands explain blocks

## Dashboard & HUD
- [ ] Knowledge Growth card on dashboard overview
- [ ] Open Timeline navigates to Timeline tab
- [ ] HUD shows evolution when recent growth > 0

## Constraints
- [ ] No AI / embeddings / telemetry
- [ ] No graph renderer changes

## Verification
- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] `npm run test`
