# K-39 Cosmos Terminology Audit

Audit date: K-39 milestone on `k39-cosmos-unification`.

## User-facing replacements (K-39)

| Legacy term | Replacement | Location |
|-------------|-------------|----------|
| Cosmos view | **Cosmos** | `nvGraph` i18n |
| Hover or select a **node** | Hover or select a **note** | `graphHoverHint` |
| Context subtitle missing Actions/Discover | Full suite listed | `k35ContextPanelSubtitle` |
| GitFork icon for Cosmos | **Orbit** icon | NoteView tabs, view mode, Cosmos footer |

## Already unified (K-34 / prior)

| Key | Value |
|-----|-------|
| `nvGraphMode` | Cosmos (Ctrl+G) |
| `nvScGraph` | Open cosmos |
| `wsOpenCosmos` | Open cosmos |
| `cosmosUniverseTitle` | Knowledge Cosmos |
| `graphModeCosmos` | Cosmos |
| `graphEmptyHeadline` | Your knowledge cosmos begins here |

## Intentionally retained (internal)

| Name | Reason |
|------|--------|
| `NoteGraphView.tsx` | Component/file name; not user-visible |
| `viewMode === 'graph'` | Internal state key |
| `buildGlobalGraphData`, `GraphNode`, `GraphEdge` | Data model types |
| `knowledgeUniverse/` module path | K-33 internal; rename deferred to K-40+ |
| `isUniverseMode()`, `focusUniverse` | Internal mode flags |
| `graphHud*`, `graphFilter*` i18n keys | Key names legacy; **values** are Cosmos-neutral (links, galaxies, tiers) |
| `onOpenGraph` prop name | Internal callback; UI label uses `wsOpenCosmos` |
| `hideGraph` focus preset flag | Internal preference key |
| Network vs Cosmos toggle | **Network** = link topology; **Cosmos** = galaxy layout — both valid sub-modes |

## Not found in user-facing UI

- "Knowledge Graph" — not used in i18n strings
- "Graph View" — replaced by Cosmos
- "Graph Search" — search uses workspace palette; `graphSearchNodes` value is "Search notes…"

## Recommended K-40 follow-up

- Rename i18n keys: `graphHud*` → `cosmosHud*` (keys only, no user impact until referenced)
- Rename `onOpenGraph` → `onOpenCosmos` in TypeScript interfaces
- Optional module rename: `knowledgeUniverse/` → `knowledgeCosmos/`
