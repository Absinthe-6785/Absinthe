# K-35 — Validation Checklist

**Branch:** `k35-noteview-modernization`

---

## Automated gates

- [x] `npm run typecheck` — 0 errors
- [x] `npm run build` — PASS
- [x] `npm run test` — 1785 / 1785

---

## Note header (Task E)

- [ ] Title edits save correctly (composition-safe input unchanged)
- [ ] Folder + classification selectors work on desktop
- [ ] Header wraps on mobile without clipping primary actions
- [ ] Tags: 10+ tags show "+N more" expand/collapse
- [ ] Sync status shows localized "Syncing…"
- [ ] Star / copy / export tooltips localized

---

## Context strip (Task F)

- [ ] Area hub note shows "Area hub" chip
- [ ] Note with `area` property shows area label
- [ ] Milestone / linked project shows project chip (navigates to project)
- [ ] Note in learning path shows path label (opens Links tab)
- [ ] Note in review queue shows "Review suggested"
- [ ] Tier chip reflects backlinks (3+ = core, 10+ / area / starred = star)
- [ ] Connections chip opens Links tab with counts > 0
- [ ] Cosmos chip opens context panel graph tab

---

## Knowledge Context panel (Task B)

- [ ] Panel title "Knowledge context" + subtitle visible
- [ ] All seven tabs switch content without error
- [ ] Tab icons 12px, labels readable on tablet width
- [ ] Mobile drawer opens/closes with backdrop (compact chrome)

---

## Outline tab (Task C)

- [ ] Headings from `#` blocks appear with H1/H2/H3 labels
- [ ] Empty state: localized "No headings yet" + toggle hint
- [ ] j/k/Enter keyboard navigation still works
- [ ] Collapse toggles hide child headings

---

## Links tab (Task D)

- [ ] Three groups visible: Structure / Connections / Sources
- [ ] Group counts reflect content
- [ ] Backlinks show excerpts when present
- [ ] Concept hub "Concept" badge localized
- [ ] Empty panels show Cosmos hints

---

## Properties tab (Task C)

- [ ] Empty state shows onboarding + common key hint
- [ ] Properties grouped: Study / Source / Metadata
- [ ] Add property with key `status` lands in Study group
- [ ] Add property with key `author` lands in Source group
- [ ] Edit/delete property still works
- [ ] Project / milestone editors still appear when applicable

---

## Cosmos tab (Task G)

- [ ] Local graph renders for connected notes
- [ ] Empty graph shows localized empty message
- [ ] Footer hint + "Open full Cosmos view" opens full graph mode
- [ ] Full Cosmos view (header toggle) unchanged

---

## Tags / Relations / Stats tabs

- [ ] Tags panel add/remove/filter unchanged
- [ ] Relations panel add/remove unchanged
- [ ] Stats numbers match note body

---

## Visual consistency (Task H)

- [ ] Section headers consistent across Outline, Links groups, Properties
- [ ] No Korean hardcodes in outline empty state
- [ ] Spacing rhythm: 8–10px section padding

---

## Regression smoke

- [ ] Create note → edit body → save
- [ ] Switch notes → context strip updates
- [ ] Trash note → restore
- [ ] Focus preset → exit focus label localized
- [ ] Workspace dashboard still opens from sidebar

---

## Sign-off

| Role | Date | Notes |
| ---- | ---- | ----- |
| Dev | 2026-06-13 | Automated gates PASS |
| QA | | Manual checklist above |
