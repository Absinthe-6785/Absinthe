# K-265 Notes Empty State Pixel-Cosmos Product Polish

## Purpose

K-265 is a narrow runtime UI polish milestone for the existing Notes empty-vault state.

It improves the first visible Notes/Cosmos product surface without adding routes, panels, navigation entries, graph behavior, backup behavior, storage behavior, or new systems.

## Target Surface

K-265 targets the mounted empty-vault component:

- `frontend/src/components/views/noteview/NotesPixelCosmosEmptyState.tsx`

The component is still rendered from the existing empty-vault branch in:

- `frontend/src/components/views/noteview/NoteViewEditorArea.tsx`

K-265 does not change that mount point.

## Product Polish

The empty state now emphasizes:

- Notes / Living Cosmos as the product identity.
- a clearer "Start with one signal" first action.
- a compact empty-vault status label.
- readable first-step guidance.
- literal, existing actions.

Pixel/Cosmos language is used as product grammar, not decoration. The copy stays tied to writing and returning to notes.

## Preserved Actions

K-265 preserves the existing actions and callbacks:

- `Create note`
- `Open today's note` when available
- `Import backup` when available

No new behavior is introduced.

## Boundaries

K-265 does not:

- add routes.
- add panels.
- change Notes navigation.
- wire `NotesCosmosStaticPreview`.
- mount static preview fixtures in runtime Notes.
- implement Cosmos Map.
- change `NoteGraphView`.
- change `LocalGraphView`.
- change graph builders.
- change `KnowledgeIndexService`.
- change Notes stores, schemas, persistence, or providers.
- change backup/export/import/restore behavior.
- add Data Safety / Backup Health UI.
- change attachment, OAuth, Supabase, or Google Drive behavior.
- change Health or Schedule.
- add assets, fonts, dependencies, package config, or Vite config.

## Accessibility And Responsive Notes

The empty state keeps semantic buttons, visible text labels, focus-ring classes, and text-first meaning.

The layout keeps mobile constraints in mind:

- width is capped with `min(100%, 620px)`.
- content wraps instead of overflowing.
- buttons remain literal text buttons.
- 390px browser QA is required because this is a user-facing runtime surface.

## Browser QA Checklist

K-265 requires manual/browser QA for:

- Notes empty-vault state visible.
- 390px viewport.
- primary CTA visible and usable.
- keyboard/focus behavior preserved.
- no overflow or clipping.
- no route/nav/panel changes.
- no static preview wiring.
- no backup/Data Safety surface.

## K-266 Recommendation

K-266 should be a closure audit or a small follow-up polish boundary.

It should not become a broad Notes UI overhaul unless a separate milestone explicitly approves that scope.
