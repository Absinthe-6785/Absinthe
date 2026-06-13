# K-31 — Localization Pass 2 Audit

**Branch:** `k31-product-stabilization`  
**Scope:** P1 — rendered UI (pass 2)

---

## Fixed in Pass 2

| Surface | Fix |
| ------- | --- |
| Archive placeholders | `archiveViewUnavailable`, view mode labels via `getTranslator` |
| Archive empty CTA | `archiveEmptyCta` |
| Graph status bar | Korean hover hint |

**Pass 1 (prior commit):** Sidebar Archive, planner calendar headers, calendar empty range.

---

## Remaining Visible English (default `en` language)

| Area | Examples | Priority |
| ---- | -------- | -------- |
| NoteView chrome | Shows English when language=en (correct) | — |
| Database / properties panels | “Add tag”, “Value”, “Move up” | P1 |
| Graph status | “notes · links” counters | P2 |
| Archive projection | Luxon month labels | P2 |
| Health / Recipe tabs | Mostly i18n’d | P3 |

---

## Terminology Consistency

| Term | Canonical (ko) | Status |
| ---- | ---------------- | ------ |
| Archive | 아카이브 | Sidebar fixed |
| Workspace | 작업공간 | OK |
| Outline | 목차 | OK (`nvPanelToc`) |
| Analytics | — | Removed from UI |

---

## Policy Recommendation

Default language remains `en` in store — Korean users must switch in Settings. Consider locale detection or `ko` default for KR builds (product decision, out of scope).

---

## Success Criteria

| Criterion | Status |
| --------- | ------ |
| Archive English placeholders removed | Met |
| Obvious untranslated Archive strings fixed | Met |
| Pass 2 audit doc | Met |
