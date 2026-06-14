# K-41 First-Run Review

**Branch:** `k41-cosmos-onboarding`

---

## New User Journey (Post K-41)

### Step 1 — Open app, 0 notes

- Dashboard shows **Start your Cosmos** checklist + product tour
- Cosmos view: welcome empty state + Create Note
- Discover: empty (no vault phase-specific healthy message yet)

**Understandable without docs:** ✅ partial — tour + checklist explain path

### Step 2 — Create notes, no links

- Cosmos: unlinked overlay + Learn about linking → opens Links panel
- Discover: hint about wiki links
- Insights: suggestions hint (existing)

**Understandable:** ✅ linking CTA is actionable

### Step 3 — Link notes

- Cosmos visualization appears
- Insights populate with tier + Why this tier?
- Discover: healthy message OR first discoveries

**Understandable:** ✅ tier explainer helps hub jargon

### Step 4 — First discovery

- Banner: “First Discovery Found — French Grammar ↔ French Verbs”
- Dismissible, never shown again (local)

**Understandable:** ✅ connects Discovery to value

---

## Product Tour (4 steps)

1. Notes — building blocks
2. Links — [[wiki links]]
3. Cosmos — visualization metaphor
4. Discovery — proactive suggestions

Skippable, non-blocking, persisted in localStorage.

---

## Remaining Friction (K-42)

- Editor inline link hint not implemented
- Tour does not highlight UI elements (text-only)
- Mobile: tour + empty states tested for touch targets; compact mode uses `touchMinSize`

---

## Verdict

**Cosmos is approachable** for users who follow dashboard checklist or tour. Galaxy/hub metaphor still benefits from linked notes before Cosmos view is meaningful.
