# K-33 — Motion & Accessibility

---

## Reduced Motion

Respects `prefers-reduced-motion: reduce` via `usePrefersReducedMotion()`.

| Feature | Reduced motion ON |
| ------- | ----------------- |
| Orbital offset | Disabled — static physics layout |
| Star pulse CSS | Disabled (`animation: none`) |
| Active node pulse | Disabled |
| Force simulation | Unchanged (static after settle) |

CSS media query duplicates hook guard in inline `<style>` block inside `NoteGraphView`.

---

## Keyboard

Each graph node group exposes:

- `role="button"`
- `tabIndex={0}`
- `aria-label` — title, tier, backlink count, importance score
- `Enter` / `Space` → select note (same as click)

Focus ring: `:focus-visible` stroke on node circle.

Focus/hover sync: `onFocus` sets hover state for label visibility.

---

## Tooltips

Native SVG `<title>` plus bottom overlay on hover showing:

- Title
- Galaxy / area label
- Tier
- Backlink count
- Importance score

---

## Preserved

- Existing pan/zoom mouse interactions
- Search input keyboard access
- Relationship filter `<select>` native accessibility

---

## Tests

Indirect coverage via `graphViewMode.test.ts`, `orbitalLayout.test.ts` (reduced motion path).

Manual checklist: [K-33-validation-checklist.md](./K-33-validation-checklist.md)
