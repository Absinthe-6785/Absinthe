# K-65 Validation Checklist

## Navigation stack

- [ ] Open note A → wiki link to B → back returns to A
- [ ] Forward restores B after back
- [ ] Cosmos select pushes history; back works
- [ ] Workspace search (Ctrl+K) opens note with history
- [ ] Sidebar list click pushes history
- [ ] Alt+← / Alt+→ keyboard navigation
- [ ] Mobile back uses history when available; else closes editor

## Search

- [ ] Sidebar: empty vault shows create CTA
- [ ] Sidebar: search miss shows `nvSearchNoResults` + clear button
- [ ] Workspace search ranking matches sidebar (title before body)

## Health mobile

- [ ] Swipe between Dashboard / Nutrition / Workout / Habits / Recovery on mobile
- [ ] Desktop unaffected
- [ ] Workout empty tap → blocks tab

## Cosmos mobile

- [ ] Compact search field responsive
- [ ] Filter chips on mobile graph
- [ ] Active node ring visible
- [ ] Preview sheet spacing on mobile

## Empty states

- [ ] Planner routines empty → focus add input
- [ ] Planner tasks empty → focus add input
- [ ] Health workouts empty → navigate to blocks

## i18n

- [ ] Trash permanent delete dialog translated
- [ ] Settings CSV export toasts translated
- [ ] Graph folder fallback uses `graphFolderFallback`

## Automated

```bash
cd frontend
npm run typecheck   # 0 errors
npm run build       # PASS
npm run test        # PASS
```

## Regression

- [ ] K-64 Cosmos interaction unchanged (Enter/Escape preview)
- [ ] K-62 Schedule swipe unchanged
- [ ] K-63 vault backup/restore unchanged
