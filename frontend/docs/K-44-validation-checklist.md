# K-44 Validation Checklist

## History core
- [ ] Events persist across page reload (localStorage)
- [ ] Invalid storage recovers to empty array
- [ ] Event cap trims oldest entries
- [ ] Settings reset clears history

## Recording
- [ ] Create note → `NOTE_CREATED`
- [ ] Permanent delete → `NOTE_DELETED`
- [ ] Add/remove `[[wiki]]` → `LINK_CREATED` / `LINK_REMOVED`
- [ ] Area property change → `AREA_ASSIGNED` / `AREA_REMOVED`
- [ ] Create hub → `HUB_CREATED`
- [ ] Cosmos/Discover action → `DISCOVERY_RESOLVED`

## Timeline
- [ ] Empty history → K-42 fallback (`usesEventHistory: false`)
- [ ] With history → growth uses event counts
- [ ] UI unchanged

## Dashboard
- [ ] Activity card shows 30-day counts when events exist
- [ ] Card hidden when no activity

## Insights
- [ ] History section shows first seen / last linked when recorded

## Discovery
- [ ] Feed builds with historyEvents without errors
- [ ] No new discovery kinds added

## Constraints
- [ ] No AI / embeddings / server APIs
- [ ] No Cosmos/Timeline UI redesign

## Verification
- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] `npm run test`
