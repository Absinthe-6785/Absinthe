# K-214 Notes/Cosmos Concept Spec

## Purpose

K-214 defines the Notes/Cosmos conceptual model. It follows K-212 and K-213 after the Notes empty-state pixel-cosmos pilot proved that Notes can carry the broader Absinthe identity without changing data behavior.

K-214 is docs/spec only. It does not implement graph/cosmos navigation, canvas, physics, node interactions, or runtime UI. Its purpose is to create boundaries before any future interactive Notes/Cosmos work.

## Product Identity

Absinthe is a pixel-cosmos personal OS for observing how personal records move through time.

Absinthe treats notes, routines, health, schedule, attachments, and long-term traces as signals inside a personal space archive. The product should feel like a quiet observatory for personal records: readable, local-first, calm, and capable of revealing how meaning accumulates over time.

## Information Cosmology

### Home = Signal Board

Home is the current signal surface. It shows current signals, recent traces, and summaries of what changed. It is not a generic stats dashboard. Home should help the user understand what is active now, what recently changed, and what may be worth continuing.

### Notes = Cosmos Map / Living Cosmos

Notes is the present meaning space. It contains active thoughts, note relationships, clusters, nodes, orbits, and signals. Notes/Cosmos should become a useful exploration surface for understanding relationships between notes, not a decorative graph engine.

### Archive = Voyager View / Time-Distance Archive

Archive is the past-record surface. It carries time as distance: older records become farther signals, and distant records can still become detectable again. The stronger Voyager / Pale Blue Dot metaphor belongs primarily in Archive.

### Attachments = Inventory Bay

Attachments are stored capsules and items. Local, remote, and sync state can be shown as inventory state. This metaphor already proved useful in the K-208 through K-210 Pixel Inventory pilot.

### Health = Status Core

Health is accumulated body and routine state. It should remain workout-first. Time appears here as rhythm, recovery, consistency, and accumulated bodily trace, not as gamified streak pressure.

### Schedule = Mission Orbit

Schedule is future time. Events can behave like orbit passes or mission windows. Routines are recurring paths. Schedule should keep today, routine, and timetable legible before decorative orbit language.

## Notes/Cosmos Role

Notes/Cosmos is the living map of current notes and meaning. It is relationship-oriented and cluster-oriented. It should support the user in seeing active knowledge space: linked thoughts, related subjects, recurring ideas, and meaningful proximity.

Notes/Cosmos is not primarily a time-distance archive. It is not a pure timeline. It is not a graph engine yet. It is not an AI clustering feature yet. It should focus on meaning, relationship, and active knowledge space.

Archive carries the stronger time-distance / Voyager metaphor. Notes should remain close enough to be writable, searchable, selectable, and editable.

## Archive / Voyager Split

The original idea of account-age or elapsed time causing the viewpoint to move farther is better suited to Archive than Notes. Archive can represent records as increasingly distant signals, with time becoming emotional distance.

Notes should not make active notes feel unreachable, old, or remote just because time passes. Active notes need to stay close to the user. Voyager/time-distance should be emotional and archival, not disruptive to active note work.

The boundary is:

- Notes = relationship space
- Archive = time-distance space
- Home = current signal surface

## Time As A Main Concept

Time is allowed to become a main Absinthe concept. It should behave like a world rule, not just a date field. Records accumulate, fade, return, and become detectable again. Time appears differently per surface:

- Past = Archive
- Present = Home
- Meaning = Notes
- Future = Schedule
- Body/Rhythm = Health
- Matter/Trace = Attachments

Core time terms:

- Chronos = actual timestamps, dates, and ordered history
- Distance = old records becoming farther signals
- Signal = old records resurfacing or becoming relevant again

This lets time become a product-level language without forcing every surface to use the same visual metaphor.

## Notes Visual Metaphor

### Node

A node is an individual note or record point. If implemented later, every node must remain selectable, readable, and reachable through non-canvas fallback paths.

### Signal

A signal is activity, update, or relevance. It may indicate recently edited notes, resurfaced notes, linked notes, or notes that became contextually important again.

### Orbit

An orbit is a relationship path, recurring theme, or tag-like grouping. It should not imply physical simulation unless simulation is intentionally designed and tested.

### Cluster

A cluster is a group of related notes. It can map to a project, topic, tag, collection, subject, or user-defined group.

### Planet / Body

A planet or body is a larger or more central note/group. It must not become arbitrary decoration. If this metaphor is used, it should communicate real centrality, density, or role.

### Satellite Viewpoint

The satellite viewpoint means the user observes the note system from a controlled distance. It can support zoom/pan metaphor later, but should feel like observation and agency, not loss of control.

### Trace

A trace is a record left behind by note edits, attachments, links, routines, or cross-workspace activity. Traces can connect Notes to Home and Archive later.

## Interaction Principles For Future Implementation

1. Readability before spectacle.
2. Notes remain easy to create, open, edit, and search.
3. Cosmos view is an alternate/exploratory layer, not a replacement for list/editor.
4. No node should become inaccessible.
5. Zoom/pan must be keyboard and pointer accessible.
6. Empty states and fallbacks must remain clear.
7. Graph/canvas should not be introduced until data model and accessibility strategy are defined.
8. Relationship inference must be explicit and reversible if added.
9. Do not rely on animation for meaning.
10. Do not hide note content behind metaphor.

## Possible Future Phases

- K-214: Notes/Cosmos Concept Spec
- K-215: Notes/Cosmos IA and Data Boundary Spec
- K-216: Notes/Cosmos Static Preview / Non-interactive Prototype
- K-217: Notes/Cosmos Accessibility and Navigation Plan
- K-218: Notes/Cosmos Minimal Interactive Pilot

Implementation should not jump directly to canvas/graph. The first future implementation should be static, non-interactive, empty-state-adjacent, or preview-like. Persistence and data changes require a separate spec before implementation.

## Data Boundary

Future Notes/Cosmos work must not assume:

- automatic note relationship inference
- new data fields without a migration plan
- graph persistence
- canvas state persistence
- AI clustering
- account-age distance calculation in Notes
- Archive/Voyager implementation in Notes
- remote sync behavior changes

Local-first Notes remain the source of truth. Any future relationship model must be explicit, inspectable, reversible, and compatible with existing Notes durability guarantees.

## Accessibility Boundary

Future Notes/Cosmos work must include:

- keyboard navigation for nodes
- visible focus for selected node
- list fallback required
- screen-reader accessible labels
- reduced motion support
- no color-only edges/status
- zoom controls must be keyboard accessible
- search/filter remains available
- editor remains reachable
- mobile fallback designed early

The list/editor experience remains the baseline accessibility path. A Cosmos layer can enhance exploration, but it must not strand keyboard users, screen-reader users, or mobile users.

## Candidate Next PRs

Preferred K-215 target: **K-215 Notes/Cosmos IA and Data Boundary Spec**.

Reason: the concept needs to be translated into information architecture and data boundaries before UI prototyping. This prevents graph/canvas work from touching persistence casually.

Alternative: **K-215 Notes/Cosmos Static Preview Spike**.

Use this only if the team wants visual validation first. It must be non-interactive, mocked/static only, and must include no persistence changes, no editor changes, and no graph engine.

## Non-Goals

- no runtime UI implementation in K-214
- no graph/canvas/navigation implementation
- no node/orbit interaction
- no Archive/Voyager implementation
- no Home Signal Board implementation
- no editor changes
- no note persistence changes
- no routing changes
- no stores/schemas/providers changes
- no generated assets
- no fonts
- no dependencies
- no global theme rollout
- no Health/Schedule changes
- no attachment/OAuth/Supabase changes
- no Google Drive QA work

## Closure Statement

K-214 defines the conceptual boundaries for Notes/Cosmos. Future implementation must proceed through narrow, reversible phases. Notes/Cosmos should not begin as a full graph/canvas rewrite. Archive should carry the stronger Voyager/time-distance concept. Home should carry Signal Board/current traces. Notes should remain the living relationship map.
