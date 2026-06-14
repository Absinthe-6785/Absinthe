# K-37 Validation Checklist

## Actions tab

- [ ] Open Actions tab on a note with opportunities — checklist shows prioritized actions
- [ ] **Connect** appends wiki link to body
- [ ] **View candidates** switches to Links tab
- [ ] **Assign** sets area property and wiki link when area note exists
- [ ] **Create hub** creates templated hub note marked as area
- [ ] **Create relation** adds `related-to` target

## Suggested connections

- [ ] Each suggestion shows shared tags / mutual references where applicable
- [ ] **Create relation** and **Open** work

## Area guidance

- [ ] Fragmented area shows recommendations (hub, milestones, connect isolated)
- [ ] Unassigned note shows suggested area with confidence + **Assign**

## Related notes

- [ ] Links panel → Related Notes shows **Link** button per row
- [ ] **Link** appends wiki link to active note

## Search

- [ ] Notes with pending actions show **Actions available** in palette

## Graph HUD

- [ ] Weak areas count shows **Review** → opens Actions on a note in weakest area
- [ ] Isolated count shows **Open** → reveals isolated nodes

## Constraints

- [ ] No network / LLM calls during action flow
- [ ] `npm run typecheck` passes
- [ ] `npm run build` passes
- [ ] `npm run test` passes

## K-38 follow-up

- Bulk action queue (apply multiple checklist items)
- Area assignment via drag-to-galaxy in graph
- Backlink candidate picker modal (instead of Links tab redirect)
- Milestone creation assistant from area guidance
