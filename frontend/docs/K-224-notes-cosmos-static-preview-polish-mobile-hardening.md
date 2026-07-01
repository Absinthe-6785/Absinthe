# K-224 Notes/Cosmos Static Preview Polish And Mobile Hardening

## Purpose

K-224 polishes and hardens the isolated K-222 Notes/Cosmos static preview skeleton.

K-224 does not wire the component into runtime Notes, routes, navigation, NoteView, NoteGraphView, LocalGraphView, ProductEmptyState, or NotesPixelCosmosEmptyState.

K-224 does not implement an interactive graph, canvas, WebGL, orbit map, live graph data, stored coordinates, or persisted spatial metadata.

## Changes

Tone field handling:

- `NotesCosmosStaticPreview` now renders every node `tone` as literal visible text.
- Tone is displayed as `Tone: active`, `Tone: quiet`, `Tone: reference`, or `Tone: archival` from the K-220 fixture contract.
- Tone remains informational only and is not represented by color alone.

Doc path typo:

- The K-222 document now points to the actual test path: `frontend/src/components/notes/NotesCosmosStaticPreview.test.ts`.

Mobile and no-overflow hardening:

- Component tests now render a long-label fixture inside a 390px wrapper.
- Tests assert key labels, all node ids, all relationship ids, long labels, `data-min-mobile-width="390"`, `max-w-full`, `min-w-0`, and `break-words` remain present.
- The preview still has no fixed canvas, SVG map, absolute graph layout, or coordinate-driven rendering.

Fallback and accessibility hardening:

- The preview keeps semantic `article`, `section`, heading, ordered-list, and list-item structure.
- Nodes render literal kind, status, tone, cluster, date, and summary text.
- Relationships render literal label, source, target, kind, and strength text.
- No button/link roles, fake graph controls, hover-only critical meaning, keyboard trap, or motion were added.

Style scope review:

- Styling remains component-scoped Tailwind utility classes inside `frontend/src/components/notes/NotesCosmosStaticPreview.tsx`.
- No global CSS/theme changes, assets, fonts, dependencies, animations, or design-system changes were added.

## Boundaries

K-224 preserves these boundaries:

- no NoteView wiring
- no NoteGraphView wiring
- no NoteGraphViewLazy wiring
- no LocalGraphView wiring
- no ProductEmptyState replacement
- no NotesPixelCosmosEmptyState replacement
- no route/navigation wiring
- no stores/persistence/schema/provider changes
- no graph builder imports
- no KnowledgeIndexService imports
- no live graph data
- no assets/fonts/dependencies
- no OAuth/Supabase/attachment behavior
- no Health/Schedule behavior

`NotesCosmosStaticPreview` continues to use only the K-220 fixture contract at `frontend/src/lib/notesCosmosStaticPreviewMockContract.ts`.

## Verification

K-224 verification should include:

- component tests for title, description, 10 nodes, 12 relationships, node tone, fallback text, semantic structure, long labels, 390px mobile intent, and forbidden runtime imports
- K-223 isolation audit test
- K-220 and K-221 related Notes/Cosmos tests
- typecheck
- build
- `git diff --check`
- boundary grep checks for runtime wiring and credentials

Manual browser QA is not required for K-224 because the component remains isolated and unwired from runtime UI.

## Next Milestone

Recommended next target: **K-225 Notes/Cosmos Static Preview Dev/Test Surface Decision**.

Reason:

- after skeleton polish and mobile hardening, the next question is where, if anywhere, this isolated component can be viewed safely
- the next step should still avoid normal Notes runtime wiring by default
- NoteGraphView and LocalGraphView remain preserved until a separate runtime placement decision is approved
