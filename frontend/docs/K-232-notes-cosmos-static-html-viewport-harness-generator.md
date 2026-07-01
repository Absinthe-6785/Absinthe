# K-232 Notes/Cosmos Static HTML Viewport Harness Generator

## Purpose

K-232 implements the static HTML viewport harness generator for `NotesCosmosStaticPreview`.

It does not add route, panel, Sidebar, `TabId`, `AppContent`, or normal Notes runtime wiring.

It does not mount the preview in app runtime.

It keeps `NotesCosmosStaticPreview` fixture-only through the K-220 mock contract.

## Files

Generator:

- `frontend/scripts/renderNotesCosmosStaticPreview.mjs`

Generated output:

- `frontend/dist/notes-cosmos-static-preview/index.html`

Component:

- `frontend/src/components/notes/NotesCosmosStaticPreview.tsx`

Fixture:

- `frontend/src/lib/notesCosmosStaticPreviewMockContract.ts`

Documentation:

- `frontend/docs/K-232-notes-cosmos-static-html-viewport-harness-generator.md`

Test:

- `frontend/src/lib/notesCosmosStaticHtmlViewportHarnessGenerator.test.ts`

## Command

Run from the canonical repo:

```powershell
cd C:\Users\이도현\GitRepos\Absinthe\frontend
node scripts/renderNotesCosmosStaticPreview.mjs
```

Relative form:

```powershell
cd frontend
node .\scripts\renderNotesCosmosStaticPreview.mjs
```

No `package.json` script is required.

No `vite.config.ts` change is required.

## Output

The generator writes:

- `frontend/dist/notes-cosmos-static-preview/index.html`

Generated output is ephemeral.

Generated output must not be committed.

The root `.gitignore` already ignores `dist/`, so this output path is ignored.

Cleanup:

```powershell
Remove-Item -Recurse -Force .\dist\notes-cosmos-static-preview
```

POSIX cleanup:

```bash
rm -rf dist/notes-cosmos-static-preview
```

## CSS Strategy

The generated HTML uses minimal inline structural CSS.

Purpose:

- 390px viewport proof.
- no-overflow proof.
- readable text and lists.
- safe wrapping for long labels and relationship rows.

Limitations:

- It does not claim full app visual parity.
- It does not include full Tailwind output.
- It does not change Tailwind config.
- It does not change global CSS.
- It does not add fonts, assets, or dependencies.

## Manual 390px QA Procedure

1. Run generator command.
2. Open `frontend/dist/notes-cosmos-static-preview/index.html` in a browser.
3. Set viewport width to 390px.
4. Confirm Dev/Test Harness label visible.
5. Confirm fixture title/description render.
6. Confirm all 10 nodes render.
7. Confirm all 12 relationships render.
8. Confirm tone/kind/status/cluster text render.
9. Confirm no horizontal overflow.
10. Confirm no clipped primary content.
11. Confirm long labels wrap or remain readable.
12. Confirm relationship rows wrap or remain readable.
13. Confirm fallback/list content remains usable.
14. Confirm no canvas/SVG/WebGL/interactive graph.
15. Confirm no user notes/live graph data appear.
16. Confirm generated artifact is not committed.
17. Run cleanup command.
18. Confirm git status is clean except intended source/doc/test changes.

## No-Overflow Failure Criteria

Fail if:

- horizontal page scroll appears at 390px due to preview content.
- title/description/node labels/relationship labels are clipped.
- node or relationship content requires horizontal scrolling to read.
- fixed-width canvas/container appears.
- fallback/list content is missing.
- tone/kind/status/cluster text is absent.
- hover-only meaning is required.
- user/live data appears.

## Security / Data Boundary

K-232 preserves:

- K-220 fixture-only input.
- no live user notes.
- no IndexedDB reads.
- no Supabase reads/writes.
- no Google Drive/attachment reads/writes.
- no background sync/upload.
- no credentials.
- no telemetry changes.
- no KnowledgeIndexService/graph builder reads.
- no saved coordinates/spatial metadata.
- no route/panel/sidebar entries.

## Relationship To Existing Surfaces

NoteGraphView remains the shipped full-vault graph surface.

LocalGraphView remains the local/context graph surface.

NotesPixelCosmosEmptyState remains the empty-vault runtime pilot.

ProductEmptyState remains the generic/product empty state.

The generated harness does not replace or mount inside any of these.

## Results

Generator command result:

- PASS. `node scripts/renderNotesCosmosStaticPreview.mjs` generated the static HTML output.

Generated path:

- `frontend/dist/notes-cosmos-static-preview/index.html`

Cleanup result:

- PASS. Generated output was removed after browser QA.

390px manual QA result:

- PASS. Browser rendered the static HTML at 390px width.

No-overflow result:

- PASS. `document.documentElement.scrollWidth <= window.innerWidth` and preview root `scrollWidth <= clientWidth` were true at 390px.

Rendered counts:

- Nodes: 10.
- Relationships: 12.

Artifact committed:

- No.

Browser QA status:

- Completed against the generated local HTML file.

## Next Milestone

Recommended:

- **K-233 Notes/Cosmos Static HTML Viewport QA Result Audit**

Scope:

- docs/audit of K-232 generator output and 390px QA.
- verify artifact cleanup.
- verify no runtime wiring.
- decide whether to continue with stronger browser automation or proceed to dev/test viewing decision.

## Non-Goals

- no route/navigation wiring.
- no hidden experimental panel.
- no Sidebar / `TabId` / `AppContent` changes.
- no normal Notes navigation.
- no NoteView changes.
- no NoteGraphView changes.
- no LocalGraphView changes.
- no ProductEmptyState changes.
- no NotesPixelCosmosEmptyState changes.
- no component code changes.
- no live graph data.
- no KnowledgeIndexService or graph builder coupling.
- no stores/schemas/providers/persistence changes.
- no OAuth/Supabase/attachment behavior.
- no Health/Schedule behavior.
- no assets/fonts/dependencies.
- no Playwright/Cypress/Storybook.
- no generated HTML committed.
