# K-222 Notes/Cosmos Static Preview Component Skeleton

## Purpose

K-222 adds an isolated Notes/Cosmos static preview component skeleton. It is not a runtime Cosmos Map and is not wired into Notes navigation.

## Scope

The component is fixture-driven, static, read-only, and fallback-first. It uses the K-220 mock contract only and does not read live graph data.

## Files

- Component: `frontend/src/components/notes/NotesCosmosStaticPreview.tsx`
- Test: `frontend/src/components/notes/NotesCosmosStaticPreview.test.ts`
- Fixture contract: `frontend/src/lib/notesCosmosStaticPreviewMockContract.ts`

## Boundaries

- no NoteView changes
- no NoteGraphView changes
- no LocalGraphView changes
- no ProductEmptyState changes
- no NotesPixelCosmosEmptyState changes
- no route or navigation wiring
- no stores, schemas, providers, or persistence changes
- no graph builder imports
- no KnowledgeIndexService imports
- no assets, fonts, generated images, or dependencies

## Accessibility And Mobile

The component renders all nodes and relationships as visible text/list content. It includes fallback text, deterministic ordering, readable labels, source/target relationship text, and 390px mobile acceptance copy. It uses no canvas, WebGL, SVG-only map, animation, hover-only controls, or visual-only critical information.

## Next Milestone

Recommended next target: **K-223 Notes/Cosmos Static Preview Skeleton Isolation Audit**.

K-223 should verify that the skeleton remains isolated, unwired, fixture-only, accessible, mobile-safe, and free of forbidden runtime imports before any dev/test surface decision.
