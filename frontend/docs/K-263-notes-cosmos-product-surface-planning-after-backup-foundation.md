# K-263 Notes/Cosmos Product Surface Planning after Backup Foundation

## Purpose

K-263 restarts Notes/Cosmos product surface planning after the backup foundation line.

K-263 is docs/plan plus audit test only. K-263 does not implement UI. K-263 does not wire a runtime route/panel. K-263 does not mount `NotesCosmosStaticPreview`. K-263 does not replace existing graph surfaces. K-263 does not implement Cosmos Map. K-263 does not change persistence/schema. K-263 chooses the K-264 next path.

## Current Backup Foundation Status

K-235 through K-261 established and closed the backup/export/preflight safety foundation.

K-262 decided not to proceed directly into production backup runtime/productization. The backup foundation remains internal/dev/test-oriented where applicable. Production export preflight, export blocking, restore preview, Data Safety UI, attachment blob backup, provider-aware recovery, and `attachmentMetadataOnly` warning escalation remain deferred.

Carry-forward guardrails:

- local runtime data remains source of truth.
- no destructive restore default.
- no raw token/content/blob leakage.
- no silent provider/blob behavior changes.
- no backup safety claims beyond implementation.
- no production backup/preflight claims in Notes/Cosmos UI.
- no backup surface implementation in K-263.

## Current Notes/Cosmos State

K-214 defined the conceptual model for Home, Notes/Cosmos, Archive, Attachments, Health, and Schedule.

K-215 preserved IA/data boundaries and confirmed that Notes/Cosmos must not jump directly into graph, canvas, navigation, persistence, or schema rewrites.

K-216 audited current runtime surfaces. It identified `NoteView` as the current Notes shell, `NotesPixelCosmosEmptyState` as the empty-vault pixel-cosmos pilot, `NoteGraphView` as the shipped full-vault graph surface, and `LocalGraphView` as the shipped local/context graph surface.

K-217 preserved `NoteGraphView` as the shipped full-vault graph and `LocalGraphView` as the local/context graph. Cosmos Map is not implemented. Cosmos Map must not replace `NoteGraphView` or `LocalGraphView` without a future migration decision.

K-218 planned a static/read-only preview posture. K-219 defined the fixture direction. K-220 created the static fixture/mock contract.

K-222 through K-224 created and polished the isolated `NotesCosmosStaticPreview`. It remains fixture-driven and isolated.

K-225 through K-227 did not approve normal navigation/runtime panel wiring. K-228 through K-234 produced the viewport/static HTML harness proof path while keeping `NotesCosmosStaticPreview` unwired.

Current product-facing Notes runtime should not be assumed changed by these planning and preview milestones.

## Product Direction

Absinthe should return to:

- Notes/Cosmos surface planning.
- Pixel/Cosmos product identity.
- surface-level clarity before implementation.
- small, reversible UI steps.
- no large graph/routing/persistence jumps.

Absinthe is not generic productivity SaaS. Absinthe is a pixel-cosmos OS for observing personal records over time and meaning.

Notes/Cosmos should express relationship/meaning space, not backup internals. Backup safety remains invisible infrastructure unless separately planned.

Notes/Cosmos should return to product work through calm, readable, local-first surfaces that keep writing and retrieval useful.

## Candidate Notes/Cosmos Surfaces

### Option A: Notes Empty State product polish

Builds on the existing Notes empty state and pixel-cosmos pilot.

Strengths:

- low runtime risk.
- user-visible but contained.
- best for product identity refinement.
- can improve the first-run Notes experience without graph ownership changes.

Risks:

- must not turn every empty/placeholder state into the same cosmos metaphor.
- must preserve the mobile empty-vault behavior and create-note path.

This may be a K-264 prototype plan or implementation candidate after one more boundary audit.

### Option B: Static Preview dev/test surface continuation

Builds on `NotesCosmosStaticPreview`.

Strengths:

- keeps preview isolated.
- useful for visual grammar and QA.
- avoids normal Notes navigation and live data.

Risks:

- not a user-facing product surface yet.
- can stall visible product movement if extended too long.

### Option C: Notes Overview / Signal Panel concept

A product surface showing recent notes, resurfacing signals, and clusters.

Strengths:

- maps well to Notes/Cosmos relationship language.
- may bridge empty state and future runtime surface.

Risks:

- requires careful data boundary.
- higher risk than empty-state polish.
- should be plan/audit before implementation.

### Option D: Cosmos navigation concept spec

Defines navigation metaphor and IA without implementation.

Strengths:

- useful before any route/panel work.
- keeps NoteGraphView and LocalGraphView preserved.

Risks:

- may remain too abstract.
- does not create product-visible progress.

### Option E: Replace or modify NoteGraphView

Not recommended.

Existing graph surfaces are preserved. Replacing or modifying `NoteGraphView` requires a separate migration decision.

### Option F: Runtime Cosmos Map

Not recommended yet.

Runtime Cosmos Map requires graph/canvas/layout/persistence boundaries. It is too large after the backup line and would risk graph ownership, accessibility, mobile behavior, and persistence pressure.

## Chosen Near-term Direction

K-263 chooses K-264 Notes/Cosmos Product Surface Boundary Audit as the primary next path.

Recommended K-264:

K-264 Notes/Cosmos Product Surface Boundary Audit.

Scope:

- docs/audit plus audit test.
- compare Option A Notes Empty State polish versus Option B Static Preview dev/test surface continuation.
- inspect current Notes runtime surfaces.
- choose one implementation candidate.
- preserve graph/runtime/persistence boundaries.
- no implementation.

Alternative K-264:

K-264 Notes Empty State Pixel-Cosmos Product Polish Plan.

Scope:

- docs/plan plus audit test.
- define a small user-visible empty state polish.
- no runtime implementation yet.

Alternative K-264:

K-264 Notes/Cosmos Static Preview Productization Boundary Plan.

Scope:

- docs/plan plus audit test.
- decide if static preview should remain isolated, become a dev/test surface, or become a product teaser.
- no runtime route.

Not recommended for K-264:

- runtime Cosmos Map.
- NoteGraphView replacement.
- LocalGraphView replacement.
- route/panel wiring.
- persistence/schema/spatial metadata.
- canvas/SVG/WebGL graph engine.

## Pixel/Cosmos Visual Grammar Carry-forward

Pixel is grammar, not decoration.

Pixel supports identity and atmosphere. Layout remains information-first. Typography remains readable. Interactions remain productive.

Guiding tone:

- cozy sci-fi.
- pixel observatory.
- personal space archive.
- signal inventory.
- quiet relationship map.

Avoid overdecorated cosmic UI. Avoid replacing functional Notes UX with spectacle. Use small visual tokens, framed panels, signal language, and an observatory inventory feeling.

## Notes/Cosmos Concept Boundary

Notes/Cosmos represents meaning/relationship space.

Archive/Voyager/Time-Distance belongs primarily to Archive. Home Signal Board surfaces current signals. Notes should not become purely timeline/past-distance UI.

Satellite/cosmos metaphor should not make notes unreachable. Cosmos navigation should be framed as observation/navigation, not destructive movement.

Clusters, orbits, signals, and nodes are conceptual/visual language unless a future data model approves otherwise.

## Static Preview Versus Runtime Surface Boundary

Static preview remains fixture-driven unless explicitly changed.

Static preview does not imply live graph data. Static preview does not imply persisted coordinates. Static preview does not imply runtime navigation.

Runtime Notes surface changes require separate scoped implementation. No hidden/default panel without explicit gate. No normal Notes navigation wiring in K-263.

390px/mobile proof remains required before runtime surface exposure.

## Existing Graph Surface Preservation

`NoteGraphView` remains the shipped full-vault graph surface.

`LocalGraphView` remains the local/context graph surface.

Cosmos Map does not replace either surface. K-263 makes no graph builder changes. K-263 adds no `KnowledgeIndexService` coupling. K-263 adds no new graph engine. K-263 adds no persisted spatial metadata.

Any future migration requires an explicit decision.

## Local-first / Backup Guardrails

K-263 carries forward:

- local runtime data remains source of truth.
- no remote-first hydrate/fetch.
- no backup safety UI claims.
- no production preflight claims.
- no restore/import behavior.
- no attachment blob/provider behavior.
- no raw token/content/blob leakage.
- no destructive restore default.
- no silent provider/blob changes.
- no Supabase/OAuth/Google Drive behavior changes.
- no `attachmentMetadataOnly` escalation.

Remote systems remain support layers.

## K-264 Recommendation

Primary recommendation:

K-264 Notes/Cosmos Product Surface Boundary Audit.

Scope:

- docs/audit plus audit test.
- inspect current Notes runtime surfaces.
- compare Notes empty state polish versus static preview continuation.
- choose one implementation candidate.
- preserve graph/runtime/persistence boundaries.
- no implementation.

Alternative:

K-264 Notes Empty State Pixel-Cosmos Product Polish Plan.

Scope:

- docs/plan plus audit test.
- prepare a small user-visible UI polish PR.
- no implementation.

Alternative:

K-264 Notes/Cosmos Static Preview Productization Boundary Plan.

Scope:

- docs/plan plus audit test.
- decide if static preview should remain isolated, become dev/test surface, or product teaser.
- no runtime route.

## Non-goals

- no UI implementation in K-263.
- no route/panel wiring.
- no `NotesCosmosStaticPreview` mounting.
- no normal Notes navigation change.
- no hidden panel.
- no Cosmos Map implementation.
- no graph replacement.
- no `NoteGraphView` change.
- no `LocalGraphView` change.
- no graph builder change.
- no `KnowledgeIndexService` coupling.
- no persistence/schema change.
- no coordinates/orbits/spatial metadata persistence.
- no canvas/SVG/WebGL graph engine.
- no backup/preflight runtime implementation.
- no Data Safety / Backup Health UI.
- no export blocking.
- no restore/import validation.
- no restore preview/dry-run.
- no attachment blob backup.
- no provider-aware recovery.
- no Supabase/OAuth/Google Drive behavior change.
- no Health/Schedule behavior change.
- no assets/fonts/dependencies.

## Closure Statement

K-263 returns Absinthe from backup foundation work to Notes/Cosmos product surface planning.

Backup/preflight guardrails remain carried forward but not productized here.

Existing Notes graph surfaces remain preserved.

Static preview remains isolated unless a future milestone changes it.

K-264 should choose the first small Notes/Cosmos product surface step.

Local runtime data remains source of truth.

Remote systems remain support layers.
