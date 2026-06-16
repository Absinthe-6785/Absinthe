# K-90A2 — Tags Surface Cleanup

**Branch:** `k90a2-tags-surface-cleanup`  
**Status:** Implemented (Option B — Tag Browser; tab retained)  
**Scope:** Eliminate CRUD duplication; distinct Tags tab purpose  
**Prerequisites:** K-90A audit, K-90A1 tag CRUD in Properties

---

## Executive Summary

After K-90A1, tag **editing** and tag **browsing** were duplicated. K-90A2 assigns each surface a single role:

| Surface | Role |
|---------|------|
| **Properties** | Canonical **metadata editor** (tag CRUD) |
| **Tags tab** | **Tag browser** — vault overview + filter navigation |
| **Stats** | Document metrics only (tag cloud removed) |
| **Sidebar** | Tag filter pills (when Tags tab loaded `allTags`) |

**Chosen structure:** Option B (convert Tags tab to browser). Tab **not removed** (constraint).

---

## A. Tags Surface Audit

### Tags tab capabilities (pre K-90A2)

| Capability | Classification | Unique? |
|------------|----------------|---------|
| Add / remove / rename tags | Metadata editing | ❌ Duplicate of Properties |
| View note tags | Display | ❌ Duplicate |
| Click tag → filter list | Tag navigation | ✅ Shared with sidebar |
| Vault `allTags` list + counts | Vault browse | ✅ **Unique in context panel** |
| Filter toggle on vault tags | Tag navigation | ✅ |

### Post K-90A2

| Capability | Surface |
|------------|---------|
| Tag CRUD | **Properties only** |
| Read-only note tags + filter | Tags tab |
| Vault browse + filter | Tags tab |
| Edit CTA | Tags tab → Properties |

---

## B. Duplication Report

| UI element | Properties | Tags (before) | Stats (before) | After K-90A2 |
|------------|------------|---------------|----------------|--------------|
| Add tag input | ✅ | ✅ duplicate | — | Properties only |
| Remove / rename | ✅ | ✅ duplicate | — | Properties only |
| Note tag chips | ✅ editable | ✅ duplicate | — | Properties edit; Tags read-only |
| Vault tag list | — | ✅ | Top-20 cloud (broken*) | Tags tab only |
| Tag count metric | — | — | ✅ | Stats count kept; cloud removed |

\*Stats tag cloud used `allTags` gated to `tagsTabActive` — empty when viewing Stats alone.

### Replacement paths

| Workflow | Canonical path |
|----------|----------------|
| Edit tags | Properties (primary tab) |
| Browse all vault tags | Tags tab **or** sidebar pills |
| Filter notes by tag | Tags tab, sidebar, header chips (read-only) |
| Tag-related discovery | Discover (separate engine) |

Search does not replace vault tag overview (no tag index UI in search palette).

---

## C. Recommendation

### Implemented: Option B — Tag Browser

- `NoteTagBrowser` + `NoteTagVaultBrowse` replace CRUD in Tags tab
- `NoteTagsEditor` CRUD-only in Properties
- Stats tag cloud → hint (`k90a2StatsTagBrowseHint`)

### Deferred: Option A — Remove Tags tab (**K-90A2B**)

| Risk | Medium — users lose in-panel vault browse; sidebar pills require Tags tab visit to populate `allTags` today |
| Prerequisite | Always-on sidebar tag index or Discover tag facet |

### Not chosen: Option C only (merge browse into Properties)

Would bloat primary metadata tab; browse is navigation, not editing.

---

## D. Workflow Validation

| Workflow | Before | After |
|----------|--------|-------|
| Edit tags | Properties **or** Tags (ambiguous) | Properties only (**1 tab**) |
| Browse vault tags | Tags tab | Tags tab (unchanged) |
| Filter by tag | Tags / sidebar / Stats cloud | Tags / sidebar |
| Edit after browse | Same tab (duplicate CRUD) | Tags → "Edit in Properties" (**+1 click**, clear intent) |

**Context switching:** Editing no longer possible from Tags tab — intentional ownership split.

---

## E. Migration Risk

| Change | Risk |
|--------|------|
| Tags tab → browser only | **Low** — Properties has parity since K-90A1 |
| Remove Stats tag cloud | **Low** — cloud was often empty; sidebar/Tags remain |
| Remove Tags tab entirely | **Medium** — deferred to K-90A2B |
| Sidebar `allTags` lazy load | **Low** — unchanged; document in K-90A2B |

---

## F. Follow-Up Branches

| Branch | Scope |
|--------|-------|
| **K-90A2B** | Remove Tags tab; always-on sidebar tag index |
| **K-90A3** | Relations surface cleanup |
| **K-90A4** | Reserved-key filtering in Properties |

---

## G. Files Changed

- `NoteTagBrowser.tsx`, `NoteTagVaultBrowse.tsx` (new)
- `NoteTagsPanel.tsx` — browser shell
- `NoteTagsEditor.tsx` — CRUD only
- `NoteContextPanelBody.tsx` — wiring, Stats dedupe
- `useNoteViewPanelConfig.tsx` — tab hint
- `i18n.ts`, `index.ts`, tests, this report

---

## Success Criteria

✅ Every tag **edit** workflow has one home: **Properties**  
✅ Tags tab has a **distinct** purpose: **browse + filter**  
✅ No duplicate CRUD between Properties and Tags tab
