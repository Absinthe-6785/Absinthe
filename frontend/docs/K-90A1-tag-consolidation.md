# K-90A1 — Tag Consolidation

**Branch:** `k90a1-tag-consolidation`  
**Status:** Implemented (feature parity; Tags tab retained)  
**Scope:** Properties tag CRUD, shared editor, ownership alignment  
**Prerequisite:** K-90A Metadata Surface Polish Audit

---

## Executive Summary

Properties is now the **complete tag-management surface**. The Tags tab remains as a **legacy access path** with vault browse until K-90A2 removes it.

| Capability | Before | After |
|------------|--------|-------|
| Add tag | Tags tab only | **Properties** + Tags tab |
| Remove tag | Tags tab only | **Properties** + Tags tab |
| Rename tag | Tags tab only | **Properties** + Tags tab |
| Vault tag browse | Tags tab | Tags tab only (unchanged) |
| Filter by tag click | Tags tab | Properties + Tags tab |

---

## A. Tag Workflow Inventory

| Operation | NoteTagsPanel (before) | NoteTagsEditor (shared) | Bulk rename | Suggestions | Search |
|-----------|------------------------|-------------------------|-------------|-------------|--------|
| **Add** | ✅ input + button | ✅ | ❌ | ❌ | ❌ |
| **Remove** | ✅ chip × | ✅ | ❌ | — | — |
| **Rename** | ✅ double-click | ✅ | ❌ | ❌ | ❌ |
| **Filter vault** | ✅ chip click | ✅ (when `onSelectTag` passed) | — | — | — |
| **Vault browse** | ✅ `allTags` list | ✅ (`showVaultBrowse`) | — | — | — |

No bulk rename, suggestions, or dedicated tag search exist in either surface — parity preserved.

Business logic: `tags/noteTags.ts` (`addTag`, `removeTag`, `renameTag`) — single source, no duplication.

---

## B. Implementation

### Shared component

`NoteTagsEditor.tsx` — extracted from `NoteTagsPanel.tsx`:

- Chip list with remove, double-click rename, optional filter click
- Add-tag input row
- Optional vault browse (`showVaultBrowse` + `allTags`)

### Wiring

| Surface | Usage |
|---------|-------|
| `NotePropertiesPanel` | `NoteTagsEditor` at top (no vault browse) |
| `NoteTagsPanel` | Thin wrapper → `NoteTagsEditor` + vault browse |
| `NoteContextPanelBody` | Passes `activeTag` + `onSelectTag` to Properties |

### Transition ownership model

```text
Properties     = Metadata Editor (canonical tag CRUD)
Tags tab       = Legacy path + vault-wide tag browse
```

i18n: `k90a1PropertiesTagsHint` on Properties tags section.

---

## C. Workflow Validation

| Workflow | Before (clicks) | After (clicks) |
|----------|-----------------|----------------|
| Add tag | More → Tags → type → Add (**3–4**) | Properties → type → Add (**2**) |
| Remove tag | More → Tags → × (**3–4**) | Properties → × (**2**) |
| Rename tag | More → Tags → dbl-click → save (**4–5**) | Properties → dbl-click → save (**3–4**) |
| Full metadata + tags | Properties + More → Tags (**+2**) | Properties only (**0** extra) |

**Context switching:** Tag edits no longer require leaving the primary Properties tab.

---

## D. Tag Consistency

All tag edits flow through `noteUpdate(id, { properties })` → `useNotesStore.updateNote` → `knowledgeIndexService.updateNote`.

| Surface | Updates on edit |
|---------|-----------------|
| Properties tags | Immediate (same note object) |
| Tags tab | Immediate (shared editor) |
| Sidebar tag pills | On store refresh (`allTags` / note list) |
| Header tag chips | `noteTags` derived from active note |
| Search / index | `KnowledgeIndexService.updateNote` |
| Discover / Related | Index-backed; no separate tag cache |

Existing `noteTags.test.ts` covers index incremental update; `tagConsolidation.test.ts` adds UI + reindex guards.

---

## E. Regression Tests

| File | Coverage |
|------|----------|
| `tagConsolidation.test.ts` | Shared editor delegation, Properties embed, create via UI, index reindex |
| `noteTags.test.ts` | add/remove/rename persistence, frontmatter, index |
| `metadataSurfaceOwnership.test.ts` | Updated for K-90A1 shared editor |

---

## F. Follow-Up

| Branch | Action |
|--------|--------|
| **K-90A2** | Remove Tags tab after one release; move vault browse to Properties or sidebar |
| **K-90A3** | Fold Stats tag cloud; reserved-key filtering |

---

## G. Files Changed

- `NoteTagsEditor.tsx` (new)
- `NoteTagsPanel.tsx` (delegate)
- `NotePropertiesPanel.tsx` (embed editor)
- `NoteContextPanelBody.tsx` (wire filter props)
- `components/index.ts`, `i18n.ts`
- Tests + this report

---

## Success Criteria

✅ User can add, rename, and remove tags from **Properties** without opening the Tags tab.
