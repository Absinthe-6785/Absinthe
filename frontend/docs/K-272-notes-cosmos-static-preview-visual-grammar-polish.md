# K-272 Notes/Cosmos Static Preview Visual Grammar Polish

## Purpose

K-272 implements the small isolated signal hierarchy polish selected by K-271.

This is an isolated Static Preview component polish. It does not mount `NotesCosmosStaticPreview` into normal Notes runtime, does not add a route/nav/panel, does not implement Runtime Cosmos Map, and does not replace graph surfaces.

## What Changed

`NotesCosmosStaticPreview` now makes fixture signal hierarchy easier to scan:

- header label changed from implementation language to `Read-only signal preview`.
- a static `Signal readout` summarizes the primary signal, secondary signals, and faint signals.
- each node renders a visible `Signal tier` label.
- active anchor/current focus nodes render as `Primary signal`.
- supporting notes, reference notes, and recent context render as `Secondary signal`.
- archive traces render as `Faint signal`.
- hierarchy styling is restrained and paired with literal text, so meaning is not color-only.

## What Remained Unchanged

- K-220 fixture/mock contract remains the only preview data source.
- fixture data remains deterministic.
- no live Notes data is read.
- no Notes stores are read.
- no provider/remote IDs are required.
- no persisted coordinates, orbits, spatial metadata, x/y fields, or layout state were added.
- text fallback remains present and deterministic.
- 390px/mobile expectations remain covered by component-level tests.

## Isolation Boundary

K-272 keeps `NotesCosmosStaticPreview` isolated and unwired:

- no normal Notes navigation wiring.
- no route/nav/panel.
- no hidden/default panel.
- no production runtime exposure.
- no `NoteGraphView` change.
- no `LocalGraphView` change.
- no graph builder change.
- no `KnowledgeIndexService` coupling.
- no Runtime Cosmos Map.
- no graph replacement.

## Local-first / Backup Guardrails

K-272 does not change:

- persistence/schema.
- backup/export/import/restore behavior.
- Data Safety / Backup Health UI.
- attachment blob/provider behavior.
- provider/network/background sync behavior.
- Supabase/OAuth/Google Drive behavior.
- Health/Schedule runtime.
- assets/fonts/dependencies.

## Validation

K-272 validation should include:

- `npm test -- src/components/notes/NotesCosmosStaticPreview.test.ts`
- `npm test -- src/lib/notesCosmosStaticPreviewMockContract.test.ts`
- `npm test -- src/lib/notesCosmosStaticPreviewVisualGrammarPolishPlan.test.ts`
- `npm test -- src/lib/notesCosmosStaticPreviewContinuationPlan.test.ts`
- related Notes/Cosmos audit tests.
- static HTML / viewport harness tests.
- typecheck.
- build.
- `git diff --check`.

Manual/static browser QA is useful through the existing static HTML harness because the component output changed. Generated harness output remains ephemeral and must not be committed.

## Recommended K-273

Recommended next milestone:

**K-273 Notes/Cosmos Static Preview Visual Grammar Polish Closure Audit**

Scope:

- docs/audit plus audit test.
- confirm K-272 remained isolated.
- confirm signal hierarchy polish is literal and not color-only.
- confirm fixture contract and graph surfaces remain preserved.
- confirm generated static HTML artifacts, if used, were not committed.
