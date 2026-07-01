# K-220 Notes/Cosmos Static Preview Mock Contract

## Purpose

K-220 creates the TypeScript mock contract and static fixture data for a future Notes/Cosmos static preview. It is not a runtime UI implementation.

The contract lives in `frontend/src/lib/notesCosmosStaticPreviewMockContract.ts` and is static data only.

## Contract Summary

K-220 exports:

- `NotesCosmosPreviewFixture`
- `NotesCosmosPreviewNode`
- `NotesCosmosPreviewRelationship`
- `NotesCosmosPreviewNodeKind`
- `NotesCosmosPreviewRelationshipKind`
- `NotesCosmosPreviewPositionHint`
- `NotesCosmosPreviewAccessibilityFallback`
- `notesCosmosStaticPreviewFixture`
- `validateNotesCosmosPreviewFixture`

The fixture uses mock/static data first, matching K-219 Option A.

## Fixture Size

The initial fixture contains:

- 10 nodes
- 12 relationships
- 3 clusters

The budget remains 8 to 16 nodes and 10 to 24 relationships.

## Relationship Representation

Relationships are top-level only through `relationships: NotesCosmosPreviewRelationship[]`.

Nodes do not include `relationships` or `relationshipIds`. This avoids duplicate relationship representation and keeps the first mock contract easy to validate.

## Position Hint Safety

`positionHint` is fixture-only and non-persistent.

It uses only:

- `ring`
- `order`
- `density`

It does not use saved coordinates, coordinate fields, persisted layout state, schema fields, store fields, or data derived from `LocalGraphView`.

## Runtime Boundary

K-220 does not implement runtime UI. It does not render a component, add routes, change navigation, read stores, call graph builders, call `KnowledgeIndexService`, or alter current graph surfaces.

`NoteGraphView` remains preserved as the shipped full-vault graph surface. `LocalGraphView` remains preserved as the local/context graph surface. Cosmos Map is still not implemented.

## Next Milestone

Recommended next target: **K-221 Notes/Cosmos Static Preview Component Plan**.

K-221 should decide whether and where a read-only static preview component may be implemented. It should preserve the current graph surfaces, keep the fixture static, require accessibility fallback rendering, require 390px mobile acceptance, and avoid interactive graph/canvas/orbit behavior unless separately approved.
