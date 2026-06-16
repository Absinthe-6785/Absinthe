# K-90A3 — Relations Surface Cleanup

**Branch:** `k90a3-relations-surface-cleanup`  
**Status:** Implemented (Option A — Relations tab canonical; Links browse + workflow)  
**Scope:** Eliminate relation CRUD duplication; clarify relation vs wiki vs computed neighbors  
**Prerequisites:** K-90A audit, K-90A1 tag consolidation, K-90A2 tags surface cleanup

---

## Executive Summary

After K-90A2, metadata ownership is clear for tags and properties. **Relations** remained ambiguous: the same `note.relations` store was editable from three panels (Relations tab, Links→ConceptRelations, Links→ReadingSource), while wiki links and computed neighbors looked similar in the Links tab.

K-90A3 assigns each surface a single role:

| Surface | Role |
|---------|------|
| **Relations tab** | Canonical **structured edge editor** (all relation types) |
| **Links → ConceptRelations** | **Browse** concept-type subset + navigate |
| **Links → ReadingSource** | **Workflow editor** — reading↔source keys only |
| **Links → Related Notes** | **Discovery/navigation** — computed similarity (not `note.relations`) |
| **Links → Backlinks / References** | **Navigation** — wiki mentions in body |
| **Graph (local / Cosmos)** | **Browse** — relation edges as graph visualization |
| **Actions / Discover** | **Execution** — suggested `related-to` creation |

**Chosen structure:** Option A (Relations tab = metadata / structured edges). Tab **not removed** (constraint).

---

## A. Relations Surface Audit

### Inventory

| Surface | Path | Purpose | Inputs | Outputs | User intent |
|---------|------|---------|--------|---------|-------------|
| **Relations tab** | `NoteRelationsPanel.tsx` | Edit + browse | `note.relations`, KIS resolve | Full CRUD on relations map | Manage typed edges |
| **Links → ConceptRelations** | `ConceptRelationsBrowse.tsx` | Browse + navigate | Concept subset of `note.relations` | Navigate to targets | See concept neighborhood in Links context |
| **Links → ConceptHub** | `ConceptHubPanel.tsx` | Browse + navigate | Relations + wikis + backlinks | Navigate | Explore concept hub overview |
| **Links → ReadingSource** | `ReadingSourceLinkPanel.tsx` | Edit + browse | `source` / `readingNotes` keys | Bidirectional link/unlink | Connect reading notes to sources |
| **Links → Related Notes** | `RelatedNotesPanel.tsx` | Discover + navigate | KIS computed index | Wiki link in body (not relations) | Find similar notes |
| **Links → Backlinks** | `BacklinkPanel.tsx` | Navigate | Body wiki mentions | Navigate | See who links here |
| **Graph tab** | `LocalGraphView.tsx` | Browse + navigate | KIS neighborhood | Navigate, expand | Visual local context |
| **Cosmos view** | `NoteGraphView.tsx` | Browse + navigate | Vault graph | Navigate, filter | Vault-wide graph |
| **Actions** | `CosmosActionsPanel.tsx` | Execute | Suggestions | `related-to` edge | Act on recommendations |
| **Discover** | `DiscoveryPanel.tsx` | Execute | Rediscovery items | `related-to` on source | Fill missing connections |

### Classification

| Capability | Classification | Unique surface (pre K-90A3) |
|------------|----------------|----------------------------|
| Full relation CRUD | Metadata editing | Relations tab |
| Concept relation CRUD | Metadata editing | ❌ Duplicate of Relations tab |
| Reading source link | Metadata (workflow) | Links → Sources ✅ |
| Incoming relations view | Knowledge structure | Relations tab ✅ |
| Concept hub overview | Knowledge structure | ConceptHub ✅ |
| Related notes | Knowledge discovery | RelatedNotes ✅ |
| Graph relation edges | Graph navigation | Local/Cosmos graph ✅ |
| Suggested relation create | Knowledge discovery | Actions/Discover ✅ |

### Post K-90A3 ownership map

| Capability | Surface |
|------------|---------|
| Structured relation CRUD (all types) | **Relations tab only** |
| Concept relation browse + navigate | Links → ConceptRelations |
| Reading↔source link/unlink | Links → Sources (unchanged) |
| Computed neighbors | Links → Related Notes |
| Wiki navigation | Links → Backlinks, References |
| Graph visualization | Graph tab, Cosmos view |

---

## B. Duplication Report

| UI element | Relations tab | Links ConceptRelations (before) | ReadingSource | Related Notes | Graph |
|------------|---------------|--------------------------------|---------------|---------------|-------|
| Add typed edge | ✅ all keys | ✅ concept keys only | ✅ source keys | ❌ (wiki body) | ❌ |
| Remove edge | ✅ | ✅ duplicate | ✅ workflow | ❌ | ❌ |
| Browse outgoing | ✅ | ✅ duplicate | ✅ | ❌ | ✅ edges |
| Browse incoming | ✅ | ❌ | ✅ reverse | ❌ | ✅ edges |
| Navigate target | ✅ | ✅ | ✅ | ✅ | ✅ |

### Duplicate concepts (not duplicate data)

| Concept | Surfaces | Same store? |
|---------|----------|-------------|
| **Structured relation** | Relations tab, ConceptRelations (was), ReadingSource | `note.relations` |
| **Wiki link** | Backlinks, References, Related Notes "Link" | `note.body` |
| **Computed neighbor** | Related Notes, Discover, Actions | KIS index |
| **Graph edge** | Local graph, Cosmos | KIS (includes relations) |

### Replacement paths

| Workflow | Canonical path |
|----------|------------------|
| Add/remove any relation type | Relations tab |
| Browse concept relations in Links | Links → Structure (read-only) |
| Link reading to source | Links → Sources |
| Navigate by relation | Relations tab, Links browse, graph |
| Find similar notes | Links → Related Notes, Discover |
| Create wiki connection | Editor `[[...]]`, Related Notes Link |

---

## C. Recommendation

### Implemented: Option A — Relations tab = Metadata (structured edges)

- `ConceptRelationsBrowse` replaces CRUD in Links → ConceptRelations
- `NoteRelationsPanel` remains full canonical editor
- `ReadingSourceLinkPanel` stays in Links (workflow-specific; distinct keys)
- Copy hints distinguish relations vs wikis vs computed neighbors

### Option B — Relations = Knowledge Structure (not chosen)

Would emphasize graph/hub navigation over editing. Conflicts with K-90A §E and Properties/Tags ownership pattern (dedicated editor tab in More menu).

### Option C — Relations = Graph Navigation only (not chosen)

Would remove editing from Relations tab — high risk, no superior replacement for typed edge CRUD.

### Tradeoffs

| Approach | Pros | Cons |
|----------|------|------|
| **A (implemented)** | Single edit home; Links stays navigation-first | +1 click to edit from Links concept browse |
| **B** | Strong graph mental model | Buries CRUD; duplicates graph |
| **C** | Minimal surfaces | Loses structured metadata editor |

---

## D. Workflow Validation

| Workflow | Before | After |
|----------|--------|-------|
| Add concept relation | Relations tab **or** Links Structure | Relations tab only |
| Browse concept relations | Links Structure (with duplicate add UI) | Links Structure (read-only) |
| Edit after browse in Links | Same panel | Links → "Edit in Relations tab" (+1 click) |
| Link reading source | Links → Sources | Unchanged |
| Discover neighbors | Links → Related Notes | Unchanged + hint clarifies not relations |
| Review all edges | Relations tab | Relations tab (unchanged) |

**Context switching:** Editing concept relations from Links now requires Relations tab — intentional ownership split (mirrors K-90A2 Tags→Properties).

---

## E. Migration Risk

| Change | Risk |
|--------|------|
| ConceptRelations → browse only | **Low** — Relations tab has full parity |
| Relations tab hints | **Low** — copy only |
| Reading source stays in Links | **Low** — workflow unchanged |
| Related Notes hint | **Low** — clarifies existing behavior |
| Remove Relations tab entirely | **High** — deferred |
| Remove ReadingSource from Links | **Medium** — workflow-specific; keep |

---

## F. Follow-Up Branches

| Branch | Scope |
|--------|-------|
| **K-90A3A** | Relations tab promotion to primary (if metrics justify) |
| **K-90A3B** | Always-on relation summary in Properties (read-only link-out) |
| **K-90A4** | Metadata reserved-key cleanup in Properties |
| **K-90A5** | Stats fold into Properties |

---

## G. Files Changed

- `ConceptRelationsBrowse.tsx` (new)
- `ConceptRelationsPanel.tsx` — browse shell
- `NoteRelationsPanel.tsx` — ownership hint
- `ReadingSourceLinkPanel.tsx`, `RelatedNotesPanel.tsx` — boundary hints
- `NoteContextPanelBody.tsx` — wiring
- `useNoteViewPanelConfig.tsx` — tab hint
- `i18n.ts`, `index.ts`, tests, this report

---

## Success Criteria

✅ User knows **where to edit relations** → Relations tab  
✅ User knows **Links concept relations are browse-only** → hint + CTA  
✅ User knows **reading source is workflow-specific** → hint in Sources  
✅ User knows **Related Notes ≠ structured relations** → hint in Connections  
✅ No duplicate relation CRUD between Relations tab and Links Structure
