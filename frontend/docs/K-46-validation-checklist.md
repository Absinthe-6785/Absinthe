# K-46 Validation Checklist

## Manual

- [ ] Click area row in Timeline Overview → AreaEvolutionPanel opens
- [ ] Area panel shows timeline, milestones, recent activity
- [ ] Back returns to Timeline Overview
- [ ] Milestones tab shows Knowledge Journey path
- [ ] Dashboard shows Knowledge Evolution card with Open Evolution
- [ ] Bootstrap import summary appears once after seed, dismissible
- [ ] Export Markdown copies evolution summary
- [ ] Activity feed scrolls smoothly with large history
- [ ] Discovery progress shows 30-day trend indicators
- [ ] Cosmos story shows highlight lines (fastest/longest/connected area)

## Automated

```bash
cd frontend
npm run typecheck
npm run build
npm run test
```

## Regression

- [ ] K-45 activity feed still shows imported badges
- [ ] K-44 history recording unchanged
