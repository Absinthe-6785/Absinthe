# K-31 — Archive Navigation Audit (Pass 5)

**Branch:** `k31-product-stabilization`  
**Scope:** Home · Period · Area · Timeline discoverability (P1)

---

## Problem (Pass 4)

Branch views existed (`ArchiveBranchView`) but mode was fixed at mount — users could only reach Period/Area/Timeline via deep links or test overrides.

---

## Changes

| Change | File | Effect |
| ------ | ---- | ------ |
| In-app mode tabs | `ArchiveModeSwitcher.tsx` | Tablist with Home / Period / Area / Timeline |
| Shell wiring | `ArchiveShell.tsx` | `setMode` + switcher above content |
| Shared projection | `useArchiveHomeProjection` | Same data for all modes — no extra fetch |

---

## UX Goals

- **Reduce confusion:** One persistent tab bar; `data-archive-mode` reflects selection
- **Discoverability:** All four surfaces visible without sidebar hunting
- **Click depth:** Single tap to switch branch (was: unavailable in-app)

---

## Tests

- `archiveShell.test.ts` — `data-archive-mode-switcher`, `role="tablist"`, period branch still actionable

---

## Remaining Gaps

- Tabs do not sync URL / sidebar selection (deferred — no new routing system)
- Frame title/subtitle in projection still Korean literals

---

## Status

**Done** — lightweight tab switching shipped without new workflows.
