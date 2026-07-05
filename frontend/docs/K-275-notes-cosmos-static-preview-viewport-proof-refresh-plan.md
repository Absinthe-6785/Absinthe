# K-275 Notes/Cosmos Static Preview Viewport Proof Refresh Plan

## Purpose

K-275 plans whether Static Preview viewport proof should be refreshed after the K-272 signal hierarchy polish. K-275 is docs/plan plus audit test only.

K-275 does not modify `NotesCosmosStaticPreview`. K-275 does not implement another Static Preview change. K-275 does not generate or commit static harness artifacts. K-275 does not wire Static Preview into runtime. K-275 does not change route/nav/panel behavior. K-275 does not mount `NotesCosmosStaticPreview`. K-275 does not implement Runtime Cosmos Map. K-275 does not replace graph surfaces.

K-275 chooses the K-276 next path while keeping viewport evidence temporary, local, and separate from product runtime exposure.

## Current State Summary

K-270 selected Static Preview continuation as an isolated visual/product grammar track. K-271 planned signal hierarchy polish. K-272 implemented isolated signal readout / hierarchy polish. K-273 closed K-272. K-274 found no blocking accessibility/fallback gap for isolated Static Preview closure.

`NotesCosmosStaticPreview` remains isolated/unwired. Static Preview remains fixture-driven and deterministic. Static Preview does not use live graph data. Static Preview does not read Notes stores. Static Preview does not persist coordinates/orbits/spatial metadata. Static Preview is not mounted in normal Notes navigation.

`NoteGraphView` remains the shipped full-vault graph surface. `LocalGraphView` remains the local/context graph surface. Runtime Cosmos Map is not implemented. Backup/preflight guardrails remain infrastructure and are not productized here.

## Existing Viewport Proof Lineage

K-228 identified the need for real viewport proof because SSR and constrained-wrapper tests do not prove actual browser overflow or clipping.

K-229 audited feasibility and selected a static HTML/render target as the safest no-route proof path.

K-230 planned the static HTML viewport harness.

K-231 specified generator, output, command, CSS, and cleanup expectations.

K-232 implemented the static HTML viewport harness generator at `frontend/scripts/renderNotesCosmosStaticPreview.mjs`.

K-233 closed the generator with no generated HTML committed.

K-234 audited viewport/QA evidence, clarified content-level versus raw attribute-count interpretation, and confirmed the generated artifact lifecycle.

Established principle: generated proof artifacts are temporary and must not be committed.

## Current Viewport Proof Status

The previous viewport proof evidence comes from the K-232 through K-234 static HTML harness line. That evidence includes a generated local HTML artifact, manual 390px browser QA, no horizontal overflow, 10 rendered nodes, 12 rendered relationships, and cleanup before commit.

The previous proof predates K-272. K-272 changed visible layout, hierarchy, labels, grouping, and text by adding the `Signal readout`, primary/secondary/faint signal grouping, and visible `Signal tier` labels.

K-274 accessibility/fallback audit reduced accessibility uncertainty because it confirmed non-color-only hierarchy and meaningful fallback text. It did not remove the viewport proof need because it was audit-only and did not rerun browser/static HTML evidence after the K-272 visual changes.

Current proof is sufficient for isolated component closure, but it is stale for the post-K-272 visual hierarchy. Future runtime exposure would require fresh browser/390px proof regardless.

## Refresh Need Decision

Option A is selected.

Refresh is recommended before closing the Static Preview visual polish line. Reason: K-272 changed enough visual hierarchy/readout structure that 390px/static proof should be refreshed.

K-276 should be a viewport proof refresh/audit PR. This does not mean runtime readiness. It only refreshes evidence for the isolated static harness after visual hierarchy changed.

## Proposed Viewport Proof Scope If Refreshed

K-276 proof should cover:

- 390px/narrow viewport check.
- no horizontal overflow.
- signal readout remains readable.
- primary/secondary/faint hierarchy remains distinguishable.
- `Signal tier` labels remain readable.
- fallback/summary remains present.
- fixture-driven static content renders.
- all 10 nodes render or remain represented in fallback.
- all 12 relationships render or remain represented in fallback.
- no script/svg/canvas artifact unless already expected by harness; current expectation is none.
- no route/nav/panel/runtime mounting.
- no generated artifact committed.
- cleanup confirmed after generation.

## Existing Harness / Command Plan

Existing static HTML generator:

- `frontend/scripts/renderNotesCosmosStaticPreview.mjs`

Existing command:

```powershell
cd frontend
node .\scripts\renderNotesCosmosStaticPreview.mjs
```

POSIX form:

```bash
cd frontend
node scripts/renderNotesCosmosStaticPreview.mjs
```

Expected generated output:

- `frontend/dist/notes-cosmos-static-preview/index.html`

Expected cleanup:

```powershell
Remove-Item -LiteralPath frontend\dist\notes-cosmos-static-preview -Recurse -Force
```

or from `frontend`:

```powershell
Remove-Item -LiteralPath .\dist\notes-cosmos-static-preview -Recurse -Force
```

Generated HTML should be excluded from git because `dist/` is ignored. K-276 must still run `git status --short` after cleanup and confirm no generated output remains.

What counts as proof:

- generator command completed.
- generated output was inspected in a browser or equivalent real layout surface.
- viewport width was set to 390px.
- no horizontal overflow was observed or measured.
- signal readout and fallback content were verified.
- artifact cleanup was confirmed.

What does not count as proof:

- JSDOM or SSR-only assertions.
- reading CSS class names only.
- desktop-only screenshots.
- generated artifact left in the working tree.
- normal app route, hidden panel, or runtime navigation exposure.

## Generated Artifact Policy

Generated static HTML artifacts must be temporary. Generated artifacts must not be committed. Git status must be clean of generated output before commit. Static harness output should be deleted after inspection.

K-276 must not commit generated image assets. K-276 must not commit generated screenshots unless a future PR explicitly scopes them. K-276 must not change package.json, Vite config, Tailwind config, fonts, assets, or dependencies for artifact output.

## Runtime Exposure Boundary

Viewport proof refresh does not imply runtime product readiness. Viewport proof refresh does not imply Static Preview can be mounted.

There must be no normal Notes navigation wiring. There must be no route/nav/panel. There must be no hidden/default panel. There must be no Runtime Cosmos Map. There must be no live Notes data. There must be no Notes store reads. There must be no graph builder coupling. There must be no `KnowledgeIndexService` coupling.

Future runtime exposure requires a separate gate and fresh proof.

## Graph Surface Preservation

`NoteGraphView` remains the full-vault graph. `LocalGraphView` remains the local/context graph. Cosmos Map does not replace either.

K-275 does not alter graph builders. K-275 does not couple to `KnowledgeIndexService`. K-275 does not introduce live graph data into Static Preview. Any future graph migration still requires an explicit decision.

## Backup / Provider Boundary

K-275 introduces no backup/preflight runtime implementation. It introduces no Data Safety / Backup Health UI. It changes no export/import/restore behavior. It adds no restore preview/dry-run. It adds no attachment blob backup. It adds no provider-aware recovery. It changes no Supabase/OAuth/Google Drive behavior. It changes no provider/network/background sync behavior. It changes no attachment blob/provider behavior.

Backup/preflight guardrails remain carried forward but not productized here.

## K-276 Decision

Recommended primary path:

**K-276 Notes/Cosmos Static Preview Viewport Proof Refresh**

Scope:

- run the existing static HTML/viewport harness.
- document proof results.
- do not commit generated artifact.
- no component implementation.
- no runtime wiring.
- may add or update audit doc/test only.

Fallback if command/output/cleanup unexpectedly drift:

**K-276 Notes/Cosmos Static Preview Viewport Proof Command Audit**

Scope:

- docs/audit plus audit test.
- lock exact command/output/cleanup.
- no generated artifact committed.

Alternative if the team decides not to refresh:

**K-276 Notes/Cosmos Static Preview Visual Grammar Closure Audit**

Scope:

- docs/audit plus audit test.
- close current Static Preview visual polish line.
- recommend next product surface planning.

Alternative:

**K-276 Notes/Cosmos Static Preview Fixture Semantics Plan**

Scope:

- docs/plan plus audit test.
- clarify signal/orbit/cluster fixture meaning before further polish.

Not recommended:

- runtime mounting.
- Runtime Cosmos Map.
- graph replacement.
- route/nav/panel.
- live Notes data.
- backup/Data Safety UI.

## Validation Expectations For K-276

If K-276 performs proof refresh:

- run the existing static HTML/viewport command.
- inspect 390px/narrow viewport output.
- document no horizontal overflow.
- document signal readout readability.
- document primary/secondary/faint hierarchy readability.
- delete generated artifact before commit.
- run static preview tests.
- run K-270 through K-275 audit tests.
- run typecheck/build/diff-check.
- confirm no runtime route/nav/panel changes.

If K-276 becomes command audit:

- add doc/source audit test.
- source-facts check generator command/output/cleanup.
- no browser QA required.
- run typecheck/build/diff-check.

If K-276 becomes closure:

- add doc audit test.
- run static preview tests.
- run typecheck/build/diff-check.
- no browser QA required.

## Non-goals

K-275 has these explicit non-goals:

- no NotesCosmosStaticPreview changes in K-275.
- no Static Preview implementation in K-275.
- no generated static harness artifact commit.
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

## Closure Statement

K-275 decides whether viewport proof should be refreshed after K-272 without changing the component. Static Preview remains fixture-driven, deterministic, isolated, and unwired. Accessibility/fallback has no blocking gap for isolated closure from K-274. Generated proof artifacts remain temporary and uncommitted. Viewport proof refresh, if chosen, does not imply runtime readiness. Existing graph surfaces remain preserved. Runtime Cosmos Map and graph replacement remain rejected. Future runtime exposure requires a separate gate and fresh browser/390px proof. Backup/preflight guardrails remain carried forward but not productized here. Local runtime data remains source of truth. Remote systems remain support layers.
