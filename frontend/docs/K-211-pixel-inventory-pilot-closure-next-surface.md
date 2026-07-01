# K-211 Pixel Inventory Pilot Closure and Next Surface Selection

## Purpose

K-211 closes the first Pixel Inventory pilot cycle. It evaluates K-207 through K-210, records the rules that should survive the pilot, and selects the recommended next pilot surface.

K-211 does not implement runtime UI. K-211 does not expand the Attachment Maintenance pilot. K-211 is a design evaluation and selection document only.

## Pilot Cycle Summary

### K-207 Pixel UI Direction / Grammar Spec

K-207 established the pixel-cosmos personal OS direction for Absinthe. It defined pixel as grammar, not decoration, and set readability and accessibility constraints ahead of nostalgia. It also selected Attachment Maintenance as the first safe pilot candidate because that surface already uses inventory-like states, blocked states, and explicit maintenance language.

### K-208 Pixel Inventory Component Pilot

K-208 added the first narrow Pixel Inventory component pilot. The pilot was limited to Attachment Maintenance queue/status buckets. It did not change upload, recovery, queue, diagnostics, OAuth, Supabase, persistence, Health, or Schedule behavior. It added no generated assets, no font files, and no dependencies.

### K-209 Attachment Maintenance Pixel Inventory Polish

K-209 polished the visual language. It made status vocabulary literal-first, improved title/count rhythm, refined badge placement and copy, and preserved accessibility and responsive acceptance criteria. It kept the pilot scoped to Attachment Maintenance and did not add forbidden bulk or destructive controls.

### K-210 Attachment Pixel Item Row Overflow Hardening

K-210 hardened the most fragile part of the pilot: item rows. It added long attachment text wrapping, item row min-width and overflow-wrap hardening, action button visibility protection, narrow viewport checks, and manual QA documentation. It did not change runtime behavior.

## What Worked

- Attachment Maintenance was a good pilot because it already uses inventory-like states.
- Literal-first status vocabulary kept the UI understandable.
- Pixel styling worked best as frame, status, and structure, not decorative noise.
- Status badges worked when text remained visible.
- Pixel panel and card grammar improved product identity without touching behavior.
- Scoped component styling reduced implementation risk.
- The no-assets, no-fonts approach kept the pilot lightweight.
- Accessibility guardrails were necessary and should continue.
- Responsive hardening was needed immediately after visual polish.
- Tests were useful when live local data did not contain every queue state.

## What Did Not Work / Risks Observed

- Long item names can easily break visual rhythm if they are not hardened before merge.
- Pixel metaphor can obscure real diagnostic meaning if literal text is removed.
- Badge, count, and header density can become crowded quickly.
- Keyboard and focus states need explicit protection, not assumed protection.
- Item rows are more fragile than bucket headers.
- A broad rollout before closure would be risky.
- Excessive docs or audit work can slow momentum if it is not tied to the next implementation.

## Keep Rules

1. Literal state text first, metaphor second.
2. No icon-only status.
3. No color-only status.
4. No pixel fonts for body, editor, forms, or dense data.
5. Pixel frames, borders, and badges should support scanability.
6. Long text must be hardened before merge.
7. Action buttons must remain visible and readable.
8. Focus states must remain clear.
9. No horizontal overflow.
10. No generated assets until the grammar is stable.
11. No new dependencies or fonts for small pilots.
12. No runtime behavior changes in visual pilots.
13. Each new surface needs stop and rollback criteria.
14. Each new surface needs manual QA steps.
15. Each new surface should be narrow and reversible.

## Anti-Patterns To Avoid

- Generic SaaS UI with pixel stickers.
- Full retro game skin.
- Noisy arcade backgrounds.
- Decorative stars without system meaning.
- Icon-only badges.
- Color-only status.
- Tiny game-like controls.
- Pixel font for long text.
- Hiding real diagnostic state behind metaphor.
- Broad global theme changes.
- Adding assets before component grammar is stable.
- Using pixel styling to justify behavior changes.
- Expanding to multiple tabs in one PR.

## Accessibility and Responsive Baseline

Future pixel UI work must preserve visible focus rings, keyboard reachable controls, native button and checkbox semantics, Enter and Space behavior, readable contrast, visible status text, long text wrapping, action button visibility, no horizontal overflow, and a narrow viewport smoke check.

If motion is introduced later, reduced motion must be respected. Pixel work must not introduce tiny hit targets or visual-only state.

## Candidate Next Surfaces

### 1. Notes Empty State Pixel-Cosmos Pilot

Pros:

- Low behavior risk.
- Strong identity payoff.
- Introduces Notes/Cosmos direction without implementing a graph or cosmos engine.
- Good place for satellite, node, signal, and archive-adjacent metaphor.
- No dense data burden.

Cons:

- Limited real interaction.
- Could become decorative if not tied to a clear user action.

### 2. Dashboard Command-Center Summary Pilot

Pros:

- High identity visibility.
- Can introduce Home as Signal Board.
- Connects records, traces, and signals as a product concept.

Cons:

- Broader surface.
- Higher risk of touching multiple domains.
- More layout complexity than an empty state.

### 3. Attachment Diagnostics Compact Status Strip

Pros:

- Continues the proven Attachment Maintenance surface.
- Low risk.
- Improves an existing workflow.
- Can reuse Pixel Inventory grammar.

Cons:

- Less exciting identity expansion.
- Keeps pixel work concentrated in the attachment area.

### 4. Notes/Cosmos Navigation Concept Doc or Pilot

Pros:

- Strongest long-term identity.
- Connects to satellite, cosmos, signal, relationship, and time concepts.

Cons:

- The concept is larger.
- Easy to overbuild.
- Should likely start with an empty state or concept spec before an interactive map.

### 5. Settings / Observatory Controls Small Pilot

Pros:

- Low data risk.
- Fits an observatory control panel metaphor.

Cons:

- Lower user impact.
- May feel decorative if it only restyles settings controls.

### 6. Health/Schedule Light Pixel Integration

Pros:

- Proves cross-tab consistency.

Cons:

- Health and Schedule need careful information clarity.
- They should not be next unless the grammar is stable across at least one broader, low-risk product surface.

## Recommended Next Surface

Recommended K-212 target: **K-212 Notes Empty State Pixel-Cosmos Pilot**.

Reasoning:

- It is safer than a full Notes/Cosmos implementation.
- It has stronger identity payoff than another attachment-only polish pass.
- It has low behavior risk.
- It can introduce satellite, cosmos, signal, and time language without changing the data model.
- It is a good bridge from Pixel Inventory to broader Absinthe identity.
- It lets Notes become more clearly central to the product.

Fallback if the team wants lower risk: **K-212 Attachment Diagnostics Pixel Status Strip Pilot**.

## K-212 Proposed Scope

If K-212 is the Notes Empty State Pixel-Cosmos Pilot, keep the scope narrow:

- Only touch the Notes empty state or a low-risk placeholder/intro surface.
- No graph engine.
- No cosmos engine.
- No note persistence changes.
- No editor behavior changes.
- No routing changes.
- No generated assets unless explicitly approved.
- Use CSS/component-only work where practical.
- Show pixel-cosmos visual language through frame, motif, copy, and empty-state layout.
- Keep the call to action clear.
- Support keyboard focus, readability, and contrast.
- No background noise behind text.
- No broad Notes redesign.

Possible concept direction:

- Use a clear literal title such as "No notes yet" or "No signals yet".
- Keep the primary action literal, such as "Create note".
- Use secondary cosmic copy sparingly, for example "Start the first signal in your workspace."
- Use subtle satellite, orbit, or node motifs with CSS only if practical.
- The empty state must remain understandable without the metaphor.

## Relationship To Time / Voyager Concept

An emerging conceptual split should guide future work:

- Home = Signal Board.
- Notes = Cosmos Map / Living Cosmos.
- Archive = Voyager View / Time-Distance Archive.
- Attachments = Inventory Bay.
- Health = Status Core.
- Schedule = Mission Orbit.

Time can be a main concept across the product. Notes should primarily represent meaning and relationship in the present. Archive should carry the stronger Voyager and time-distance metaphor. Home should show current signals and traces. Do not overload Notes Cosmos with every time or distance idea.

## Non-Goals

- No runtime UI implementation in K-211.
- No new assets.
- No fonts.
- No dependencies.
- No full redesign.
- No global theme migration.
- No Notes graph or cosmos implementation.
- No Archive or Voyager implementation.
- No Health/Schedule changes.
- No attachment, OAuth, or Supabase behavior changes.
- No Google Drive QA work.
- No persistence or data model changes.

## Closure Statement

The Pixel Inventory pilot is considered closed as a first-cycle pilot. Future pixel work should move surface-by-surface. K-212 should be narrow, reversible, and tested against the K-207 and K-211 rules before expanding the grammar further.
