# K-234 Notes/Cosmos Static HTML Viewport QA Evidence Audit

## Purpose

K-234 consolidates static HTML viewport QA evidence for the Notes/Cosmos harness.

K-234 is docs/audit only.

K-234 does not change the generator.

K-234 does not change the component.

K-234 does not add route, panel, hidden panel, navigation, Sidebar, `TabId`, `AppContent`, or runtime Notes wiring.

K-234 verifies the evidence chain from K-232 and K-233.

K-234 separates QA evidence closure from any product placement decision.

## Current State Summary

K-220 mock fixture contract exists.

K-222 isolated component skeleton exists.

K-224 polish, mobile fallback, and accessibility hardening completed.

K-232 implemented the static HTML viewport harness generator.

K-233 closed generator implementation safety.

`NotesCosmosStaticPreview` remains unwired.

Generated output is ephemeral.

No normal Notes navigation connection exists.

No hidden experimental panel exists.

No live graph data or user data is used.

`NoteGraphView` and `LocalGraphView` remain preserved.

`ProductEmptyState` and `NotesPixelCosmosEmptyState` remain preserved.

K-220 fixture-only input remains the only approved input.

## Evidence Sources

K-232 generator doc:

- proves the intended command, output path, cleanup policy, 390px QA procedure, and K-232 recorded results.
- does not prove future generator runs unless rechecked.
- K-234 reviewed this prior evidence.

K-232 generator script:

- proves the current generator still uses the documented output path and static-render path.
- proves the generator still loads `NotesCosmosStaticPreview` and the K-220 fixture through Vite SSR.
- does not prove browser viewport rendering by itself.
- K-234 reviewed the script and repeated generator execution.
- K-234 repeated generator execution.

K-232 generator test:

- proves the generator guardrails are represented in source-level audit coverage.
- does not prove real browser layout.
- K-234 reran the related test suite.

K-233 closure audit doc:

- proves the generator milestone was closed with artifact, runtime exposure, generated HTML, and data-boundary evidence.
- does not replace future product placement decisions.
- K-234 reviewed this prior evidence.

K-233 closure audit test:

- proves the closure audit includes required K-233 guardrails.
- does not prove runtime behavior because K-233 intentionally had no behavior changes.
- K-234 reran this test.

Generated HTML inspection in K-234:

- proves the generator can still create the static output.
- proves the current generated output includes expected labels and fixture counts.
- proves generated output was inspected and removed in K-234.
- does not prove full app visual parity.
- K-234 repeated this verification.

Manual 390px QA evidence from K-232:

- proves K-232 browser-rendered the static HTML at 390px width and recorded no horizontal overflow.
- does not provide automated repeatable capture.
- K-234 reviewed this evidence and did not repeat browser QA.

Command output reviewed in K-234:

- `node scripts/renderNotesCosmosStaticPreview.mjs` completed successfully.
- generated output path matched K-232/K-233.
- generated artifact was cleaned after inspection.

## Generator Command / Output Evidence

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

- `renderToStaticMarkup` + Vite `ssrLoadModule`.

CSS strategy:

- minimal inline structural CSS.
- no full app visual parity claim.
- no global CSS/theme change.
- no Tailwind config change.
- no assets/fonts/dependencies.

Artifact policy:

- generated output is ephemeral.
- generated HTML is not committed.
- cleanup is required after inspection.

Cleanup commands:

```powershell
Remove-Item -Recurse -Force .\dist\notes-cosmos-static-preview
```

```bash
rm -rf dist/notes-cosmos-static-preview
```

Tooling/runtime status:

- `package.json` unchanged.
- `vite.config.ts` unchanged.
- no route/panel/runtime wiring.
- no npm script added.
- no browser automation dependency added.

## 390px Viewport QA Evidence

K-232 manual 390px browser QA was completed.

K-234 did not repeat browser QA.

K-234 reviewed K-232 evidence, not repeated browser QA, because this milestone is docs/audit-only and the generator/component were unchanged.

Viewport width:

- 390px.

K-232 recorded:

- no horizontal overflow.
- preview root did not overflow.
- title/description readability.
- node readability.
- relationship readability.
- tone/kind/status/cluster readability.
- fallback/list usability.
- unclipped primary content.
- no canvas/SVG/WebGL/interactive graph.
- no live data.

K-234 conclusion:

- K-232 evidence is complete enough for a static HTML harness QA evidence audit.
- repeatable browser capture/measurement would be useful later, but it is not required to close K-234.

## Count Interpretation

Content-level nodes: 10.

Content-level relationships: 12.

K-220 fixture remains authoritative for intended fixture size.

Content-level count is the user-visible fixture count.

Attribute-match count is a scan implementation detail, not a product data count.

Raw `data-node-id` or `data-relationship-id` attribute match counts may differ from content-level counts.

Duplicate attribute occurrences, wrapper elements, repeated fallback rows, serialized markup, or test selectors can inflate raw match counts.

`data-node-id` match count should not be interpreted as actual node count if it differs from content-level nodes.

Relationship count should be based on rendered relationship content/list rows and the K-220 fixture, not arbitrary attribute string count.

K-234 repeated generated HTML inspection and observed:

- raw `data-node-id` matches: 10.
- raw `data-relationship-id` matches: 12.

Those raw matches agree with content-level counts in the current generated artifact, but K-234 still treats fixture/content counts as authoritative.

## Generated HTML Safety Evidence

Generated HTML safety evidence records:

- Dev/Test Harness label present.
- `Not a runtime app route` warning present.
- content-level nodes: 10.
- content-level relationships: 12.
- fallback/list content present.
- tone/kind/status/cluster text present.
- script-tags=0.
- svg-tags=0.
- canvas-tags=0.
- no app route/nav/sidebar shell.
- no normal Notes navigation shell.
- no live notes/user data.
- no Supabase/OAuth/attachment behavior.
- no `KnowledgeIndexService` usage.
- no graph builder usage.
- no production Cosmos Map claim.

K-234 repeated generated output inspection and confirmed:

- Dev/Test Harness label present.
- `Not a runtime app route` warning present.
- `data-node-id` matches: 10.
- `data-relationship-id` matches: 12.
- script-tags=0.
- svg-tags=0.
- canvas-tags=0.
- tone/kind/status/cluster strings present.

## Forbidden Generated-HTML Scan Wording

Forbidden generated-HTML scan means:

- scan generated HTML for executable script tags.
- scan generated HTML for svg/canvas graph surfaces.
- scan generated HTML for app runtime nav/sidebar text.
- scan generated HTML for obvious credential/token strings.
- scan generated HTML for app bundle/runtime references.
- scan source files for forbidden imports/wiring.
- interpret matches by file context.

Docs and tests may mention forbidden terms as guardrails.

Docs/tests mentioning forbidden terms as guardrails are not runtime imports.

Generated HTML should not include sensitive/runtime content.

Generated HTML should not include app-visible navigation or runtime shell text.

Source grep results should be interpreted by file context.

K-234 forbidden scan wording distinguishes generated artifact checks from docs/test guardrail language.

## Artifact Lifecycle Evidence

K-232 artifact lifecycle:

- generated artifact was created during validation.
- generated artifact was inspected.
- generated artifact was removed.
- final working tree was clean.
- generated HTML was not committed.
- no generated image/font assets were committed.

K-233 closure evidence:

- confirmed `dist/notes-cosmos-static-preview` cleanup.
- confirmed generated output remained ephemeral.
- confirmed runtime/source changes remained narrow.

K-234 artifact lifecycle:

- K-234 repeated generation.
- K-234 inspected generated output.
- K-234 cleaned generated output after inspection.
- generated HTML was not committed.
- no generated image/font assets were committed.
- `dist/notes-cosmos-static-preview` cleanup confirmed.

## Runtime Exposure Evidence

K-234 verifies:

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
- no package/vite config changes.
- no new dependencies.

Runtime exposure remains low because this evidence audit does not mount the preview.

## Import / Data Boundary Evidence

K-234 verifies:

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
- no orbit layout state.

## Remaining Limitations

Minimal inline structural CSS does not prove full app visual parity.

Static HTML harness is not a product surface.

Viewport QA is manual/evidence-based, not fully automated.

No runtime placement decision has been made.

No route/panel convention has been approved.

Cosmos Map runtime remains unimplemented.

Harness output must remain ephemeral.

K-234 does not add capture automation.

K-234 does not decide runtime placement.

## Recommended K-235

Recommended primary next milestone:

**K-235 Local-first Backup/Restore Boundary Spec**

Scope:

- docs/spec only.
- define Absinthe-wide backup/restore/sync boundary.
- separate from Notes/Cosmos visual line.

Reason:

- K-232, K-233, and K-234 are sufficient to close the static HTML viewport proof line for now.
- The static harness remains dev/test-only and safe.
- Current product priorities can safely shift back to core local-first data reliability.

Alternative if Notes/Cosmos visual proof should continue:

**K-235 Notes/Cosmos Static Harness Capture Automation Plan**

Scope:

- docs/plan only.
- evaluate whether existing product QA capture or Puppeteer can automate screenshot/no-overflow measurement.
- no new dependency by default.
- no route/panel/runtime wiring.
- no generator expansion unless separately approved.

Alternative if product placement becomes the immediate question:

**K-235 Notes/Cosmos Runtime Placement Decision Gate**

Scope:

- docs/decision only.
- decide whether any dev/test viewing surface or runtime placement should be considered later.
- preserve no normal Notes navigation until approved.

## Non-Goals

- no generator changes in K-234.
- no component changes.
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
- no graph/canvas/orbit map.
- no live graph data.
- no `KnowledgeIndexService` or graph builder coupling.
- no stores/schemas/providers/persistence changes.
- no editor changes.
- no OAuth/Supabase/attachment behavior.
- no Health/Schedule behavior.
- no assets/fonts/dependencies.
- no Playwright/Cypress/Storybook addition.
- no Google Drive QA work.

## Closure Statement

K-234 consolidates the QA evidence chain for the static HTML viewport harness.

`NotesCosmosStaticPreview` remains unwired.

Static HTML harness remains dev/test-only and ephemeral.

No normal Notes runtime wiring should occur yet.

`NoteGraphView` and `LocalGraphView` remain preserved.

`ProductEmptyState` and `NotesPixelCosmosEmptyState` remain preserved.

If current viewport evidence is sufficient, the project can safely shift to the next core reliability line.
