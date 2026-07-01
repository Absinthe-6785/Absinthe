# K-207 Pixel UI Direction / Grammar Spec

## Purpose

Absinthe's current UI is clean and functional, but it can still feel too generic, too SaaS-like, and too close to an AI-generated productivity dashboard. The product needs a stronger visual identity that can carry notes, routines, health, schedule, attachments, and long-term traces as one coherent personal workspace.

K-207 defines the visual direction and grammar for that identity. It is a design direction and specification PR only.

K-207 does not implement runtime UI, does not add generated assets, does not add font files, and does not change application behavior. It also does not resume attachment, OAuth, Supabase, or Google Drive behavior work; that line is paused unless explicitly requested.

## Core Identity Statement

Absinthe is not a clean SaaS dashboard. Absinthe is a pixel-cosmos personal operating system.

Absinthe treats personal records as a cosmic inventory: notes, routines, health, schedules, and attachments become signals, nodes, slots, and logs inside a personal space archive. The workspace should feel like a quiet observatory control panel rather than a generic productivity suite.

## Design Principles

1. Pixel is grammar, not decoration.
2. Information readability comes before nostalgia.
3. The app should feel cosmic, not arcade.
4. Pixel elements should explain state and structure.
5. Long reading and writing surfaces remain modern and calm.
6. Visual identity should be consistent across tabs.
7. Motion should be subtle and purposeful.
8. AI-generated assets are allowed for prototype exploration, but the art direction must be human-curated.

Pixel grammar should appear in the way panels, slots, states, borders, and navigation systems are expressed. It should not become a sticker layer on top of otherwise generic SaaS surfaces.

## Mood Keywords

Use these words to guide visual direction:

- pixel-cosmos
- cozy sci-fi
- observatory
- inventory dashboard
- personal space archive
- satellite viewpoint
- signal / node / orbit
- quiet interface
- cosmic operating system

Avoid:

- childish retro game skin
- noisy arcade UI
- low-readability pixel fonts everywhere
- generic SaaS with pixel stickers
- random decorative stars without system meaning

## Information Hierarchy Rules

- Text and content remain readable.
- UI frame, status, icon, and background treatment can be pixel-inspired.
- Data-dense areas must stay clean.
- Pixel motif opacity should be low behind content.
- No pixel noise should sit behind long text.
- Primary actions must remain obvious.
- Warning and error states must remain clear.
- Dense tables, logs, dates, times, numbers, and form values keep modern readable typography.
- Pixel treatment should support scanning, not interrupt it.

## Pixel Usage Map

Pixel style is encouraged in:

- card borders
- panel frames
- section headers
- status badges
- inventory slots
- empty states
- icons
- small background motifs
- tab identity motifs
- loading and skeleton accents
- selected and hover states
- dividers
- compact decorations around data cards

Pixel style should be avoided in:

- editor body text
- long paragraphs
- form inputs
- dense tables
- dates, times, and numbers
- error details
- destructive action labels
- accessibility-critical copy
- small body typography
- raw logs and debug output

## Component Grammar

### Pixel Panel

A pixel panel is a rectangular information panel with a subtle stepped or pixel border, a readable interior, and no heavy ornament around dense text. It should feel like an instrument surface in a personal OS.

### Inventory Card / Slot

An inventory card treats a card as an item slot. This is useful for attachments, notes, routines, and status summaries. Supported states should include ready, blocked, manual review, synced, missing, and recoverable.

### Status Badge

A status badge is a compact pixel badge with color, icon, and text. It must remain readable and should use icon plus text, not icon-only state.

### Section Header

A section header may use a small pixel marker or signal indicator. It should not become a full decorative banner.

### Background Motif

A background motif may use low-opacity star dust, orbit grids, or satellite signal lines. It should never sit directly behind long text.

### Empty State

An empty state may include a small pixel illustration. The illustration should explain the action or state, not merely decorate an otherwise empty card.

### Navigation Node

A navigation node is a future Notes/Cosmos concept. It may use node, orbit, planet, satellite, signal, and archive fragment metaphors.

## Tab Metaphor Map

### Notes

Notes maps to a cosmos map: nodes, planets, orbit, archive fragments, and a satellite viewpoint. Account age may map to satellite distance in a future concept, but this remains a later design idea.

### Health

Health maps to a status panel: character, core, and stamina metaphors may be used lightly. It must stay workout-first and should not become gamified clutter.

### Schedule

Schedule maps to a mission timeline: orbital calendar, docking schedule, and countdown signals. Today and routine context should stay legible before decorative structure.

### Attachments / Maintenance

Attachments and maintenance map to an inventory or storage bay: capsules, crates, and signal beacons. Ready, Blocked, Manual Review, Synced, Missing, and Recoverable states are item states.

### Settings

Settings maps to an observatory control panel: switches, calibrations, instruments, and clear status surfaces.

### Dashboard

Dashboard maps to a command center: summary panels, personal OS home, and calm status visibility.

## AI-Assisted Pixel Asset Workflow

The current pixel skill is still developing. AI-generated assets can be used for prototype and direction exploration, but they are not the final art direction by default. The user should retouch assets manually in Aseprite or a preferred pixel tool. Once the style is locked, core assets can be rebuilt manually.

### Phase 1: AI-Assisted Prototype

- Generate multiple candidate assets.
- Retouch manually.
- Test in UI.
- Discard weak assets quickly.

### Phase 2: Style Lock

- Fix palette.
- Fix outline rules.
- Fix icon grid.
- Fix shadow and highlight rules.
- Fix motif density.

### Phase 3: Human-Authored Renewal

- Rebuild core icons manually.
- Rebuild Notes/Cosmos assets manually.
- Reduce reliance on AI-generated assets.

## AI Asset Constraints

- Target small canvases such as 16x16, 24x24, 32x32, and 48x48 depending on use.
- Use a 1px dark outline where appropriate.
- Use a limited palette, ideally 8-12 colors per asset family.
- Use a consistent light source, such as top-left lighting.
- Keep dithering and noise minimal.
- Use transparent backgrounds for icons.
- Do not include text inside generated pixel assets unless manually retouched.
- Avoid over-detailed sprites.
- Avoid inconsistent perspective.
- Avoid random palette drift.
- Export assets only after review and retouch.

## Accessibility / Readability Constraints

- Contrast must remain sufficient.
- Body font remains readable sans-serif.
- Pixel font, if ever used, is only for very short labels or decorative headings.
- Status cannot rely on color alone.
- Badges require text labels.
- Motion must respect reduced motion.
- Background motif must not reduce text contrast.
- Focus states must be clear.
- Interactive hit targets remain normal UI size, not tiny game pixels.

## Rollout Plan

- K-207: Pixel UI Direction / Grammar Spec.
- K-208: Pixel Inventory Component Pilot.
- K-209: Attachment Maintenance Pixel Visual Pass.
- K-210: Notes/Cosmos Pixel Navigation Concept.
- K-211: Dashboard Shell Pixel-Cosmos Theme Pass.
- K-212: Health/Schedule Light Pixel Integration.

Rollout should start with a small pilot. Do not redesign everything at once. Attachment Maintenance is a good pilot because it already has inventory and status concepts. Notes/Cosmos remains core, but it should expand after grammar is locked rather than becoming the first broad implementation surface.

## First Implementation Candidate

K-208 Pixel Inventory Component Pilot is the recommended next step.

Suggested scope:

- Add non-invasive pixel panel, card, and badge prototypes.
- Use existing data states.
- Make no upload or recovery logic change.
- Avoid layout overhaul.
- Test in Attachment Maintenance or an isolated component/story-like test area if available.

## K-208 Pilot Note

K-208 should validate the pixel panel, inventory card, and status badge grammar inside the Attachment Maintenance inventory/status surface. The pilot must stay reversible, avoid assets/fonts/dependencies, and preserve upload, recovery, diagnostics, OAuth, Supabase, and persistence behavior. Stop criteria apply if readability, keyboard access, focus visibility, overflow, state clarity, or action clarity regresses.

## Non-Goals

- No runtime implementation in K-207.
- No new generated assets in K-207.
- No theme switcher.
- No full redesign.
- No Health/Schedule layout rewrite.
- No Notes persistence changes.
- No attachment/OAuth/Supabase behavior changes.
- No pixel font files.
- No external asset licensing commitments.
- No immediate replacement of all UI.
- No global CSS, Tailwind, or theme runtime change.
- No new dependency.

## Future Implementation Acceptance Criteria

Future implementation must preserve:

- no horizontal overflow
- no unreadable text
- no dense pixel noise
- no tiny controls
- clear primary action
- clear destructive action
- clear disabled and blocked state
- consistent status colors and icons
- reusable pixel elements through components or tokens, not one-off decorations
- readable editor, form, date, number, table, and log surfaces
- normal focus, hover, active, and disabled accessibility behavior

