# K-87 Search & Information Architecture Audit

**Branch:** `k87-search-ia-audit`  
**Status:** Investigation complete; one safe render fix applied  
**Scope:** Search integrity, Knowledge Context IA, metadata timestamp recovery, related leakage checks

---

## Executive Summary

| Area | Verdict |
|------|---------|
| Find in Note highlight corruption | **Root cause confirmed; fixed** |
| Index/search pipelines | **Generally correct** (raw markdown body, not rendered HTML) |
| Sidebar plain-text list filter | **Gap** — documented in K-49/K-65 but not wired in `NoteView.tsx` |
| Knowledge Context IA | **Inconsistent hierarchy** — 5 primary tabs + 6-item More overflow |
| Pre-K-85 `updatedAt` pollution | **Historical damage likely; accurate recovery not possible** |
| Related surfaces (backlinks, previews, index) | **No HTML leakage**; highlight bug was editor-render-only |

---

## 1. Search Integrity Audit

### 1.1 Pipeline inventory

| Surface | Index / match source | Serialized vs plain | HTML leak risk |
|---------|---------------------|----------------------|----------------|
| **Find in Note** | `collectEditorSearchMatches` on `block.content` (raw) | Plain block text | **Render-only** (fixed) |
| **Sidebar search box** | Knowledge query → `filterNotes` when syntax active; plain text **does not filter list** | Raw body via `filterNotes` / `noteSearchScore` (palette only) | Low |
| **Workspace Search palette** | `buildWorkspaceSearch` → `noteSearchScore` | Raw title/body/tags | Low |
| **Cosmos graph search** | `noteMatchesSearch` on note records | Raw body | Low (visual dim only) |
| **Knowledge index** | `KnowledgeIndexService` — wiki links from `extractLinks(body)`, tags/properties/relations separate | Raw markdown body | Low |
| **Backlinks** | Index edges + `extractLinkContexts` excerpts | Raw body paragraphs | Low |
| **Related Notes** | `groupRelatedNotes` via index + graph signals | Titles + index metadata | Low |
| **Insights** | Index-derived metrics, history events | Structured, not rendered HTML | Low |
| **Sidebar previews** | `NoteSidebarVirtualList` — regex strip of `#tags`, markdown chars | Plain text preview | Low |

**Principle (unchanged):** Search and indexing operate on **stored markdown body**, not KaTeX/HTML output. See `K-49-search-compatibility.md` and `lib/math/noteSearch.ts`.

### 1.2 Critical bug — Find in Note highlight artifacts

**Symptom:** Queries such as `em`, `mark`, or `e-mark` produce visible corruption:

```text
e-mark"><em>e-mark"><em>...
```

**Root cause:** `applySearchHighlight()` in `editableRender.ts` ran a global regex over **already-rendered HTML**, matching substrings inside:

- Tag names (`<em>`)
- Class attributes (`be-mark`, `be-live-mark`, `be-search-hl`)
- Decoration markup from `liveInlineHtml()`

Match **collection** (`editorSearch.ts`) correctly searches raw `block.content`. The bug was **display-only**.

**Fix applied (K-87):** Highlight only text segments outside HTML tags:

```ts
html.replace(/(<[^>]+>|[^<]+)/g, (segment) => {
  if (segment.startsWith('<')) return segment;
  return segment.replace(re, '<mark class="be-search-hl">$1</mark>');
});
```

**Risk:** Low — localized render change; tests added in `editableRender.test.ts`.

### 1.3 Sidebar plain-text search gap

**Finding:** `K-49-search-compatibility.md` and `K-65-search-unification.md` describe sidebar list filtering/sorting via `noteSearchScore` in `NoteView.tsx` `visibleNotes`. Current `visibleNotes` memo:

- Filters by folder, tag, workspace activation (smart/rule collections)
- Does **not** filter or re-rank by `searchQuery` for plain text
- `nvSearchNoResults` i18n key exists but is **unused** in `NoteViewSidebar`

Plain-text discovery is currently via **Workspace Search palette** (`WorkspaceSearchPalette` / `buildWorkspaceSearch`), not the sidebar list.

**Risk:** Medium UX — users may expect the sidebar search box to narrow the note list (as docs imply).

**Recommendation:** Fix later (K-87A) — wire `noteMatchesSearch` + `noteSearchScore` into `visibleNotes` when query has no knowledge syntax; show `nvSearchNoResults` empty state.

### 1.4 Markdown / decoration leakage elsewhere

| Location | Mechanism | Leakage |
|----------|-----------|---------|
| Backlink excerpts | `extractLinkContexts` — raw paragraphs, truncate | Wiki `[[...]]` syntax may appear in excerpt text (intentional context) |
| Sidebar preview | Strip `#tags`, `[#*` etc. | Occasional residual markdown tokens possible; no HTML |
| Workspace search subtitles | Note title + kind metadata | Plain text |
| Cosmos node labels | `displayNoteTitle` | Plain text |
| Math in search | `noteMatchesPlainSearch` on `$…$` source | LaTeX commands searchable (by design) |

No additional HTML-highlight corruption paths found beyond `applySearchHighlight`.

---

## 2. Information Architecture Audit

### 2.1 Current structure (code)

**Primary tabs** (`KnowledgeContextPanel.tsx` — `PRIMARY_TAB_KEYS`):

```text
Outline (toc) | Links | Cosmos (graph) | Insights | Properties
```

**More menu** (6 tabs, not 2):

```text
Actions | Discover | Timeline | Tags | Relations | Stats
```

Tab definitions: `useNoteViewPanelConfig.tsx` (11 tabs total).

K-86 lazy loading: `contextPanelTabGate.ts` gates heavy panel data until tab is active.

### 2.2 Inconsistencies

| Issue | Detail |
|-------|--------|
| **Properties vs Relations split** | Properties is primary; Relations (typed edges, complements wiki Links) is buried in More |
| **Tags vs Properties** | Tags editable in Properties panel; dedicated Tags tab redundant for many workflows |
| **Stats isolation** | Note-level stats (# panel) low-frequency but metadata-adjacent |
| **More menu overload** | 6 items with mixed frequency (Actions/Discover vs Relations/Stats) |
| **User-reported “Relations + Stats only”** | Likely stale observation — code has 6 More items; may reflect collapsed UI or older build |

### 2.3 Usage-frequency heuristic (engineering judgment)

| Tab | Estimated frequency | Rationale |
|-----|---------------------|-----------|
| Outline | High | Navigation in long notes |
| Links | High | Backlinks + outgoing wiki links |
| Cosmos | Medium | Spatial context; K-86 lazy-loaded |
| Insights | Medium | Suggested connections, opportunities |
| Properties | Medium–High | Tags, classification, dates |
| Relations | Medium | Structured relations (K-13+); overlaps partially with Links |
| Tags | Low–Medium | Subset of Properties |
| Actions | Low | Power-user workflows |
| Discover | Low | Exploration |
| Timeline | Low | Archive/history lens |
| Stats | Low | Word counts, link counts |

### 2.4 Recommendations (findings only — no implementation)

**Option A — Promote Relations (minimal change)**

```text
Outline | Links | Cosmos | Insights | Properties | Relations
More: Actions | Discover | Timeline | Tags | Stats
```

- Pros: Surfaces structured relations without nested menus; small diff
- Cons: 6 primary tabs may crowd compact layouts; Tags still redundant

**Option B — Metadata group (clearer hierarchy)**

```text
Outline | Links | Cosmos | Insights | Metadata ▾
  ├ Properties
  ├ Relations
  └ Stats
More: Actions | Discover | Timeline | Tags
```

- Pros: Groups metadata; reduces primary tab count; Stats with Properties/Relations
- Cons: Requires dropdown/accordion UX; larger change

**Preferred direction:** **Option B** for long-term clarity; **Option A** if minimizing K-87 scope.

**Tags tab:** Consider deprecating as standalone tab (content lives in Properties) — **fix later**.

---

## 3. Metadata Timestamp Recovery Investigation

### 3.1 K-85 behavior (current)

`notePatchPolicy.ts` — `mergeNotePatch()`:

- Metadata-only patches (`properties`, `starred`, `relations`, `folderId`) **preserve** `updatedAt`
- Content patches (`title`, `body`) bump `updatedAt`

### 3.2 Pre-K-85 damage model

Before K-85, metadata edits (tags, classification, favorite, relations, folder) advanced `updatedAt`, inflating “last modified” for notes whose body did not change.

### 3.3 Recovery sources

| Source | Content | Useful for `updatedAt` recovery? |
|--------|---------|----------------------------------|
| `note.updatedAt` | Current (possibly polluted) | Baseline only |
| `note.createdAt` | Creation time | Lower bound |
| `note.lastOpenedAt` | Read activity | Unrelated to edit time |
| `KnowledgeHistoryEvent` | `NOTE_CREATED`, `NOTE_DELETED`, `LINK_*`, `AREA_*`, … | **No body/metadata edit events** |
| `getNoteHistoryContext()` | `firstSeenAt`, `lastLinkedAt`, `lastMajorUpdateAt` | Approximate activity, not content edits |
| Cloud sync `updated_at` | Server copy | Same pollution if synced after metadata edit |
| Revision snapshots / autosave | — | **Not implemented** |
| `contentUpdatedAt` field | — | **Does not exist** |

### 3.4 Answers

1. **Accurate restoration?** **No** — no per-edit audit trail for body vs metadata changes before K-85.
2. **Approximate restoration?** **Limited** — e.g. `lastMajorUpdateAt` from link/hub events; cannot distinguish metadata-only bumps from body edits.
3. **Migration worthwhile?** **Low value** for historical data. **High value** going forward: optional `contentUpdatedAt` field (K-87C proposal) for sort/display separate from metadata touches.

---

## 4. Related Integrity Checks

| Surface | Checked | Finding |
|---------|---------|---------|
| Related Notes panel | `RelatedNotesPanel.tsx`, `groupRelatedNotes.ts` | Index/graph titles; no HTML render of body |
| Backlinks panel | `extractLinkContexts` | Raw markdown excerpts; light cleanup only |
| Insights snippets | Index + history queries | Structured labels |
| Cosmos labels | `displayNoteTitle` | Escaped plain text |
| Search previews | Palette + sidebar list | Plain text; sidebar uses `dangerouslySetInnerHTML` on cleaned preview (no search highlight) |
| Context snippets | Link contexts | No highlight pipeline |

**Stale indexing:** `KnowledgeIndexService` rebuilds on note patch; `indexContentVersion` keys sidebar memos. No stale-index bug identified in audit.

---

## 5. Deliverables

### A. Findings Report (risk summary)

| Issue | Root cause | Affected systems | Risk | Status |
|-------|------------|------------------|------|--------|
| Highlight HTML corruption | Regex on rendered HTML | Find in Note (edit + read) | **High** (visible corruption) | **Fixed** |
| Sidebar plain-text filter missing | `visibleNotes` omits `searchQuery` | Sidebar list vs docs | **Medium** (UX/doc drift) | Open |
| IA More overflow | K-81 primary cap + 6 secondary tabs | Knowledge Context | **Low** (discoverability) | Open |
| Pre-K-85 `updatedAt` pollution | No metadata-only patch policy | Sort, “recent”, dashboards | **Low** (cosmetic/historical) | Accept / optional future field |
| K-49 doc drift | Docs reference removed sidebar filter | Documentation | **Low** | Fix later |

### B. Proposed Follow-Up Tasks

| Task | Scope |
|------|-------|
| **K-87A — Search Integrity Fixes** | Wire sidebar plain-text filter + `nvSearchNoResults`; update K-49/K-65 docs; optional regression test for `visibleNotes` + `searchQuery` |
| **K-87B — Knowledge Context IA Cleanup** | Implement Option A or B; evaluate Tags tab removal; tablet/compact overflow testing |
| **K-87C — Timestamp Recovery / `contentUpdatedAt`** | Add optional `contentUpdatedAt` on content patches only; display “content updated” vs “metadata touched”; **no** historical backfill migration |

### C. Implementation Classification

| Item | Classification |
|------|----------------|
| `applySearchHighlight` tag-safe highlighting | **Fix now** ✅ (this branch) |
| Sidebar plain-text list filtering | **Fix later** (K-87A) |
| `nvSearchNoResults` empty state | **Fix later** (K-87A) |
| Knowledge Context IA restructure | **Fix later** (K-87B) |
| Tags tab consolidation | **Fix later** (K-87B) |
| Historical `updatedAt` backfill | **Accept as-is** (not feasible) |
| Forward `contentUpdatedAt` field | **Fix later** (K-87C, optional) |
| Backlink excerpt markdown tokens | **Accept as-is** (contextual) |
| Cosmos graph search (dim, no rank) | **Accept as-is** (intentional) |

---

## 6. Files Touched (K-87)

| File | Change |
|------|--------|
| `frontend/src/components/views/editableRender.ts` | Safe `applySearchHighlight` |
| `frontend/src/components/views/editableRender.test.ts` | Regression tests |
| `frontend/docs/K-87-search-ia-audit.md` | This report |

---

## 7. Verification

```bash
cd frontend
npm run typecheck
npm run build
npm run test
```

---

## References

- `K-49-search-compatibility.md` — raw body search principle
- `K-65-search-unification.md` — search surface matrix (sidebar section needs sync)
- `K-85` / `notePatchPolicy.ts` — metadata timestamp integrity
- `K-86` / `contextPanelTabGate.ts` — lazy context panels
- `KnowledgeContextPanel.tsx` — primary vs More tabs
