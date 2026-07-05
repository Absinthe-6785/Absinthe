# K-274 Notes/Cosmos Static Preview Accessibility/Fallback Audit

## Purpose

K-274 audits accessibility and fallback strength after the K-272 Static Preview visual grammar polish. K-274 is docs/audit plus audit test only.

K-274 does not modify `NotesCosmosStaticPreview`. K-274 does not implement another Static Preview change. K-274 does not wire Static Preview into runtime. K-274 does not change route/nav/panel behavior. K-274 does not mount `NotesCosmosStaticPreview`. K-274 does not implement Runtime Cosmos Map. K-274 does not replace graph surfaces.

K-274 chooses the K-275 next path while keeping the Static Preview line isolated, deterministic, accessible, and reversible.

## Current State Summary

K-270 selected Static Preview continuation as an isolated visual/product grammar track. K-271 planned signal hierarchy polish. K-272 implemented isolated signal readout / hierarchy polish. K-273 closed K-272 with a docs/audit plus source-facts closure audit.

`NotesCosmosStaticPreview` remains isolated/unwired. Static Preview remains fixture-driven and deterministic. Static Preview does not use live graph data. Static Preview does not read Notes stores. Static Preview does not persist coordinates/orbits/spatial metadata. Static Preview is not mounted in normal Notes navigation.

`NoteGraphView` remains the shipped full-vault graph surface. `LocalGraphView` remains the local/context graph surface. Runtime Cosmos Map is not implemented. Backup/preflight guardrails remain infrastructure and are not productized here.

## Accessibility / Fallback Audit

Fallback text remains present. Fallback text remains meaningful because it lists deterministic node order, relationship order, node labels, summaries, dates, source IDs, and target IDs. Semantic grouping remains preserved through `article`, `section`, heading, ordered-list, and list-item structure.

Essential information is not visual-only. The signal readout can be understood through text/structure, not only color. Readable typography expectations remain preserved through text-first rendering, wrapping classes, and compact non-interactive copy. Keyboard/readability expectations remain intact because the preview does not introduce buttons, links, canvas controls, hidden panels, or graph application roles.

No hidden runtime interaction is implied. No core Notes action is hidden behind visual spectacle. The preview remains a read-only static fixture, not an interactive product workflow.

## Signal Hierarchy Non-color-only Audit

The primary signal is represented through source-visible text, label, data attribute, and grouping. The current source renders `Primary signal`, `Signal tier: Primary signal`, the primary node label, a primary description, and `data-signal-tier="primary"`.

Secondary/supporting signals are represented through source-visible text, label, data attribute, and grouping. The current source renders `Secondary signals`, `Signal tier: Secondary signal`, supporting count text, supporting descriptions, and `data-signal-tier="secondary"`.

Faint/background signals are represented through source-visible text, label, data attribute, and grouping. The current source renders `Faint signals`, `Signal tier: Faint signal`, archive trace count text, archive descriptions, and `data-signal-tier="faint"`.

`data-signal-tier` exists as a source-visible non-color-only marker. The hierarchy does not rely only on color. The hierarchy remains meaning-bearing, not ornamental-only. The signal readout does not imply live graph data or shipped runtime navigation.

## Fallback Content Audit

The fallback content includes:

- a fallback title.
- a fallback description.
- a mobile fallback note that names the 390px readable-text expectation.
- deterministic node order.
- node fallback summaries with labels, summaries, statuses, and dates.
- deterministic relationship order.
- relationship fallback summaries with labels, source IDs, and target IDs.

Fallback covers the same conceptual information as the visual preview: the current anchor, supporting notes, archive traces, clusters, relationships, status/tone context, and deterministic reading order. The fallback mentions fixture/preview status through `Text fallback`, `Read-only fixture`, and the K-220 static fixture language.

Fallback avoids claiming live graph/runtime features. Fallback avoids backup/Data Safety claims. No blocking fallback gap was found. A future accessibility polish could improve narrative summary strength, but it is not required before the next audit/planning step.

## Semantic Structure Audit

The source keeps a semantic top-level `article` labelled by the preview title. Signal readout is grouped in a labelled `section` with `aria-label="Static signal hierarchy readout"`. Nodes and relationships are grouped under headings. Cluster groups use sections with labelled headings. Node and relationship collections use ordered lists.

The relationship between labels and visual signal elements is source-visible: each node renders literal kind, status, tone, signal tier, summary, cluster, created date, and freshness. Screen-reader-readable text exists for key preview concepts through visible labels and plain text. Status/tier labels are machine- or source-readable through `data-node-status`, `data-node-tone`, and `data-signal-tier`.

Visual-only ornaments are avoided for essential meaning. Borders, backgrounds, and contrast support hierarchy, but the essential meaning remains in text, grouping, and data attributes.

## Responsive / Viewport Audit

390px/mobile expectations remain preserved through the fixture responsive acceptance contract and K-272 component tests. No source-obvious horizontal overflow risk was introduced by K-272 because the component continues to use text-first wrapping, `break-words`, `min-w-0`, `max-w-full`, and single-column responsive grids at narrow widths.

Static HTML / viewport harness artifact is not committed. Browser visual QA was not rerun for K-273. K-274 is audit-only, so browser visual QA is not required because no source-grounded accessibility/viewport blocker was found. Future runtime exposure would require fresh browser/390px proof.

## Isolation / Runtime Wiring Audit

`NotesCosmosStaticPreview` remains isolated. There is no normal Notes navigation wiring. There is no route/nav/panel. There is no hidden/default panel. There is no production runtime exposure. There is no Runtime Cosmos Map. There is no live Notes data. There are no Notes store reads. There is no graph builder coupling. There is no `KnowledgeIndexService` coupling. There is no provider/network/background sync.

## Graph Surface Preservation Audit

`NoteGraphView` remains the full-vault graph. `LocalGraphView` remains the local/context graph. Cosmos Map does not replace either.

K-274 does not alter graph builders. K-274 does not couple to `KnowledgeIndexService`. K-274 does not introduce live graph data into Static Preview. Any future graph migration still requires an explicit decision.

## Backup / Provider Boundary Audit

K-274 introduces no backup/preflight runtime implementation. It introduces no Data Safety / Backup Health UI. It changes no export/import/restore behavior. It adds no restore preview/dry-run. It adds no attachment blob backup. It adds no provider-aware recovery. It changes no Supabase/OAuth/Google Drive behavior. It changes no provider/network/background sync behavior. It changes no attachment blob/provider behavior.

Backup/preflight guardrails remain carried forward but not productized here.

## Validation Audit

Validation status carried forward from K-273/K-272:

- K-273 audit/source checks passed.
- K-272 component/static preview tests passed.
- K-270/K-271/K-273 doc/audit tests passed.
- related Notes/Cosmos guard tests passed.
- related graph/export/import/restore guard tests passed.
- typecheck/build passed.
- `git diff --check` passed.
- no generated static harness artifact was committed.
- full test passed in the K-273 closure line.

K-274 validation should run:

- `npm test -- src/lib/notesCosmosStaticPreviewAccessibilityFallbackAudit.test.ts`
- `npm test -- src/lib/notesCosmosStaticPreviewVisualGrammarPolishClosureAudit.test.ts`
- `npm test -- src/components/notes/NotesCosmosStaticPreview.test.ts`
- `npm test -- src/lib/notesCosmosStaticPreviewVisualGrammarPolishPlan.test.ts`
- `npm test -- src/lib/notesCosmosStaticPreviewContinuationPlan.test.ts`
- related Notes/Cosmos doc/audit tests where practical.
- related graph/export/import/restore guard tests where practical.
- `npm run typecheck`
- `npm run build`
- `git diff --check`

Manual browser QA is not required for K-274 because K-274 has no UI/browser runtime changes.

## Accessibility / Fallback Gap Decision

Option A is selected.

No blocking accessibility/fallback gap was found. K-275 may move to viewport proof refresh plan or fixture semantics plan.

The only remaining accessibility/fallback follow-up is non-blocking: future polish could strengthen narrative fallback wording before any runtime exposure. That follow-up does not need implementation in K-274.

## K-275 Decision

Recommended primary path:

**K-275 Notes/Cosmos Static Preview Viewport Proof Refresh Plan**

Scope:

- docs/plan plus audit test only.
- decide whether to refresh static HTML/390px proof after the visual polish.
- no component implementation.
- no runtime wiring.

Alternative if accessibility gap becomes blocking:

**K-275 Notes/Cosmos Static Preview Accessibility/Fallback Polish Plan**

Scope:

- docs/plan plus audit test.
- define one small follow-up before implementation.
- no component changes yet.

Other alternatives:

- **K-275 Notes/Cosmos Static Preview Fixture Semantics Plan** if signal/orbit/cluster fixture meanings need stronger semantics before more polish.
- **K-275 Notes/Cosmos Static Preview Visual Grammar Closure Audit** if the Static Preview visual polish line should pause.

Not recommended:

- runtime mounting.
- Runtime Cosmos Map.
- graph replacement.
- route/nav/panel.
- live Notes data.
- backup/Data Safety UI.

## Non-goals

K-274 has these explicit non-goals:

- no NotesCosmosStaticPreview changes in K-274.
- no Static Preview implementation in K-274.
- no Static Preview runtime wiring.
- no route/nav/panel change.
- no NotesCosmosStaticPreview mounting.
- no hidden panel.
- no Runtime Cosmos Map implementation.
- no graph replacement.
- no NoteGraphView change.
- no LocalGraphView change.
- no graph builder change.
- no KnowledgeIndexService coupling.
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
- no generated static harness artifact commit.

## Closure Statement

K-274 audits accessibility and fallback after K-272/K-273 without changing the component. Static Preview remains fixture-driven, deterministic, isolated, and unwired. Signal hierarchy remains meaning-bearing and not color-only. Fallback/accessibility and 390px expectations remain preserved with no blocking gap. Existing graph surfaces remain preserved. Runtime Cosmos Map and graph replacement remain rejected. Future runtime exposure requires a separate gate and fresh browser/390px proof. Backup/preflight guardrails remain carried forward but not productized here. Local runtime data remains source of truth. Remote systems remain support layers.
