# K-45 Validation Checklist

## Manual

- [ ] Open Timeline on vault with no prior history → bootstrap runs, Activity shows imported events
- [ ] Activity feed groups by date, localized labels
- [ ] Imported events show **Imported** badge
- [ ] Overview / Activity / Milestones tabs switch correctly
- [ ] Click activity row → opens related note
- [ ] Click achieved milestone → opens milestone note when known
- [ ] Evolution summary shows first note/link/hub and current counts
- [ ] Cosmos evolution story renders when first note exists
- [ ] Discovery progress appears after resolving a discovery
- [ ] Dashboard Knowledge Activity card shows recent activity, milestone, growth trend
- [ ] Vault with real K-44 history skips bootstrap and shows non-imported events

## Automated

```bash
cd frontend
npm run typecheck
npm run build
npm run test
```

## Regression

- [ ] K-42 timeline growth metrics still render in Overview
- [ ] K-44 history recording still fires on note create/link/hub
- [ ] Discovery feed unchanged except history-aware scoring

## Known limitations

- Activity feed capped at 120 events
- Bootstrap timestamps are approximate
- No server sync of history
