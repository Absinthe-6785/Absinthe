# K-66 Validation Checklist

## Navigation continuity

- [ ] Explore A → B → C; close mobile editor; reopen — back still works
- [ ] Refresh page in same session — back/forward preserved
- [ ] New browser session — stack starts fresh
- [ ] Stack entries track source in sessionStorage payload

## Cross-workspace

- [ ] Schedule countdown → note shows `← Schedule`
- [ ] Return chip switches to Schedule tab
- [ ] Health workout → "Open day log in Notes" → `← Health` return
- [ ] Mobile back: history → return tab → close editor

## Search discoverability

- [ ] Mobile note list shows workspace search icon
- [ ] Mobile shows Ctrl+K hint under sidebar search
- [ ] Graph search miss tap clears query

## Empty states

- [ ] Discovery / Timeline — existing CTAs still work
- [ ] Graph filter empty — clear action

## Feedback

- [ ] Settings reset toasts translated (common example view)

## Automated

```bash
cd frontend
npm run typecheck   # 0 errors
npm run build       # PASS
npm run test        # PASS
```

## Regression

- [ ] K-65 navigation keyboard shortcuts
- [ ] K-63 vault backup
- [ ] K-62 schedule swipe
