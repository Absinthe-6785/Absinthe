# Block Editor — Manual QA Checklist

Sprint F-0 regression guard. Run before merging editor PRs.

**Baseline:** `main` after Sprint E-2 (#38). UX should match unless the PR explicitly changes behavior.

---

## Document feel (E-1)

- [ ] Block borders/backgrounds stay minimal in edit mode
- [ ] Grip + menu handles appear **only on hover** (or when menu pinned/open)
- [ ] Placeholder text shows only on **active** empty block
- [ ] Document column width and font match Note settings

## List Enter & paste (E-1 / E-2)

- [ ] **Enter** on bullet/numbered/todo creates sibling of same type
- [ ] **Enter** on **empty** list item converts to paragraph
- [ ] Numbered list renumbers after split / exit
- [ ] Paste single line replaces selection correctly
- [ ] Paste multiline markdown creates multiple blocks (e.g. `- a\n- b`)
- [ ] Paste into list item: plain multiline inherits list type + indent
- [ ] Paste selection + URL → `[selection](url)` markdown link
- [ ] Paste from rich text (browser) falls back to plain when needed

## Toggle hierarchy (E-2)

- [ ] Toggle children show **left tree rail**
- [ ] Chevron rotates; collapse/expand persists after reload
- [ ] Empty toggle shows “내용 추가…” and creates child on click
- [ ] Enter in toggle header creates/focuses first child
- [ ] Enter in empty first child escapes to parent (when applicable)

## Active block (E-2)

- [ ] Focused block shows subtle **left accent bar** (not toggle header)
- [ ] Very light focus background; no heavy border ring

## Drag & drop

- [ ] Grip click (no move) opens block menu
- [ ] Drag shows **indent-aware** drop line + dot
- [ ] Drop before/after reorders siblings
- [ ] Drop on toggle header (lower area) or children zone nests inside toggle
- [ ] Dragged block fades while dragging

## Slash & context menu

- [ ] `/` opens slash menu at caret; filter works (`/h1`, `/todo`)
- [ ] Enter selects; Esc closes; outside click closes
- [ ] Grip menu / right-click: add, turn into, indent, delete
- [ ] Turn-into labels match slash display names

## Formatting & navigation

- [ ] Bold/italic/code toolbar on text selection
- [ ] `[[wiki]]` autocomplete on `[[`
- [ ] Arrow up/down moves between blocks
- [ ] Backspace at block start merges with previous
- [ ] Drag-select + Backspace deletes selection (live preview blocks)

## Search & read-only

- [ ] In-note search highlights matches
- [ ] Read-only mode: no handles, no edit chrome

## Shell / theme (E-0)

- [ ] Light + dark theme: accent purple, no gold/yellow leftovers in NoteView
- [ ] Health tab loads without console errors
- [ ] Backlink highlight uses theme accent (not hardcoded yellow)

---

## Automated gate (CI / local)

```bash
cd frontend && npm test && npm run build
```

Target: **200+** unit tests, build green.

---

## Sign-off

| Run | Branch | Tester | Date | Pass |
|-----|--------|--------|------|------|
|     |        |        |      | ☐    |
