# K-212 Notes Empty State Pixel-Cosmos Pilot

## Purpose

K-212 introduces the Notes/Cosmos identity through the Notes empty state only. The change is intentionally narrow: it gives a new empty vault a clearer first impression without adding graph behavior, navigation surfaces, persistence changes, or editor changes.

## Scope

- Replace the empty-vault Notes editor state with a focused CSS-only pixel-cosmos frame.
- Keep the primary call to action literal: `Create note`.
- Preserve existing callbacks for creating a note, opening today's note, and importing a backup.
- Keep the surface readable, calm, and compatible with the current design system.
- Leave search empty states, selected-note empty states, sidebar behavior, the editor, stores, routing, and persistence untouched.

## Concept

Notes is framed as a living cosmos: notes become signals, nodes, and traces over time. The empty state starts with `No signals detected yet` and points the user toward writing the first note. Archive/Voyager and Home/Signal Board concepts remain future work and are not implemented here.

## Accessibility And Readability

- The empty state uses native buttons with visible focus-ring classes.
- The primary CTA is text, not icon-only.
- Decorative motif elements are `aria-hidden`.
- The layout is CSS-only and avoids image, SVG, font, or generated asset dependencies.
- The copy remains readable at narrow widths and avoids horizontal overflow.

## Non-Goals

- No graph or Cosmos engine work.
- No BlockEditor, store, provider, schema, hydration, routing, or persistence changes.
- No new assets, fonts, dependencies, or global theme changes.
- No Archive, Home, Health, Schedule, attachment, OAuth, Supabase, or backend changes.
- No new note creation behavior beyond reusing the existing callback.

## Manual QA

1. Start the local Vite server.
2. Open the Notes workspace with an empty vault.
3. Confirm the empty state renders `Notes / Living Cosmos`, `No signals detected yet`, and `Create note`.
4. Confirm the action buttons are readable and do not overlap at desktop, tablet, and mobile widths.
5. Confirm there is no horizontal overflow.
6. Confirm existing non-empty Notes behavior still routes to the normal editor/list surfaces.
7. Spot-check Attachment Maintenance and other workspaces to confirm no pixel inventory or remote attachment surfaces changed.

## Recommended Next Step

If K-212 holds up in QA, the next best step is a small Dashboard Signal Board concept spec before implementation. If the empty state reveals readability or responsive issues, do a K-213 Notes Empty State Polish / Accessibility Hardening pass first.
