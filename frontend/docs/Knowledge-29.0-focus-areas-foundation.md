# Knowledge-29.0 — Focus Areas & Area Notes Foundation

## Scope

Design foundation for K-29. **K-29.1** implements the first read-only Area Lens slice documented here.

K-28 answered *when* marks appeared. K-29 explores *what kinds of concerns* leave marks.

---

## Decisions (Q1–Q4)

### Q1 — What is an Area?

An **Area is an ordinary note** with a lightweight convention: `type=area` on the note.

- No Area entity, database, CRUD lifecycle, or schema beyond existing note properties.
- The note title is the area name (Japanese, TOEFL, Absinthe, …).
- Areas are **designated**, not invented as parallel objects.

### Q2 — How does a note belong to an Area?

**Primary: wiki links (backlinks).**

A note belongs to an area when its body links to the area note title: `[[Japanese]]`.

- Membership is **earned through writing**, not a separate `area` field on every note.
- Optional future: explicit `area` property — deferred; links are sufficient for K-29.1.

Events and milestones on linked notes surface in the area projection automatically.

### Q3 — How do users discover Areas?

- Sidebar **Areas** section lists notes with `type=area`.
- Selecting an area opens the **Area Lens** (read-only hub).
- **Mark as Area** / **Clear Area** on the active note toggles the convention.
- No setup wizard, progress dashboard, or area maintenance UI.

### Q4 — Areas × Time Lenses

Deferred to **K-29.2+**.

Future shape: filter an existing range projection to notes linked to an area — e.g. “What left marks in Japanese during this quarter?”

K-29.1 does not combine area and time scopes.

---

## Area Trace Projection

```ts
buildAreaTraceProjection(areaNoteId: string, notes: readonly NoteBase[])
```

Returns:

```ts
{
  areaNoteId,
  areaTitle,
  linkedNotes,   // backlink members, sorted by recency
  milestones,    // from linked notes + area note
  events,        // from linked notes + area note
}
```

Pure aggregation. No scores, completion, or rankings.

---

## Area Lens UX

Question answered:

> What has left marks in this area?

Sections (when non-empty):

- **Linked Notes** — chronology by `updatedAt`
- **Milestones**
- **Events**

Empty state:

> No traces linked to this area yet.

Do **not** show: progress %, targets, status, focus scores, productivity language.

---

## Anti-goals

Do not build:

- Project / goal / roadmap entities
- Area completion, health, or ranking metrics
- Forced area assignment on every note
- Area setup ceremony or onboarding flows

---

## Phasing

| Phase | Scope |
| ----- | ----- |
| **K-29.0** | This document — decisions on representation, membership, discovery |
| **K-29.1** | `type=area` convention + `buildAreaTraceProjection` + read-only Area Lens |
| **K-29.2+** | Area × time lens intersection; inferred area suggestions from link clusters |

---

## Relationship to K-28

| K-28 | K-29 |
| ---- | ---- |
| Time lenses (day → custom range) | Area lens |
| `buildRangeTraceProjection` | `buildAreaTraceProjection` |
| Calendar boundaries | Relationship boundaries (backlinks) |
| Same trace philosophy — evidence, not evaluation |
