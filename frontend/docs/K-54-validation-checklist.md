# K-54 Validation Checklist

## Recovery

- [ ] Recovery tab shows log form (sleep hours, quality, notes, rest day)
- [ ] Save persists to localStorage and refreshes dashboard card
- [ ] Dashboard shows latest sleep, weekly avg, trend, latest note
- [ ] Week history list shows last 7 days

## Habits

- [ ] Habits tab shows quick panel with Complete / Undo
- [ ] 14-day history grid toggles completion
- [ ] Dashboard habit toggle still works
- [ ] Streak and rate update after toggle

## Health sections

- [ ] Nutrition: protein CRUD unchanged
- [ ] Workout: blocks/routines/save unchanged
- [ ] Recovery: dedicated layout (not workout clone)
- [ ] Dashboard deep-links to correct section

## Context actions

- [ ] "Create first wiki link" inserts `[[` with caret inside
- [ ] "Create related note" focuses title input
- [ ] "Open Cosmos" opens graph panel with current note context
- [ ] Full Cosmos footer still available from graph panel

## Schedule

- [ ] Countdown reviewed checkmarks sync across Schedule / Day / Agenda
- [ ] No duplicate countdown entries on same surface

## Regression

- [ ] `npm run typecheck` PASS
- [ ] `npm run build` PASS
- [ ] `npm run test` PASS
- [ ] Existing `absinthe:recovery-log` and `absinthe:habit-completions` data loads

## Automated tests added

- `recoveryNotes.test.ts` — CRUD, summary, trend, history
- `habitCompletion.test.ts` — history helper
