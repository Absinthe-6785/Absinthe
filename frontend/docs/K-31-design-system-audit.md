# K-31 — Design System Audit

**Branch:** `k31-product-stabilization`  
**Scope:** Task D — visual cohesion (P1)

---

## Summary

Absinthe uses a consistent **Absinthe token layer** (`rounded-absinthe-*`, `shadow-absinthe-*`, sidebar/card themes) on Planner and Archive shells, but **NoteView remains a parallel design dialect** (inline styles + `buildNoteChrome` colors). The product reads as two apps stitched together rather than one system.

---

## Cards & Panels

| Surface | Pattern | Cohesion |
| ------- | ------- | -------- |
| Planner calendar | `rounded-[24px] lg:rounded-[32px]` + theme.card | Strong |
| Archive home | ArchiveShell cards, heatmap grid | Strong |
| NoteView editor | Flat scroll pane, minimal radius | Weaker |
| Workspace dashboard | Mixed card radii (16–24px) | Medium |

**Finding:** Planner/Archive share Tailwind card language; NoteView uses bespoke px values (`NOTE_RADIUS_CARD`).

---

## Spacing

- Planner sections: consistent `p-5 lg:p-6`, `gap-4`.
- NoteView: asymmetric padding (`24px 0 80px` body, `8px 0` TOC).
- Workspace panels: dense on tablet (`38%` width) — functional but cramped.

---

## Typography

- Planner headings: `font-heading` utility — clear hierarchy.
- NoteView title: custom font size from settings; block headings via block editor.
- Archive section headers: smaller caps-style labels — third hierarchy tier.

**Gap:** No shared `text-display / text-title / text-body` scale across tabs.

---

## Accent Usage

- Primary purple (`primary`) consistent in Planner/Archive/Sidebar active state.
- NoteView accent from `appSettings.notesAccentColor` — user override breaks cross-tab cohesion (intentional but visible when switching tabs).

---

## Empty States

- K-30.53 improved trace/archive empties; Archive home still shows heatmap grid with weak CTA (K-30.34).
- Planner calendar modes: now localized empty copy (K-31).
- NoteView graph/links empty states: icon + muted text — OK.

---

## Border Radius

| Token | Usage |
| ----- | ----- |
| `rounded-absinthe-2xl` | Sidebar |
| `rounded-[24px/32px]` | Planner cards |
| `6px` | Block editor shells |
| `0` | Some note list rows |

---

## Panel Structure

- NoteView: left list | center editor | right TOC — classic PKM.
- Planner: calendar shell + legacy 3-column — **dual structure** reduces cohesion.
- Archive: single-column home — cleanest shell.

---

## Coherence Score

**6/10** — Strong within Planner/Archive; NoteView and Workspace feel like a different product generation.

---

## Quick Wins (allowed in stabilization)

1. Align NoteView panel border-radius to `rounded-absinthe-lg` on right drawer.
2. Unify section header font size (13px → 12px labels) in workspace panels.
3. Use `theme.card` equivalent in NoteView dropdown menus where feasible.

---

## Out of Scope (K-31 limits)

- Full NoteView Tailwind migration.
- Dashboard redesign.
