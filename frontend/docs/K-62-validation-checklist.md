# K-62 — Validation Checklist

## Backup restore

- [ ] Export vault JSON from Settings
- [ ] Import same file → preview shows correct counts
- [ ] Import with conflicts → Skip keeps local notes
- [ ] Import with conflicts → Replace overwrites content
- [ ] Import with conflicts → Duplicate creates new ids
- [ ] Import from Notes sidebar ↺ button
- [ ] Invalid JSON shows error toast

## Mobile schedule

- [ ] Day view: swipe left → next day
- [ ] Day view: swipe right → previous day
- [ ] Week view: swipe changes week
- [ ] Routine/todo rows ≥ 44px tap height
- [ ] Period nav buttons ≥ 44px on phone

## Cosmos

- [ ] Click node → preview opens
- [ ] Escape closes preview
- [ ] Arrow keys cycle previewed nodes
- [ ] Viewport pans to selected node
- [ ] Galaxy label shows count when 2+ nodes

## Workflow

- [ ] Relations empty panel shows discover hint
- [ ] No regressions in note edit/search/graph

## Build

```bash
npm run typecheck
npm run build
npm run test
```

Expected: 0 TS errors, build PASS, all tests PASS.

## Product readiness snapshot

| Area | Rating | Notes |
|------|--------|-------|
| Usability | Good | Restore + swipe reduce friction |
| Backup safety | Good | Export + restore + conflict choice |
| Mobile readiness | Improved | Schedule one-handed nav |
| Workflow consistency | Good | Hints align across views |
| Discoverability | Improved | Contextual hints, no tutorial bloat |
