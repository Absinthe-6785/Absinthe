# K-31 — TOC Keyboard Navigation Audit (Pass 5)

**Branch:** `k31-product-stabilization`  
**Scope:** Outline / TOC panel keyboard navigation (P0)

---

## Requirements

| Key | Action |
| --- | ------ |
| `j` | Next visible heading |
| `k` | Previous visible heading |
| `Enter` | Open (scroll to) heading |

Must respect collapsed TOC sections, sync active heading with scroll spy, and work with virtualized editor scroll via `navigateToHeading` + `scrollToBlockId`.

---

## Implementation

| Area | Location | Notes |
| ---- | -------- | ----- |
| Keyboard index math | `tocKeyboardNavigation.ts` | Pure helpers; unit tested |
| TOC panel wiring | `NoteView.tsx` | `role="listbox"`, `tabIndex={0}`, j/k/Enter |
| Scroll + flash | `outlineNavigation.ts` | Existing; H1–H4 + toggle headings |
| Active sync | `useTocScrollSpy.ts` + `highlightedTocIdx` | Keyboard focus overrides until Enter or note change |
| Virtual scroll | `virtualScrollApiRef` → `scrollToBlockId` | Unchanged pass 3 path |

---

## Regression Tests

- `tocKeyboardNavigation.test.ts` — j/k/Enter index resolution, collapsed skip
- `outlineNavigation.test.ts` — toggle headings H1–H4, virtual scroll handoff

---

## Remaining Gaps

- TOC panel must be focused (`Tab` into listbox) before j/k — no global shortcut when editor focused
- TOC header copy still Korean literals in NoteView (separate localization pass)

---

## Status

**Done** — keyboard navigation shipped for visible TOC rows with scroll-spy sync and virtualization support.
