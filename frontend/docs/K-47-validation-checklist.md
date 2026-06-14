# K-47 Validation Checklist

## Manual

- [ ] Compare Areas opens comparison view with 2+ areas
- [ ] Journey steps show dates and days-since-previous
- [ ] Dormant areas appear in Timeline Overview when applicable
- [ ] Dashboard evolution card shows period growth + dormant warning
- [ ] Click fastest growing area on dashboard → opens area evolution
- [ ] Export Report copies and downloads markdown
- [ ] Export Activity and Journey work via copy/download

## Automated

```bash
cd frontend
npm run typecheck
npm run build
npm run test
```

## Regression

- [ ] K-46 area drill-through still works
- [ ] K-45 activity feed virtualization unchanged
