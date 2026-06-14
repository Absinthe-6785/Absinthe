# K-39 Navigation Audit

## Entry points

| Entry | Label | Icon | Shortcut | Status |
|-------|-------|------|----------|--------|
| NoteView view mode | Cosmos | Orbit | Ctrl+G | K-39 unified |
| Context panel tab | Cosmos | Orbit | — | K-39 unified |
| Context panel | Insights | Lightbulb | — | OK |
| Context panel | Actions | Zap | — | OK |
| Context panel | Discover | Compass | — | OK |
| Workspace quick actions | Open cosmos | — | — | OK (`wsOpenCosmos`) |
| Dashboard discoveries | Open Discover | — | — | OK |
| Local graph footer | Open full Cosmos view | Orbit | — | K-39 unified |
| Graph HUD | Open Discover / Review | — | — | OK |
| Search palette | Actions available / Discovery | — | — | OK |

## Tab order (context panel)

Current order matches product hierarchy:

1. Outline
2. Links
3. **Cosmos** (local neighborhood)
4. **Insights**
5. **Actions**
6. **Discover**
7. Properties / Tags / Relations / Stats

Cosmos intelligence suite (Insights → Actions → Discover) is contiguous.

## Aria & accessibility

| Surface | K-39 change |
|---------|-------------|
| Cosmos HUD | `aria-label={k39CosmosHudAria}` |
| Context panel | Existing `aria-label={nvSidePanel}` |
| Tab bar | Existing `role="tablist"` |

## Mobile / compact

- Context panel uses horizontal scroll tab bar (unchanged)
- Dashboard discovery card uses compact padding (unchanged)

## Gaps (K-40)

- No single keyboard shortcut to open Discover tab directly
- Focus preset `hideGraph` name still internal-only
