# K-31 — Database & Properties Localization Audit

**Branch:** `k31-product-stabilization`  
**Scope:** P0 — pass 3

---

## Fixed in Pass 3

| Surface | Keys / API |
| ------- | ---------- |
| View switcher | `dbViewTable`, `dbViewBoard`, `dbViewCalendar`, `dbViewTimeline`, `dbViewGallery`, `dbViewLabel` |
| Empty states | `dbEmptyMessage`, `dbTimelineEmptyMonth` via `getDatabaseEmptyMessage(lang)` |
| Property field presets | `getDatabasePropertyFieldPreset(key, lang)` — group-by, date, timeline, gallery, columns |
| Page properties panel | `propPageProperties`, `propNone`, `propAddProperty`, `propKey`, `propValue`, `propDeleteProperty` |
| Tags panel | `tagPageTags`, `tagNone`, `tagAddPlaceholder`, `tagClickFilterHint` |
| Workspace subtitles | `presentationLabel(presentation, language)` in `resolveWorkspaceRef` |

---

## Files Touched

- `databasePresentationMeta.ts` — localized helpers + deprecated English constants for tests
- `DatabasePresentationSwitcher`, `DatabaseViewsSection`, all `Database*View` components
- `databaseControls/*ViewControls.tsx`
- `NotePropertiesPanel.tsx`, `NoteTagsPanel.tsx`
- `useNoteWorkspace.ts` — passes `language` into resolve context

---

## Remaining English (Acceptable)

| Item | Reason |
| ---- | ------ |
| Suggested property keys datalist | Technical identifiers (`status`, `reviewDate`) |
| Formula / rollup control labels | Not in pass 3 scope |
| Board lane keys | User-defined property values |
| `UNTITLED_NOTE_LABEL` | Shared note display constant |

---

## Success Criteria

| Criterion | Status |
| --------- | ------ |
| Table/Board/Gallery/Calendar/Timeline labels localized | Met |
| “No matching notes” localized | Met |
| Properties panel English removed | Met |
| Audit doc | Met |
