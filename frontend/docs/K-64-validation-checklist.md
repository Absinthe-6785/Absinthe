# K-64 Validation Checklist

## Workflow

- [ ] Mobile editor back returns to list with same note highlighted
- [ ] Click `[[wiki link]]` in edit mode navigates without Ctrl/Cmd
- [ ] Note list empty shows “Create your first note” button
- [ ] Relations panel empty shows wiki link action
- [ ] Graph context tab (isolated note) shows empty guidance + Cosmos action

## Cosmos

- [ ] Small nodes easier to tap on mobile (halo, no visual size change)
- [ ] Dim labels more readable at default zoom
- [ ] Enter opens previewed note; Escape closes preview
- [ ] Universe HUD action buttons respond to clicks
- [ ] Click preview / double-click open model unchanged

## Mobile

- [ ] Create note button ≥ 44px in sidebar
- [ ] Note list rows ≥ 44px height
- [ ] Context panel tabs ≥ 44px on mobile drawer
- [ ] Health nav tabs ≥ 44px on compact
- [ ] Health block edit/delete visible without hover
- [ ] Planner todo edit/delete visible without hover on mobile

## Empty States

- [ ] Health empty blocks opens create modal on tap
- [ ] Note list empty creates note on CTA tap

## Visual

- [ ] `.bwbg` buttons use 12px radius
- [ ] Knowledge empty-state buttons ≥ 36px height

## Automated

```bash
cd frontend
npm run typecheck   # 0 errors
npm run build       # PASS
npm run test        # PASS (~1925 tests)
```

## Regression

- [ ] Vault backup/restore (K-63) unchanged
- [ ] Schedule swipe (K-62) unchanged
- [ ] Cosmos preview sheet on mobile unchanged
