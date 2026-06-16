# K-90A — Metadata Surface Polish (Audit & Proposal)

**Branch:** `k90a-metadata-surface-polish`  
**Status:** Audit complete — no metadata UI changes shipped  
**Scope:** Metadata ownership, Tags/Relations/Stats overlap, workflow friction, simplification options  
**Prerequisites:** K-89B IA audit, K-89B1 (Discover primary), K-89B2/B2B (discovery consolidation), K-90 (editor hardening)

**Constraint:** No Discover/Links/Cosmos redesign; no new metadata systems; no high-risk tab removals without evidence.

---

## Executive Summary

After K-89B1, **Properties is a primary tab** — the right place for metadata to live. Remaining friction is **ownership ambiguity**, not missing features:

| Problem | Severity |
|---------|----------|
| Tags edited only in **Tags tab**; Properties excludes `tags` key | **High** |
| Same `note.relations` store edited in **three panels** (Relations, Links→Concept, Reading source) | **High** |
| System keys (`noteKind`, `weakTopic`, `area`, …) editable as raw strings in Properties | **Medium** |
| Stats tag cloud duplicates Tags tab vault list | **Medium** |
| Header tags are **display-only** (filter) — no quick-add | **Medium** |

**Recommended path (Option C → A):** Low-risk clarity first (copy, grouping, reserved-key filtering), then embed tag CRUD in Properties and remove Tags tab (**K-90A1**).

---

## A. Metadata Audit — Inventory & Ownership Map

### A.1 Storage model

| Layer | Location | Contents |
|-------|----------|----------|
| Note root | `noteUtils.ts` `NoteBase` | `id`, `title`, `body`, `folderId`, `starred`, `createdAt`, `updatedAt`, `lastOpenedAt`, `deletedAt` |
| Properties | `note.properties` | Key/value strings including reserved keys (`tags`, `noteKind`, `weakTopic`, `area`, project/trace keys) |
| Relations | `note.relations` | Typed outgoing edges (`course`, `prerequisite`, `causes`, `source`, …) |
| Body tokens | `note.body` | `[[wiki links]]`, inline `#tags` (separate from `properties.tags`) |

### A.2 Field inventory

| Field | Persisted as | Owner surface (canonical write) | Editor surface(s) | Display surface(s) |
|-------|--------------|--------------------------------|-------------------|---------------------|
| **title** | `note.title` | Editor | Title input | Sidebar, all panels |
| **body** | `note.body` | Editor | Block editor | Reading mode, Stats |
| **tags** | `properties.tags` | Tags tab (`noteTags.ts`) | **Tags tab only** (`NoteTagsPanel`) | Header chips (filter), sidebar rows, Stats count, Tags vault list |
| **inline `#tags`** | body text | Block editor | Block editor | Search merge; not in Properties/Tags tab |
| **noteKind** (classification) | `properties.noteKind` | Header | `NoteClassificationSelector` | Header; raw row in Properties if set |
| **weakTopic** | `properties.weakTopic` + `#weak-topic` tag | Header | `WeakTopicToggle` / compact menu | Header strip, Tags tab (tag), Properties row |
| **starred** | `note.starred` | Header | Star button (`toggleStar`) | Sidebar star folder, graph nodes |
| **area** (label) | `properties.area` | Actions / Cosmos | Actions assign; raw Properties key | `NoteContextStrip` chip; Insights context |
| **type=area** (hub) | `properties.type` | Header / Actions | Area toggle; create hub | Context strip “Area hub” |
| **studyProject\*** | properties | Properties | `ProjectEditorPanel` | Project editor, context strip |
| **projectMilestone\*** | properties | Properties | `MilestoneEditorPanel` | Project editor |
| **trace event** | `type=event`, date keys | Header | Event dialog | Planner, archive |
| **trace milestone** | `milestoneDate`, … | Header | Milestone dialog | Planner — **not** `MilestoneEditorPanel` |
| **relations** | `note.relations` | Relations tab | Relations tab; Links→ConceptRelations; ReadingSourceLink; Actions/Discover | Relations incoming/outgoing; graph |
| **wiki links** | body | Editor / Cosmos | `[[...]]`; RelatedNotes Link | Links backlinks, Stats wiki count, graph |
| **custom properties** | arbitrary keys | Properties | `NotePropertiesPanel` CRUD | Properties; database views; export |
| **importance classification** | computed | — | — | Insights, graph sizing |
| **graph tier** | computed | — | — | Context strip, graph |
| **related notes** | computed | — | Link action (wiki) | Links tab, Discover |
| **folderId** | note root | Sidebar | Folder move | Sidebar badge |
| **updatedAt** | note root | implicit on save | — | Sidebar date |
| **createdAt** | note root | create flow | — | **Not shown** (Stats uses id timestamp) |

There is no persisted “knowledge signals” field — Insights/Discover surfaces show **computed** Cosmos/discovery outputs.

### A.3 Context panel surfaces (post K-89B1)

**Primary:** Outline | Links | Cosmos | Discover | **Properties**

**More:** Insights | Actions | Timeline | **Tags** | **Relations** | **Stats**

| Tab | Component | Edits metadata? | Primary role |
|-----|-----------|-----------------|--------------|
| **Properties** | `NotePropertiesPanel` + project/milestone editors | Yes (properties; not tags) | **Metadata owner (partial)** |
| **Tags** | `NoteTagsPanel` | Yes (full tag CRUD) | **Tag editor (duplicate path)** |
| **Relations** | `NoteRelationsPanel` | Yes (`note.relations`) | Structured graph edges |
| **Stats** | inline in `NoteContextPanelBody` | No | Document metrics + tag cloud |
| **Links** | `LinksContextPanel` | Partial (wiki body, concept relations, reading links) | Per-note **navigation** |
| **Insights** | `CosmosInsightsPanel` | No (analysis display) | Interpretation |
| **Actions** | `CosmosActionsPanel` | Partial (area, relations, wiki) | Execution |
| **Header** | `NoteViewEditorArea` | Yes (classification, weak, star, area/event) | Quick structured edits |

### A.4 Duplication matrix

| Metadata | Surfaces involved | Overlap type |
|----------|-------------------|--------------|
| **Tags** | Tags tab, header chips, sidebar, Stats cloud | Edit vs display; Stats cloud = Tags vault list |
| **Relations** | Relations tab, Links→ConceptRelations, ReadingSourceLink, Actions | Same store, different presets/UX |
| **Wiki vs relations** | Links (backlinks/related), Relations tab | Different stores; easily confused |
| **Classification** | Header selector vs Insights “importance” | Different semantics, similar label |
| **Weak topic** | Header toggle, Tags (`#weak-topic`), Properties row | Triple representation |
| **Milestones** | Trace (header dialog) vs project (`MilestoneEditorPanel`) | Same word, different models |

---

## B. Metadata Workflow Report

Measured from open note, context panel visible, edit mode. **+1** if panel collapsed.

### B.1 Core workflows

| Workflow | Minimum path (clicks / tab changes) | Surfaces touched | Friction |
|----------|-------------------------------------|------------------|----------|
| **Create note** | 0 (default empty) | Editor | Low |
| **Add tag** | More → Tags → type → Add (**3–4**) | Tags tab | **High** — Properties primary but cannot edit tags |
| **Remove tag** | More → Tags → chip × (**3–4**) | Tags tab | **High** |
| **Rename tag** | More → Tags → double-click → save (**4–5**) | Tags tab | **High** |
| **Filter by tag (vault)** | Sidebar pill **or** Tags tab click **or** Stats cloud | 3 duplicate entry points | Medium |
| **Change classification** | Header selector (**1**) | Header | Low |
| **Mark favorite** | Header star (**1**) | Header | Low |
| **Mark weak topic** | Header toggle (**1**) | Header (+ tag side effect) | Low |
| **Add custom property** | Properties → Add (**1**) | Properties | Low |
| **Add structured relation** | More → Relations → type + target (**4–5**) | Relations tab | **High** — buried in More |
| **Add concept relation** | Links → Structure → ConceptRelations (**2–3**) | Links (subset of same store) | Medium — duplicate UX |
| **Link reading source** | Links → Sources → ReadingSource (**2–3**) | Links | Medium — third relation UX |
| **Review all metadata** | Properties (**1**) + More → Tags (**+2**) + More → Relations (**+2**) | **3 tabs** | **High** |
| **Inspect document stats** | More → Stats (**2–3**) | Stats | Medium |
| **Review computed signals** | More → Insights (**2–3**) | Insights | Medium |

### B.2 Unnecessary friction (ranked)

1. **Tags not in Properties** — primary tab cannot complete tag workflow (K-89B1 deferred this).
2. **Relations triple entry** — user must learn Relations vs Links Structure vs Sources.
3. **Full metadata review spans 3 More tabs** — Tags + Relations + Properties.
4. **Header tags read-only** — forces tab switch for any tag edit.
5. **Stats tag cloud** — duplicates Tags tab vault browse without adding edit.

### B.3 What works well

- **Classification, star, weak topic** — single-click header editors.
- **Custom properties** — clear CRUD on primary Properties tab.
- **Project / milestone containers** — dedicated sub-panels when note type matches.
- **Links tab** — correct home for wiki navigation and backlinks (not metadata duplication if relations stay separate).

---

## C. Simplification Proposal

### Option A — Tags fully integrated into Properties (Recommended end state)

**Changes:**
1. Embed `NoteTagsPanel` tag editor section at top of `NotePropertiesPanel` (or shared `NoteTagsEditor` component).
2. Remove Tags tab from `useNoteViewPanelConfig` and `NoteContextPanelBody`.
3. Remove Stats tag cloud (or replace with link “Manage tags in Properties”).
4. Optional: header tag chip “+” opens Properties with focus on tags section.

| Pros | Cons |
|------|------|
| Single canonical metadata tab (matches K-89B vision) | Requires tag CRUD UI work in Properties |
| Drops one More item (11 → 10 surfaces) | Users habituated to Tags tab need one release note |
| Aligns primary-tab IA with “metadata lives in Properties” | Inline body `#tags` still separate (document only) |

**Risk:** Low — `NoteTagsPanel` logic already exists; move, don’t rewrite.  
**Evidence:** K-89B1 explicitly deferred until Properties exposes tag CRUD.

---

### Option B — Metadata group model (Properties hub + grouped More)

**Changes:**
1. Properties becomes **hub** with sections: Tags | Properties | Relations summary (read-only links).
2. More menu regroups: `Metadata` submenu → Tags (until merged), Relations, Stats **or** fold Stats into Properties footer.
3. Reserve-key filtering in Properties (hide `noteKind`, `weakTopic`, system keys from freeform rows).

| Pros | Cons |
|------|------|
| Clear mental model: “Metadata = Properties + Relations” | Still multiple tabs until Tags merged |
| Reduces raw-key corruption risk | More menu nesting adds one click |
| Stats becomes “document info” subsection | Larger Properties panel scroll |

**Risk:** Medium — navigation change without removing duplication.

---

### Option C — Minimal change (Recommended first sprint)

**Changes (documentation + low-risk polish only):**
1. **Copy hints** on Tags tab: “Tags also appear in the header and sidebar; full metadata is in Properties.”
2. **Copy hints** on Properties: “Edit tags in the Tags tab (More) — coming to Properties.”
3. **Filter reserved keys** from `listUserProperties` (`noteKind`, `weakTopic`, `area`, `type`, project/trace prefixes).
4. **Relations tab hint** linking to Links for wiki navigation vs structured edges.
5. **Stats:** remove tag cloud or label “Vault browse — edit tags in Tags tab.”

| Pros | Cons |
|------|------|
| No tab removal; shippable immediately | Does not eliminate Tags tab |
| Stops property-row corruption | Relations triple-entry remains |
| Sets up K-90A1 with clear contract | Users still switch tabs for tags |

**Risk:** Very low.

---

### Recommendation

```text
Ship K-90A (this audit) → K-90A1 (Option A tag merge) → K-90A2 (relations boundaries) → K-90A3 (metadata grouping / Stats fold)
```

**Do not remove Tags tab until K-90A1 embeds tag CRUD in Properties** (K-89B2B explicitly deferred as not low-risk).

---

## D. Tags Evaluation (Detail)

| Operation | Tags tab | Properties | Header | Stats |
|-----------|----------|------------|--------|-------|
| **Add** | ✅ `addTag` | ❌ excluded | ❌ | ❌ |
| **Remove** | ✅ `removeTag` | ❌ | ❌ | ❌ |
| **Rename** | ✅ `renameTag` | ❌ | ❌ | ❌ |
| **Bulk edit** | ❌ (per-tag only) | ❌ | ❌ | ❌ |
| **Vault browse** | ✅ `allTags` list | ❌ | Sidebar pills | Tag cloud (top 20) |
| **Filter vault** | ✅ click tag | ❌ | ✅ sidebar/header | ✅ cloud click |

**Conclusion:** Properties **cannot** become canonical tag editor today. Tags tab owns all write paths. Display is fragmented across four surfaces.

---

## E. Relations Evaluation (Detail)

### Intended roles

| Surface | Role | Store |
|---------|------|-------|
| **Relations tab** | **Metadata** — full typed edge CRUD, incoming read-only | `note.relations` |
| **Links → ConceptRelations** | **Knowledge graph** — concept-type subset, same store | `note.relations` |
| **Links → ReadingSource** | **Metadata** — `source` / `readingNotes` keys | `note.relations` |
| **Links → Related Notes** | **Navigation** — computed similarity, not relations | index / body wikis |
| **Links → Backlinks** | **Navigation** — wiki mentions in other notes | body |
| **Actions / Discover** | **Execution / rediscovery** — create relations as action | `note.relations` |

### Boundary recommendation

```text
Relations tab  = canonical structured edge editor (all types)
Links tab      = navigate + per-note context (wikis, related, backlinks)
                 ConceptRelations → link-out “Advanced relations in Relations tab”
Reading source = keep in Links (workflow-specific)
```

---

## F. Stats Review

**Current content:** word/char/line counts, read time, headings, wiki links, tag count, code blocks, created (from id), vault tag cloud.

| Question | Assessment |
|----------|------------|
| Belongs in More? | **Partially** — document metrics fit Properties footer better |
| Belongs in Properties? | **Yes** — read-only “Document info” section is natural |
| Separate surface value? | **Low** — tag cloud duplicates Tags tab; vault health hook unused |

**Recommendation:** Fold Stats metrics into Properties (read-only section); demote or remove Stats tab in **K-90A3**. Keep tag count; remove tag cloud when Tags merge completes.

---

## G. Follow-Up Branches

| Branch | Scope | Builds on | Risk |
|--------|-------|-----------|------|
| **K-90A1 Tag Consolidation** | Embed tag CRUD in Properties; remove Tags tab; header quick-add optional | Option A | Low |
| **K-90A2 Relations Surface Cleanup** | Relations tab canonical; Links ConceptRelations → link/compact; reading source stays | §E boundaries | Medium |
| **K-90A3 Metadata Grouping** | Reserved-key filter; Properties sections (Tags / Study / Source / General / Document stats); fold Stats | Option B/C | Low–Medium |
| **K-90A4 Header Metadata Polish** | Header tag add; dedupe weak-topic surfaces | Optional | Low |

---

## H. Key Files

| Area | Path |
|------|------|
| Context router | `noteview/NoteContextPanelBody.tsx` |
| Properties | `components/NotePropertiesPanel.tsx` |
| Tags | `components/NoteTagsPanel.tsx`, `tags/noteTags.ts` |
| Relations | `components/NoteRelationsPanel.tsx`, `relations/noteRelations.ts` |
| Properties logic | `properties/noteProperties.ts`, `properties/propertyGroups.ts` |
| Links shell | `components/LinksContextPanel.tsx` |
| Header metadata | `noteview/NoteViewEditorArea.tsx` |
| Tab config | `noteview/useNoteViewPanelConfig.tsx` |
| Prior IA | `docs/K-89B-knowledge-context-ia-audit.md`, `docs/K-89B1-knowledge-context-simplification.md` |

---

## I. Success Criteria (for follow-up implementation)

Users can answer without hesitation:

- **“Where do I edit tags?”** → Properties (after K-90A1)
- **“Where do I manage relations?”** → Relations tab (structured); Links for navigation
- **“What belongs in Properties?”** → Tags, custom fields, project/milestone editors, document stats

Until K-90A1 ships, honest answer for tags remains **More → Tags** — this audit documents that gap explicitly.
