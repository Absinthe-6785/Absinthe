# K-31 — Accessibility Audit

**Branch:** `k31-product-stabilization`  
**Scope:** Task I

---

## Baseline (K-30.56)

Major a11y work landed in K-30.56: skip links, modal focus traps, landmark roles, 44px touch targets on tablet.

---

## Keyboard Navigation

| Area | Status | Notes |
| ---- | ------ | ----- |
| NoteView block editor | Strong | Arrow/block nav, slash menu |
| Workspace search palette | Strong | Full keyboard list (K-30.56) |
| Sidebar tabs | OK | Focusable buttons |
| Planner calendar modes | OK | Mode switcher buttons |
| TOC outline | Weak | Click-only; no j/k section jump |
| Archive home | Weak | Heatmap cells not keyboard-operable |

---

## Focus Order

- Skip links → sidebar → main content — correct on NoteView.
- Modal open restores focus on close (`useModalA11y`) — verified pattern.
- Right-panel drawer on tablet: focus can escape to background (P2).

---

## Focus Traps

- Confirm dialogs, schedule modals, shortcuts modal, search palette — trapped.
- NoteView color picker dropdown — no trap (acceptable for popover).

---

## ARIA Usage

| Element | ARIA |
| ------- | ---- |
| NoteView `<main>` | `tabIndex={-1}` for skip target |
| Sidebar buttons | `aria-label` from i18n |
| TOC collapse | `aria-label` expand/collapse |
| Calendar shell | `aria-label` on nav |
| Graph nodes | Limited — mostly visual |

---

## Screen Reader Support

- Live regions for sync status — partial.
- Block types announced inconsistently in reading mode.
- Archive heatmap — no textual equivalent for density.

---

## K-31 Impact

- Outline navigation fix improves **keyboard-adjacent** UX (click targets scroll reliably with virtualization).
- Planner headers now i18n — screen readers get localized names when language set.

---

## Priority Backlog

| Item | Priority |
| ---- | -------- |
| TOC keyboard navigation | P1 |
| Archive heatmap aria grid | P1 |
| Graph node labels as accessible names | P2 |
| Planner mobile tab `aria-current` | P2 |

---

## Score

**6.5/10** — Modals/search strong; content surfaces (TOC, Archive, Graph) lag.
