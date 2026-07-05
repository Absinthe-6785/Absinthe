# K-271 Notes/Cosmos Static Preview Visual Grammar Polish Plan

## Purpose

K-271 plans the next isolated Notes/Cosmos Static Preview visual grammar polish.

K-271 is docs/plan plus audit test only. K-271 does not implement UI. K-271 does not implement Static Preview changes. K-271 does not modify `NotesCosmosStaticPreview`. K-271 does not wire Static Preview into runtime. K-271 does not change route/nav/panel behavior. K-271 does not mount `NotesCosmosStaticPreview`. K-271 does not implement Runtime Cosmos Map. K-271 does not replace graph surfaces. K-271 chooses the K-272 next path.

## Current State Summary

K-270 selected Static Preview continuation as the isolated visual/product grammar track.

K-269 closed the Notes Empty State Pixel-Cosmos polish line.

Current state:

- `NotesCosmosStaticPreview` remains isolated/unwired.
- Static Preview remains fixture-driven and deterministic.
- Static Preview does not use live graph data.
- Static Preview does not read Notes stores.
- Static Preview does not persist coordinates/orbits/spatial metadata.
- Static Preview is not mounted in normal Notes navigation.
- `NoteGraphView` remains the shipped full-vault graph surface.
- `LocalGraphView` remains the local/context graph surface.
- Runtime Cosmos Map is not implemented.
- backup/preflight guardrails remain infrastructure and are not productized here.

Source-grounded paths:

- Static Preview component: `frontend/src/components/notes/NotesCosmosStaticPreview.tsx`.
- Static Preview fixture contract: `frontend/src/lib/notesCosmosStaticPreviewMockContract.ts`.
- Static Preview component test: `frontend/src/components/notes/NotesCosmosStaticPreview.test.ts`.
- Full-vault graph: `frontend/src/components/views/NoteGraphView.tsx`.
- Local/context graph: `frontend/src/components/views/features/knowledge/graph/LocalGraphView.tsx`.
- Static HTML viewport harness generator: `frontend/scripts/renderNotesCosmosStaticPreview.mjs`.

## Current Visual Grammar Audit

The current Static Preview is strong as an isolated, readable skeleton.

Preserve:

- semantic `article`, `section`, heading, ordered-list, and list-item structure.
- literal node labels, summaries, kind, status, tone, cluster, and date text.
- literal relationship labels, source/target text, kind, and strength text.
- deterministic text fallback for every node and relationship.
- 10 nodes, 12 relationships, and 3 clusters from the K-220 fixture.
- `positionHint` as fixture-only non-persistent planning metadata.
- responsive wrapping through `max-w-full`, `min-w-0`, and `break-words`.
- no canvas, SVG, WebGL, absolute graph layout, route wiring, or live data.

Current motifs already present:

- clusters: `Writing rhythm`, `Health context`, and `Long memory`.
- node kinds: `note`, `cluster`, `anchor`, `signal`, and `archiveTrace`.
- node tones: `quiet`, `active`, `reference`, and `archival`.
- node statuses: `recent`, `active`, `steady`, and `archived`.
- relationship kinds: `related`, `supports`, `contrasts`, `continues`, and `archives`.
- fixture-only ring/order/density language in `positionHint`.
- read-only fixture and 390px/mobile acceptance copy in the header.

Current product state communicated:

- this is a static preview concept, not a shipped Notes navigation surface.
- the preview is a deterministic fixture, not live Notes data.
- the content is a future product direction artifact, not a real Cosmos Map.
- fallback/list readability matters as much as visual tone.

Current weakness:

- the preview reads more like a neutral inventory table than a designed product grammar.
- `Kind`, `Status`, and `Tone` chips are useful but generic.
- signal importance is present in fixture data but not strongly expressed in hierarchy.
- orbit/cluster language exists as text but not as a clear visual system.
- relationship rows are readable but secondary and somewhat flat.
- the header label `Isolated static preview skeleton` is accurate but concept-heavy.
- the preview can feel like a test artifact before it feels like a product direction.

K-271 conclusion:

- improve information structure first, not decoration.
- choose a tiny polish that clarifies signal hierarchy while keeping the existing fixture, fallback, and isolation contract.

## Visual Grammar Polish Candidates

### Candidate 1: Signal hierarchy polish

Clarify primary signal, secondary signals, faint/background signals, and archive traces.

Benefits:

- improves information hierarchy.
- makes `anchor`, `signal`, `active`, `reference`, and `archival` states easier to scan.
- keeps existing fixture data unchanged.
- avoids pure decoration.
- can be implemented as small component copy/class/hierarchy polish.

Risks:

- could become color-only if not paired with literal labels.
- could overemphasize visual tone and weaken fallback parity.

Decision:

- recommended K-272 path.

### Candidate 2: Orbit/cluster language polish

Clarify cluster grouping, relationship lines, and orbital framing without implying persisted coordinates or live graph state.

Benefits:

- strengthens Cosmos concept language.
- gives ring/order/density better meaning.

Risks:

- can imply saved spatial metadata.
- can drift toward Runtime Cosmos Map too quickly.
- may require larger visual work than K-272 should carry.

Decision:

- useful later, but not first.

### Candidate 3: Observatory/inventory framing polish

Strengthen pixel observatory / personal archive feeling with calmer panel labels, legend, and readout language.

Benefits:

- improves product identity.
- can keep the preview quiet and reference-oriented.

Risks:

- easy to become overdecorated sci-fi.
- could add lore noise instead of clarity.

Decision:

- secondary to signal hierarchy.

### Candidate 4: Accessibility/fallback polish

Improve text fallback, semantic labels, readable summary, keyboard/readability expectations, and screen-reader confidence.

Benefits:

- safest accessibility-first path.
- reinforces text/list fallback as the source of truth.

Risks:

- less visible product identity gain.
- current fallback is already relatively strong.

Decision:

- choose this only if K-272 source review finds a concrete fallback defect.

### Candidate 5: Viewport/390px proof refresh

Update static HTML or wrapper-level viewport proof if existing evidence is stale.

Benefits:

- useful before runtime exposure discussion.
- keeps 390px/mobile evidence honest.

Risks:

- does not improve product grammar by itself.
- can become process-heavy without a visual change to validate.

Decision:

- required after a K-272 implementation changes the rendered preview, but not the primary K-272 purpose.

### Candidate 6: Runtime mounting / product route

Mount the preview into runtime Notes.

Decision:

- not recommended.
- requires a separate gate.
- too early.

### Candidate 7: Runtime Cosmos Map / graph replacement

Implement or replace graph surfaces with Runtime Cosmos Map.

Decision:

- explicitly rejected.

## Side-by-side Comparison

| Criterion | Signal hierarchy polish | Orbit/cluster polish | Observatory/inventory framing | Accessibility/fallback polish | Viewport proof refresh | Runtime mounting | Runtime Cosmos Map / graph replacement |
| --- | --- | --- | --- | --- | --- | --- | --- |
| product identity gain | High and bounded. | High but concept-heavy. | Medium to high. | Medium. | Low. | High but premature. | High conceptually, too risky. |
| information clarity | High. | Medium to high. | Medium. | High. | Medium evidence value. | Depends on runtime placement. | Unknown and broad. |
| implementation risk | Low if component-only. | Medium because orbit language can imply layout state. | Low to medium. | Low. | Low if docs/harness only. | High. | Very high. |
| runtime coupling | None if isolated. | None if isolated. | None if isolated. | None if isolated. | None. | Direct runtime coupling. | Deep runtime coupling. |
| fixture contract risk | Low. | Medium if ring/order/density semantics change. | Low. | Low. | Low. | Medium. | High. |
| accessibility value | Medium if labels remain literal. | Medium. | Medium. | High. | Medium. | High burden. | High burden. |
| responsive/mobile QA need | Required if implemented. | Required if implemented. | Required if implemented. | Required if rendering changes. | Primary purpose. | Required. | Required and broad. |
| graph/persistence risk | Low. | Medium if spatial language expands. | Low. | Low. | Low. | Medium. | High. |
| reversibility | Excellent. | Good. | Good. | Excellent. | Excellent. | Lower. | Low. |
| suitability for K-272 | Best. | Later. | Later or small copy layer. | Alternative if fallback is defective. | Validation companion. | Not recommended. | Rejected. |

## Recommended K-272 Path

Primary recommendation:

**K-272 Notes/Cosmos Static Preview Visual Grammar Polish**

Scope:

- small isolated component implementation.
- refine signal hierarchy only.
- keep fixture-driven.
- keep deterministic.
- keep isolated/unwired.
- no runtime mounting.
- no route/nav/panel.
- no live data.
- no graph/store/persistence changes.
- preserve fallback/accessibility.
- include static preview tests and responsive validation.
- requires Codex 5.5 high.

Recommended K-272 implementation shape:

- clarify the header so it reads as a read-only preview artifact, not a shipped route.
- make the active anchor/current signal more visually legible without hiding literal text.
- make secondary/reference/archive traces quieter without shrinking content below readability.
- preserve `Kind`, `Status`, and `Tone` or replace them only with equally literal labels.
- keep relationship and fallback sections present and readable.
- avoid canvas/SVG/WebGL and avoid any coordinate-based layout.

Alternatives:

- **K-272 Notes/Cosmos Static Preview Accessibility/Fallback Audit** if fallback uncertainty becomes the main blocker.
- **K-272 Notes/Cosmos Static Preview Visual Grammar Fixture Spec** if fixture semantics need tightening before component polish.
- **K-272 Notes/Cosmos Static Preview Viewport Proof Refresh Plan** if viewport evidence is the main missing proof.

Not recommended:

- runtime mounting.
- Runtime Cosmos Map.
- graph replacement.
- route/nav/panel.
- live notes data.
- backup/Data Safety UI.

## K-272 Visual Polish Boundaries

If K-272 implements visual polish:

- touch only `NotesCosmosStaticPreview` and directly related isolated tests.
- keep fixture-driven.
- keep deterministic.
- keep isolated/unwired.
- no normal Notes navigation.
- no route/nav/panel.
- no live graph data.
- no Notes store reads.
- no graph builders.
- no `KnowledgeIndexService`.
- no Notes persistence/schema changes.
- no persisted coordinates/spatial metadata.
- no canvas/SVG/WebGL engine unless separately approved.
- preserve fallback/accessibility.
- preserve 390px/mobile proof expectations.
- no backup/preflight claims.
- no assets/fonts/dependencies.

## Product Grammar Acceptance Criteria

- pixel is grammar, not decoration.
- information-first layout.
- readable typography.
- productive interactions.
- native accessibility and semantics remain first-class.
- cozy sci-fi / pixel observatory / personal space archive tone.
- visual hierarchy should make signal importance clearer.
- orbit/cluster language should clarify relationships, not imply hidden live data.
- observatory/readout language should help understanding, not add lore noise.
- avoid overdecorated cosmic UI.
- avoid generic AI SaaS look.
- do not hide core Notes ideas behind spectacle.
- visual preview should clarify future product direction, not imply shipped navigation.
- fallback text remains the literal readable equivalent of the visual preview.

## Static Preview / Runtime Boundary

- `NotesCosmosStaticPreview` remains isolated unless a future milestone explicitly mounts it.
- static fixture remains deterministic.
- no live note graph.
- no persisted coordinates/orbits/spatial metadata.
- no hidden/default panel.
- no normal Notes navigation wiring.
- runtime surface changes require a separate gate.
- 390px/mobile proof required before runtime exposure.
- dev/test surface, if ever considered, requires separate plan.

## Existing Graph Surface Preservation

- `NoteGraphView` remains full-vault graph.
- `LocalGraphView` remains local/context graph.
- Cosmos Map does not replace either.
- K-272 must not alter graph builders.
- K-272 must not couple to `KnowledgeIndexService`.
- K-272 must not introduce live graph data into static preview.
- any future graph migration requires explicit decision.

## Fixture Contract Preservation

- K-220 fixture/mock contract remains the source for preview data.
- no new persisted spatial metadata.
- no x/y coordinate persistence unless separately approved.
- no live note IDs required.
- no remote/provider IDs required.
- fixture semantics may be clarified only in docs/spec unless K-272 explicitly scopes fixture changes.
- fixture changes, if any, must remain deterministic and test-only/preview-only.

## Local-first / Backup Guardrails

K-271 carries forward:

- local runtime data remains source of truth.
- no remote-first hydrate/fetch.
- no production backup/preflight claims.
- no Data Safety / Backup Health UI.
- no restore/import behavior.
- no attachment blob/provider behavior.
- no raw token/content/blob leakage.
- no destructive restore default.
- no silent provider/blob changes.
- no Supabase/OAuth/Google Drive behavior changes.
- no `attachmentMetadataOnly` escalation.

Remote systems remain support layers.

## Validation Expectations For K-272

If K-272 implements Static Preview visual polish:

- static preview component tests.
- fixture contract tests if touched.
- fallback/accessibility assertions where possible.
- 390px/static HTML or wrapper-level responsive validation if existing.
- no runtime import/wiring source audit.
- typecheck/build.
- no route/navigation diffs.
- no graph/store/persistence diffs.
- no backup/export/import diffs.

If K-272 remains plan/audit-only:

- doc/source audit test.
- source-facts check for isolation where useful.
- typecheck/build.
- no browser QA required.

## Non-goals

- no UI implementation in K-271.
- no Static Preview implementation in K-271.
- no `NotesCosmosStaticPreview` changes.
- no Static Preview runtime wiring.
- no route/nav/panel change.
- no `NotesCosmosStaticPreview` mounting.
- no hidden panel.
- no Runtime Cosmos Map implementation.
- no graph replacement.
- no `NoteGraphView` change.
- no `LocalGraphView` change.
- no graph builder change.
- no `KnowledgeIndexService` coupling.
- no live Notes data integration.
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

K-271 chooses signal hierarchy as the next isolated Static Preview visual grammar polish direction without implementing it.

Static Preview remains fixture-driven, deterministic, isolated, and unwired.

Empty-state polish remains closed.

Existing graph surfaces remain preserved.

Runtime Cosmos Map and graph replacement remain rejected.

K-272 should remain small, isolated, and reversible.

Backup/preflight guardrails remain carried forward but not productized here.

Local runtime data remains source of truth.

Remote systems remain support layers.
