# K-35 — Links Experience Audit

**Branch:** `k35-noteview-modernization`

---

## Purpose

Relationship management in NoteView should connect to Cosmos terminology and make backlink discovery obvious without reading documentation.

---

## Panel order (K-33.2 baseline)

Links tab sub-panels (top → bottom):

1. Concept hub
2. Concept relations (causes, depends-on, …)
3. Learning path (constellation steps)
4. Backlinks (incoming wiki with excerpts)
5. Reference explorer (outgoing/incoming, footnotes)
6. Related notes (tag/link/mention score)
7. Reading ↔ source link
8. Bibliography (/citation blocks)

K-35 adds **visual grouping** without reordering sub-panels.

---

## K-35 grouping

| Group | EN label | Panels | Count signal |
| ----- | -------- | ------ | ------------ |
| **Structure** | Knowledge structure | Concept hub, concept relations, learning path | Sections present |
| **Connections** | Connections | Backlinks, reference explorer, related notes | Incoming + outgoing + related |
| **Sources** | Sources & citations | Reading source link, bibliography | Linked source + citation blocks |

Group headers use `KnowledgePanelSection` with uppercase styling matching Properties and Outline.

---

## Relationship meaning

| Type | User label | Where |
| ---- | ---------- | ----- |
| Wiki backlink | Backlinks | `BacklinkPanel` — excerpt context |
| Outgoing wiki | Outgoing links | `ReferenceExplorerPanel` |
| Concept relation | Concept relations | Typed badges via `conceptRelationLabel` |
| Generic relation | Relations tab | `NoteRelationsPanel` (parent/child/custom keys) |
| Learning path step | Learning path | Ordered steps in `LearningPathPanel` |
| Reading ↔ source | Reading ↔ source | `ReadingSourceLinkPanel` |
| Citation block | Bibliography | APA/BibTeX copy |

Cosmos hints (`knCosmosHint*`) retained under empty states.

---

## Counts & discovery

- Backlink panel: `(n)` next to title — accent when n > 0
- Reference explorer: per-section counts (outgoing, incoming, footnotes)
- Concept hub: aggregate backlink/outgoing/relation counts
- **Context strip**: `{count} connections` chip opens Links tab
- **Cosmos tier chip**: star/planet/moon from backlink count + area + star pin

---

## Cosmos terminology alignment

| Internal | User-facing |
| -------- | ----------- |
| Graph tab | Cosmos view |
| Local graph | Cosmos (context strip) |
| Learning path | Learning path (constellation in hints only) |
| Concept | Concept badge (`knConceptBadge`) |

---

## Remaining debt

- Relations tab overlaps Links "structure" group — consider merge or cross-links in K-36
- `LinkedReferencesPanel.tsx` deprecated but not removed
- Reference explorer filter labels (All/Backlinks) in `LocalGraphView` still English hardcode — out of Links scope

---

## Files changed

- `LinksContextPanel.tsx` (new)
- `ConceptHubPanel.tsx` (Concept badge i18n)
- `BacklinkPanel.tsx` (font weight alignment)
- `NoteView.tsx` (wiring + connection counts)
