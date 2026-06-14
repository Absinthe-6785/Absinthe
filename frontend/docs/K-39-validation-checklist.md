# K-39 Validation Checklist

## Terminology

- [ ] No user-facing "Graph view" — shows **Cosmos**
- [ ] Hover hint says "note" not "node"
- [ ] Quick actions show "Open cosmos"
- [ ] Context panel subtitle lists insights, actions, discovery

## Navigation

- [ ] Cosmos tabs use Orbit icon (view mode, context panel, footer)
- [ ] Insights → Actions → Discover tabs contiguous
- [ ] Ctrl+G opens Cosmos view

## Visual identity

- [ ] Insights panel shows Knowledge Cosmos suite header
- [ ] Actions panel shows suite header
- [ ] Discover panel shows suite header
- [ ] Discovery cards show confidence badge + reason block

## Discovery quality

- [ ] No duplicate forgotten + drift for same note
- [ ] Weak hub areas don't also show emerging topic
- [ ] Missing connections require score ≥ 14
- [ ] Items below score 35 filtered out

## HUD

- [ ] Cosmos HUD has aria-label
- [ ] Discovery counts + Open Discover / Review work

## Verification

- [ ] `npm run typecheck` passes
- [ ] `npm run build` passes
- [ ] `npm run test` passes

## K-40 opportunities

- [ ] i18n key rename (`graphHud*` → `cosmosHud*`)
- [ ] Discover tab keyboard shortcut
- [ ] Discovery dismiss/snooze
- [ ] Optional auto-open Discover on high-confidence vault state
