# K-43 Discoverability Audit

Cosmos suite surfaces: **Cosmos**, **Insights**, **Actions**, **Discover**, **Timeline**.

---

## Can a first-time user discover these?

| Surface | Discovery path | First-time visibility |
|---------|----------------|----------------------|
| Cosmos (full) | Empty note CTA, Ctrl+G, dashboard tour, context strip | Good when vault has notes |
| Cosmos (local) | Links tab footer, context strip chip | Hidden vs full Cosmos — same label |
| Insights | Context panel tab (11 tabs, scroll) | Moderate — crowded tab bar |
| Actions | Context panel tab; HUD “Review weak areas” | Moderate |
| Discover | Tab; dashboard card; HUD; healthy empty hints | Good after K-41 onboarding |
| Timeline | Tab; dashboard card; HUD evolution block | Moderate — label collision with Archive |

---

## Why / when / how they relate

**Intended mental model:**

```
Notes → Links (structure)
      → Cosmos (spatial map)
      → Insights (understand this note)
      → Actions (do something)
      → Discover (vault-wide opportunities)
      → Timeline (vault-wide evolution)
```

**Gaps found:**

1. Panel subtitle (pre-K-43) omitted Timeline and implied all tabs were note-scoped.
2. Product tour covers Cosmos + Discover but not Timeline explicitly.
3. Insights “knowledge gaps” are informational only — no action affordance.
4. Archive **Timeline** tab uses same i18n word as Knowledge **Timeline** tab.

---

## Fixes applied (K-43)

- Updated `k35ContextPanelSubtitle` to list all seven cosmos-suite adjacent tabs including timeline.
- Added `k43KnowledgeTimelineLabel` tooltip on Timeline context tab.
- Added `k43ContextPanelSelectNote` when user switches to note tabs without an open note.
- Localized `k41EmptyCosmosUnlinkedBody` (no English product names in ko/ja).

---

## Recommendations (not implemented — K-44+)

- Link Timeline milestones / area rows to notes or Discover.
- Single “Cosmos suite” grouped tab bar (collapse legacy Properties/Tags or move to overflow).
- Planner banner: “Open in Notes for Links & Cosmos.”
- Extend product tour with Timeline step.
