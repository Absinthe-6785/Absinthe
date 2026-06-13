# K-33 — Orbital Layout

---

## Scope

Optional **Universe mode** visualization — a calm “knowledge solar system,” not toy animation.

---

## Hierarchy (`assignOrbitHierarchy`)

Per galaxy:

| Tier | Orbits |
| ---- | ------ |
| Star | Fixed anchor (no parent) |
| Planet | Galaxy anchor star |
| Moon | Connected planet, else star, else anchor |

Orbit parameters:

- Planet radius: 28px offset scale (×0.35 applied at render)
- Moon radius: 14px
- Speeds: `0.00006` / `0.0001` rad/ms

---

## Render (`computeDisplayPosition`)

Display position = **physics position** + subtle orbital offset.

Physics (`node.x`, `node.y`) remains the force simulation result; orbit is a visual layer only.

Disabled when:

- Network mode
- `prefers-reduced-motion: reduce`
- Node has no orbit parent

---

## Animation Loop

After force simulation settles (`alpha < alphaFloor`), Universe mode continues RAF ticks **only** when reduced motion is off — keeps orbit motion alive without re-heating simulation.

---

## Diagram

```text
        ★ Star
    ●       ●   ← planets (slow orbit)
  ·     ·       ← moons (slower, tighter)
```

---

## Tests

`orbitalLayout.test.ts`
