# K-281 Notes Overview / Signal Panel Component Boundary Plan

## Purpose

K-281 defines the component boundary for a future Notes Overview / Signal Panel. K-281 follows the K-280 data contract plan, which defined a draft recent notes plus active writing data contract in documentation only.

K-281 is docs/plan plus audit test only. K-281 does not implement UI. K-281 does not create runtime types/exports. K-281 does not wire runtime data. K-281 does not add route/nav/panel behavior. K-281 does not create a data adapter. K-281 does not change stores, schemas, persistence, providers, sync, graph builders, backup, or BlockEditor internals.

K-281 chooses the K-282 next path: Notes Overview / Signal Panel Contract Fixture Spec.

## Current State Summary

K-278 defined Notes Overview / Signal Panel as a concept-only product surface. Signal Panel remains an orientation/readout surface, not Cosmos Map, not a graph replacement, not backup/Data Safety UI, and not Archive Voyager.

K-279 audited local-first data boundaries for a future Signal Panel MVP. K-279 approved only future local-note metadata plus simple active-note orientation as safe first boundaries.

K-280 defined a draft recent notes plus active writing data contract in docs only. K-280 did not add runtime type/export. K-280 did not implement UI. K-280 did not wire runtime data. K-280 did not change stores, schemas, persistence, providers, graph, backup, or editor internals.

The Empty State line remains closed. `NotesPixelCosmosEmptyState` remains the productized empty-vault Notes/Cosmos surface, and Empty State remains primary when no notes exist.

The Static Preview line remains closed. `NotesCosmosStaticPreview` remains fixture-driven, deterministic, isolated, unwired, and not product data.

`NoteGraphView` remains the shipped full-vault graph surface. `LocalGraphView` remains the local/context graph surface. Runtime Cosmos Map is not implemented. Backup/preflight guardrails remain infrastructure and are not productized here.

## Component Boundary Principles

The future Signal Panel component should be:

- props-first.
- deterministic from passed props.
- presentational by default.
- isolated before any runtime mount.
- accessible through semantic grouping.
- responsive by default.
- explicit about empty and unavailable states.
- readable without raw note content.

The future component must not:

- read global stores directly.
- create a runtime data adapter inside the component.
- call provider/network APIs.
- read backup/preflight diagnostics.
- read graph builders.
- read `KnowledgeIndexService`.
- read BlockEditor internals.
- inspect raw note body/content.
- mutate persistence.
- mutate Notes stores.
- mount itself into normal Notes runtime.

Mounting requires a later explicit gate and fresh browser/390px QA.

## Proposed Component Role

Provisional component name:

```ts
NotesOverviewSignalPanel
```

Alternative shorter name:

```ts
NotesSignalPanel
```

Role:

- render recent notes signal readout.
- render active writing signal readout.
- render empty/unavailable states.
- communicate orientation, not graph intelligence.
- help users return to writing and thinking.
- avoid dashboard bloat.
- avoid duplicate Empty State onboarding.
- avoid Cosmos Map implications.
- avoid graph replacement implications.

Status:

- name is provisional.
- no component is created in K-281.
- no runtime export is created in K-281.
- no runtime type is created in K-281.

## Proposed Props Boundary

Documentation-only sketch:

```ts
type NotesSignalPanelProps = {
  data: SignalPanelDataDraft;
  onSelectRecentNote?: (noteId: string) => void;
  onCreateNote?: () => void;
};
```

Boundary rules:

- `data` follows the K-280 draft contract.
- props are plain serializable data plus optional callbacks.
- callbacks are optional and may be deferred.
- first isolated implementation may be read-only.
- no navigation behavior should be assumed.
- no callbacks should be wired until mount/routing is approved.
- no store object.
- no service object.
- no graph object.
- no provider client.
- no editor instance.
- no BlockEditor object.
- no backup/preflight object.
- no raw note object.
- no raw folder object.

## Read-only First Recommendation

The first component prototype should be read-only.

Do not include:

- create callbacks unless explicitly scoped.
- select callbacks unless explicitly scoped.
- route/navigation behavior.
- panel mounting.
- editor coupling.
- persistence mutation.
- analytics.
- provider calls.

Reason:

- keeps component isolated.
- allows visual and semantic testing.
- avoids route/nav/data-wiring risk.
- preserves the K-280 contract boundary.
- allows a fixture-first proof before product runtime exposure.

## Semantic Structure Plan

The future component should render:

- a panel heading.
- a short orientation summary.
- a recent notes group.
- an active writing group.
- an empty/unavailable fallback group.
- source/fixture status if using fixtures.
- accessible labels for signal tiers.
- primary/secondary/faint hierarchy through text and structure.

Semantic expectations:

- use sections or grouped regions with readable headings.
- expose signal meaning as text, not color-only.
- no essential information should be purely visual.
- recent note titles must remain readable.
- active writing state must be literal.
- empty/unavailable state must be literal.
- content must remain readable at narrow viewport.
- actions, if later added, must be native controls.

## Empty / Unavailable Display Boundary

True empty vault should defer to Empty State. Signal Panel should not duplicate full Empty State onboarding.

If the future isolated component is rendered with an empty fixture, it should show a minimal unavailable/empty note, not the full first-note onboarding surface.

Rules:

- active writing unavailable is valid.
- recent notes unavailable is valid.
- unavailable states should not fake signals.
- loading should not imply remote/provider fetch.
- error should not imply backup/provider failure.
- empty copy should not add competing CTAs.
- unavailable copy should be calm, specific, and accessible.

## Visual / Product Grammar Boundary

The future component should follow the Pixel/Cosmos grammar already established by recent planning without becoming decorative spectacle:

- pixel is grammar, not decoration.
- information-first layout.
- readable typography.
- native accessibility.
- signal hierarchy: primary/secondary/faint.
- signal/readout language clarifies state.
- cozy sci-fi / pixel observatory / personal archive tone.
- avoid overdecorated cosmic UI.
- avoid generic AI SaaS look.
- do not hide writing actions behind spectacle.
- do not imply Cosmos Map.
- do not imply graph intelligence before graph/index audit.

## Fixture And Test Strategy

Future testing should start with deterministic fixtures based on the K-280 contract.

Recommended fixture set:

- recent notes fixture with 2-4 items.
- active writing active fixture.
- active writing idle fixture.
- active writing unavailable fixture.
- empty/unavailable fixture.
- untitled recent note fixture for title fallback behavior.
- forbidden-fields-absent fixture check.

Recommended tests:

- render tests for panel heading.
- render tests for orientation summary.
- render tests for recent notes group.
- render tests for active writing group.
- render tests for empty/unavailable group.
- render tests for source/fixture status if shown.
- render tests for title fallback behavior.
- render tests that raw body/provider/graph/backup fields are absent.
- render tests that essential meaning is text/structure based, not color-only.
- wrapper-level 390px/static proof before runtime exposure.

Browser QA is not required until UI implementation or runtime mount. Generated static proof artifacts must not be committed.

## Runtime Placement Boundary

K-281 approves no runtime placement.

Forbidden in K-281 and still forbidden until a later explicit milestone:

- normal Notes runtime mount.
- route/nav/panel.
- normal Notes navigation change.
- hidden/default panel.
- `NoteView.tsx` insertion.
- `NoteViewEditorArea.tsx` insertion.
- product runtime exposure.
- Static Preview runtime mounting.
- graph surface replacement.

Future mount requires:

- separate K milestone.
- source-grounded adapter or fixture boundary.
- browser/390px QA.
- accessibility review.
- no unexpected route/nav/panel/store/schema changes.

The first implementation, if any, should remain isolated and unmounted.

## Data Adapter Boundary

K-281 does not create an adapter.

Future adapter principles:

- adapter should be separate from the presentational component.
- adapter must be audited before runtime wiring.
- adapter must use K-280 allowed fields only.
- adapter must not query graph builders.
- adapter must not query `KnowledgeIndexService`.
- adapter must not query provider/sync state.
- adapter must not query backup/preflight diagnostics.
- adapter must not inspect BlockEditor internals.
- adapter must not mutate stores.
- adapter must not mutate persistence.
- adapter must be deterministic and local-first.
- adapter must output the props contract, not raw store objects.

## Relationship To Existing Surfaces

### Empty State

Empty State remains primary for empty vault. Signal Panel should not duplicate full empty-vault onboarding.

### Static Preview

Static Preview remains an isolated concept artifact. Signal Panel does not reuse, mount, or depend on `NotesCosmosStaticPreview`.

### NoteGraphView

`NoteGraphView` remains the full-vault graph. Signal Panel does not replace it and does not depend on its implementation details.

### LocalGraphView

`LocalGraphView` remains the local/context graph. Signal Panel does not replace it and does not depend on its implementation details.

### Home Signal Board

Home Signal Board is a broader cross-surface concept. Signal Panel remains Notes-scoped orientation/readout.

### Archive Voyager

Archive Voyager remains a time-distance/archive concept. Signal Panel should not become an archive resurfacing surface without a separate audit.

## K-282 Decision

Recommended primary path:

**K-282 Notes Overview / Signal Panel Contract Fixture Spec**

Scope:

- docs/spec plus audit test.
- define deterministic fixture for future isolated component.
- define active, idle, unavailable, and empty fixture cases.
- define forbidden fixture fields.
- no implementation.
- no runtime wiring.

Alternative:

**K-282 Notes Overview / Signal Panel Isolated Component Plan**

Scope:

- docs/plan plus audit test.
- define exact file/test names and implementation acceptance criteria before coding.
- no implementation.

Alternative if ready for implementation:

**K-282 Notes Overview / Signal Panel Isolated Component Skeleton**

Scope:

- small component implementation.
- fixture-driven props only.
- read-only.
- no runtime mount.
- no data adapter.
- requires Codex 5.5 high.

Not recommended:

- immediate runtime mounting.
- route/nav/panel.
- adapter plus component in the same PR.
- graph/KIS/provider/backup integration.
- Runtime Cosmos Map.

## Non-goals

K-281 has these explicit non-goals:

- no Signal Panel UI implementation in K-281.
- no Notes Overview component.
- no Signal Panel component.
- no runtime type/export.
- no runtime data wiring.
- no data adapter.
- no route/nav/panel change.
- no NoteView changes.
- no NoteViewEditorArea changes.
- no noteUtils changes.
- no noteListSort changes.
- no noteDisplayTitle changes.
- no Notes store changes.
- no persistence/schema change.
- no NotesCosmosStaticPreview changes.
- no Empty State changes.
- no Runtime Cosmos Map implementation.
- no graph replacement.
- no NoteGraphView change.
- no LocalGraphView change.
- no graph builder change.
- no KnowledgeIndexService coupling.
- no live graph/index integration.
- no provider/network/background sync.
- no Supabase/OAuth/Google Drive behavior change.
- no backup/preflight runtime implementation.
- no Data Safety / Backup Health UI.
- no export/import/restore behavior change.
- no attachment blob/provider behavior.
- no BlockEditor internals.
- no Health/Schedule behavior change.
- no assets/fonts/dependencies.
- no generated artifacts.

## Closure Statement

K-281 defines a props-first component boundary only. K-281 does not implement or mount Signal Panel. A future component should be isolated, read-only first, and deterministic from K-280 contract data.

Adapter/runtime wiring must be separate and later. Graph/KIS/provider/backup/BlockEditor internals remain forbidden. Signal Panel remains orientation/readout, not Cosmos Map or graph replacement.

Existing graph surfaces remain preserved. Empty State and Static Preview lines remain closed. Local runtime data remains source of truth. Remote systems remain support layers.
