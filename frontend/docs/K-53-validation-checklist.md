# K-53 Validation Checklist

## Build & Tests

- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] `npm run test`

## Context Panel

- [ ] No note selected → Create note CTA works
- [ ] Links empty → Create wiki link opens note + links tab
- [ ] Insights empty → Open Cosmos switches to graph view
- [ ] Actions empty → Open Links / Open Discover
- [ ] Discover empty (healthy vault) → Open Cosmos CTA
- [ ] Timeline empty → Create note CTA
- [ ] Related notes empty → Wiki link + Cosmos CTAs

## Health Dashboard

- [ ] Nutrition shows goal consistency when target set
- [ ] Workout card shows recent sessions when data exists
- [ ] Habit card navigates to routine tab
- [ ] Workout card navigates to workout tab
- [ ] Recovery shows sleep avg when localStorage log exists

## Knowledge Dashboard

- [ ] Timeline card shows empty placeholder (not hidden)
- [ ] Discovery card shows empty placeholder (not hidden)

## Scientific Notes

- [ ] Inline math `$a^2+b^2=c^2$` round-trips via blockUtils
- [ ] Display math `$$\frac{-b\pm\sqrt{...}}{2a}$$` renders (mathRendering.test)
- [ ] Matrix `pmatrix` renders and is searchable
- [ ] LaTeX preserved in `serializeNoteMarkdown` export

## Regression

- [ ] Countdown reviewed state still syncs across schedule surfaces
- [ ] Protein tracker still uses shared `useProteinData`
- [ ] Existing user data / migrations unaffected
