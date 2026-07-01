# K-233 Notes/Cosmos Static HTML Viewport Harness Closure Audit

## Purpose

K-233 closes the K-232 static HTML viewport harness generator milestone.

K-233 is docs/audit only.

K-233 does not expand the generator.

K-233 does not add route, panel, hidden panel, Sidebar, `TabId`, `AppContent`, or normal Notes runtime wiring.

K-233 verifies generator safety, artifact hygiene, generated HTML safety, and viewport QA evidence.

K-233 separates harness closure from any future product placement decision.

## Current State Summary

K-220 added the mock fixture contract used by the Notes/Cosmos static preview.

K-222 added the isolated `NotesCosmosStaticPreview` component skeleton.

K-224 completed polish, mobile fallback, and accessibility hardening for the isolated skeleton.

K-227 blocked route/panel implementation because a safe dev/test viewing convention was not proven.

K-228, K-229, K-230, and K-231 led to the static HTML viewport harness generator plan.

K-232 implemented the static HTML viewport harness generator.

`NotesCosmosStaticPreview` remains unwired.

No normal Notes navigation connection exists.

No hidden experimental panel exists.

No live graph data or user note data is used.

`NoteGraphView` and `LocalGraphView` remain preserved.

`ProductEmptyState` and `NotesPixelCosmosEmptyState` remain preserved.

K-220 fixture-only input remains the only approved input for the static preview harness.

## K-232 Generator Audit

Generator path:

- `frontend/scripts/renderNotesCosmosStaticPreview.mjs`

Command:

```powershell
cd frontend
node scripts/renderNotesCosmosStaticPreview.mjs
```

Output path:

- `frontend/dist/notes-cosmos-static-preview/index.html`

Render strategy:

- React `renderToStaticMarkup`.
- Vite `ssrLoadModule`.

CSS strategy:

- minimal inline structural CSS.
- no full app visual parity claim.
- no Tailwind config change.
- no global CSS/theme change.
- no assets, fonts, or dependencies.

Artifact policy:

- generated output is ephemeral.
- generated HTML is not committed.
- generated output remains under ignored `dist/`.

Cleanup commands:

```powershell
Remove-Item -Recurse -Force .\dist\notes-cosmos-static-preview
```

```bash
rm -rf dist/notes-cosmos-static-preview
```

Package/tooling status:

- `package.json`: unchanged.
- `vite.config.ts`: unchanged.
- no npm script added.
- no browser automation dependency added.
- no Storybook/Cypress/Playwright addition.

Generator status:

- dev/test-only.
- not a runtime app route.
- output is ephemeral.
- output is not committed.

## Generated HTML Safety Audit

K-232 generated HTML safety checks record:

- Dev/Test Harness label present.
- `Not a runtime app route` text present.
- rendered preview present.
- 10 nodes rendered.
- 12 relationships rendered.
- fallback/list content present.
- tone/kind/status/cluster text present.
- script-tags=0.
- svg-tags=0.
- canvas-tags=0.
- no app route/nav/sidebar shell.
- no normal Notes navigation controls.
- no live notes or user data.
- no Supabase/OAuth/attachment behavior.
- no Google Drive behavior.
- no `KnowledgeIndexService` usage.
- no graph builder usage.
- no production Cosmos Map claim.
- no app bundle references are required for the static HTML artifact.

## Artifact Hygiene Audit

Generated artifact status:

- K-232 created the generated artifact during validation.
- K-232 removed the generated artifact after browser QA.
- K-233 may create the generated artifact during validation, but it must be removed before commit.
- final git status must not include generated HTML.
- `dist/` output remains ephemeral.
- no generated HTML, image assets, font files, or screenshots are committed.
- cleanup command is documented and remains the expected removal path.

If cleanup is not run in a future audit, the audit must explain why and mark it as follow-up.

## 390px Browser QA Evidence

K-232 completed manual browser QA for the generated static HTML at 390px width.

K-232 recorded:

- no horizontal overflow.
- preview root did not overflow.
- readable labels.
- unclipped primary content.
- fallback/list usability.
- 10 nodes visible in the generated preview.
- 12 relationships visible in the generated preview.
- tone/kind/status/cluster text visible.
- no canvas/SVG/WebGL/interactive graph.
- no app runtime nav text detected.
- no live data.

K-233 is a closure/audit-only milestone. Manual browser QA does not need to be repeated in K-233 if K-232 evidence is already recorded and the generator is not changed.

K-232 provides sufficient first viewport proof for the static HTML harness. Future work can strengthen this with repeatable capture/measurement if needed.

## Runtime Exposure Audit

K-233 verifies:

- no route added.
- no panel added.
- no hidden experimental panel added.
- no normal Notes navigation added.
- no Sidebar / `TabId` / `AppContent` changes.
- `NotesCosmosStaticPreview` remains unwired.
- `NoteView` unchanged.
- `NoteGraphView` unchanged.
- `LocalGraphView` unchanged.
- `ProductEmptyState` unchanged.
- `NotesPixelCosmosEmptyState` unchanged.
- no stores/persistence/schemas/providers changes.
- no editor behavior changes.
- no package/vite config changes.
- no new dependencies.
- no Health/Schedule behavior changes.
- no attachment/OAuth/Supabase behavior changes.

Runtime exposure risk remains Low because the harness is not mounted in app runtime.

## Import / Data Boundary Audit

Allowed generator inputs:

- `NotesCosmosStaticPreview`.
- K-220 fixture/mock contract.
- React server rendering.
- Vite SSR loading.
- Node standard library utilities.

Preserved boundaries:

- K-220 fixture-only input is used.
- no live notes.
- no IndexedDB reads.
- no Supabase reads/writes.
- no Google Drive/attachment reads/writes.
- no background sync/upload.
- no credentials.
- no telemetry changes.
- no `KnowledgeIndexService`.
- no graph builders.
- no saved coordinates/spatial metadata.
- no persisted coordinates.
- no orbit layout state.

## Remaining Risks

The generator/script workflow is Medium-risk by milestone type because it creates and deletes a generated artifact.

Runtime exposure risk remains Low because there is no route, panel, runtime mount, or live data coupling.

CSS fidelity is intentionally limited to minimal inline structural CSS.

The static HTML harness does not prove full app visual parity.

Manual QA repeatability could be improved later.

The static harness should not be mistaken for a runtime Cosmos Map.

The product placement decision remains separate from harness closure.

## Recommended K-234

Recommended primary next milestone:

**K-234 Notes/Cosmos Static HTML Viewport QA Evidence Audit**

Scope:

- audit the recorded 390px QA evidence.
- optionally repeat manual browser QA.
- document whether viewport proof is sufficient to move toward a dev/test viewing decision.
- no generator changes unless a bug is found.
- no route/panel/runtime wiring.

Alternative if the team wants repeatable browser capture/measurement next:

**K-234 Notes/Cosmos Static Harness Capture Automation Plan**

Scope:

- docs/plan only.
- evaluate whether existing product QA capture or Puppeteer tooling can automate screenshots or no-overflow checks.
- no new dependency by default.

Alternative if Notes/Cosmos visual proof is considered sufficiently closed for now:

**K-234 Local-first Backup/Restore Boundary Spec**

Scope:

- return to core local-first data reliability.
- no Notes/Cosmos runtime placement decision.

K-233 recommends the viewport QA evidence audit because K-232 closed the generator workflow, but the evidence chain can still be made easier to review before any dev/test viewing decision.

## Non-Goals

- no generator expansion in K-233.
- no static HTML committed.
- no scripts added.
- no package.json changes.
- no vite.config changes.
- no route/navigation wiring.
- no hidden experimental panel.
- no Sidebar / `TabId` / `AppContent` changes.
- no normal Notes navigation connection.
- no normal Notes runtime wiring.
- no `NoteView` changes.
- no `NoteGraphView` changes.
- no `LocalGraphView` changes.
- no `ProductEmptyState` changes.
- no `NotesPixelCosmosEmptyState` changes.
- no component code changes.
- no graph/canvas/orbit map.
- no live graph data.
- no `KnowledgeIndexService` or graph builder coupling.
- no stores/schemas/providers/persistence changes.
- no editor changes.
- no OAuth/Supabase/attachment behavior.
- no Google Drive QA work.
- no Health/Schedule behavior.
- no assets/fonts/dependencies.
- no Playwright/Cypress/Storybook addition.
- no generated screenshots committed.

## Closure Statement

K-232 static HTML viewport harness generator is closed if audit checks pass.

`NotesCosmosStaticPreview` remains unwired.

Static HTML harness remains dev/test-only and ephemeral.

No normal Notes runtime wiring should occur yet.

`NoteGraphView` and `LocalGraphView` remain preserved.

`ProductEmptyState` and `NotesPixelCosmosEmptyState` remain preserved.

Next product decision should be made separately from harness closure.
