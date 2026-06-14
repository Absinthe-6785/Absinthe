# K-41 Validation Checklist

## Empty states

- [ ] 0 notes — Cosmos welcome + Create Note CTA
- [ ] Notes, 0 links — unlinked message + Learn about linking
- [ ] Linked, 0 discoveries — Discover healthy message
- [ ] Dashboard 0 notes — Start your Cosmos checklist

## First discovery

- [ ] Banner appears on first non-empty feed
- [ ] Dismiss hides banner permanently (localStorage)
- [ ] Non-modal (inline in Discover panel)

## Explainability

- [ ] Discovery cards show Why block + confidence + score
- [ ] Missing connections show signal bullets
- [ ] Insights show Why this tier? expandable
- [ ] Search results show tier hint for notes

## Glossary

- [ ] Cosmos suite header shows Cosmos · Discovery tooltips
- [ ] Start dashboard uses term tooltips

## Product tour

- [ ] 4 steps: Notes → Links → Cosmos → Discovery
- [ ] Skip completes tour
- [ ] Done completes tour
- [ ] Non-blocking (dashboard overview only)

## Mobile

- [ ] Discovery action buttons use touch min height
- [ ] Tour buttons use touch min height
- [ ] Empty state panels readable on narrow width

## Regression

- [ ] No discovery scoring changes
- [ ] No graph engine changes
- [ ] K-40 discovery calibration unchanged

## Verification

- [ ] `npm run typecheck` passes
- [ ] `npm run build` passes
- [ ] `npm run test` passes

## K-42 opportunities

- [ ] Spotlight tour (highlight UI elements)
- [ ] Discovery dismiss/snooze
- [ ] Editor inline link hint
