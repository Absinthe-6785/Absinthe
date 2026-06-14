# K-40 First-Run Audit

**Branch:** `k40-cosmos-validation`  
**Scope:** Audit only — no onboarding implementation.

---

## What a New User Sees

### Empty vault

- Cosmos view: empty state headline (“Your knowledge cosmos begins here”)
- Discover tab: “No discoveries yet” empty state
- Insights/Actions: empty or minimal
- HUD: zero counts

### First 5–10 notes (unlinked)

- Cosmos: scattered moons, few links, mostly **isolated** classification
- Discover: possible **weak hub** or **emerging topic** if tags cluster
- Galaxy metaphor may confuse without links

### After linking + areas

- Galaxies form around areas/folders
- Hub notes appear as stars
- Discover feed populates with actionable items

---

## Can They Understand Without Documentation?

| Concept | Understandable? | Gap |
|---------|-----------------|-----|
| **Galaxy** | Partial | Metaphor clear in empty state copy; needs linked notes to see |
| **Hub** | Partial | Tier labels (star/planet/moon) help; “hub” jargon in Discover |
| **Discovery** | Good | Section titles + reason blocks explain each item |
| **Actions** | Good | Buttons labeled Open / Create relation / Create hub |

---

## First-Run Friction Points

1. **Cosmos vs Network mode** — two graph modes; default Cosmos may overwhelm
2. **Insights vs Discover vs Actions** — three tabs; suite header helps but no guided tour
3. **Confidence/score** — improved in K-40 but still assumes user trusts numeric score
4. **Zero discoveries** — no hint to “link notes” or “create an area”

---

## Recommendations (K-41, not implemented)

- First-run Discover empty state: “Link notes in the same area to see connection suggestions”
- Optional 3-step Cosmos tooltip (galaxy → hub → discover)
- Highlight one high-confidence discovery on dashboard when feed non-empty

---

## Verdict

**Production-usable** for users who explore tabs. **Not self-explanatory** for galaxy/hub metaphor without creating linked notes first.
