# K-67 Validation Checklist

## Universal return paths

- [ ] Archive milestone → note shows `← Archive` return chip
- [ ] Archive area pill → note → return restores Analytics tab
- [ ] Schedule countdown → note → `← Schedule` return
- [ ] Discovery panel → note → breadcrumb shows Today's discoveries
- [ ] Timeline panel → note → breadcrumb shows Timeline
- [ ] Mobile back: stack → return tab → close editor

## Health day log

- [ ] Workout → Open day log → note titled `YYYY-MM-DD`
- [ ] Nutrition → Open day log → same note (or creates if missing)
- [ ] Recovery → Open day log → same note
- [ ] Return chip restores Health tab
- [ ] Breadcrumb shows correct section (Workout / Nutrition / Recovery)

## Breadcrumb

- [ ] Breadcrumb visible under note header when trail set
- [ ] Cosmos select shows Cosmos → note title
- [ ] Archive flows show Archive → sub-section → note title
- [ ] Refresh in session preserves breadcrumb (sessionStorage)

## Context awareness

- [ ] Event note shows Schedule event chip (return when from Schedule)
- [ ] Day log note shows Health day log chip
- [ ] Milestone note shows Archive milestone chip

## Feedback

- [ ] Settings export shows info toast with translated message
- [ ] `npm run lint:hardcoded-toasts` passes

## Automated

```bash
cd frontend
npm run typecheck   # 0 errors
npm run build       # PASS
npm run test        # PASS
npm run lint:hardcoded-toasts
```

## Regression

- [ ] K-66 session navigation stack back/forward
- [ ] K-66 Schedule/Health return tabs
- [ ] K-65 mobile search discoverability
