# K-43 Real Vault Validation

Validation uses **deterministic builders** against vault structure — no synthetic scoring assumptions beyond existing K-36–K-42 logic.

---

## Vault sizes

| Profile | Expected behavior | Risks |
|---------|-------------------|-------|
| **Empty** | Cosmos welcome empty; `CosmosStartDashboard`; Discover healthy empty; Timeline empty | Good — K-41 covers |
| **Small (10–50)** | Local graph usable; Discover may be sparse; Timeline month mode works | Tab bar still crowded |
| **Medium (100–500)** | Full Cosmos performant with galaxy clustering; Discovery feed populated; Timeline area evolution | Repeated galaxy maps on `notes` change |
| **Large (500+)** | Search enrichment cost; dashboard builders sequential; graph scale policy applies | Memo chains on any note edit |

---

## Surface checks

### Cosmos
- Empty / unlinked / healthy phases resolve via `resolveCosmosVaultPhase`.
- HUD actions route to Actions, Discover, Timeline panels.

### Discovery
- Healthy vault shows `k41DiscoverHealthyTitle` — not a dead end.
- First discovery banner + Why blocks explain recommendations.

### Timeline
- Snapshots approximate growth via `createdAt <= periodEnd` (no historical delete tracking).
- Read-only — milestones do not navigate (documented limitation).

### Search
- Note rows show importance + discovery flags when service attached.
- Projects/paths unaffected by cosmos enrichment.

---

## Planner gap

Planner embeds a minimal note editor **without** Knowledge Context panel. Users editing only in Planner miss Cosmos suite entirely. Documented; no change in K-43 (out of scope).

---

## Archive vs Knowledge Timeline

| | Archive Timeline | Knowledge Timeline |
|--|------------------|-------------------|
| Data | Marks, milestones, daily notes | Note/link/hub counts over periods |
| Entry | Archive sidebar tab | Notes context panel |
| K-43 | Label key `k43ArchiveTimelineLabel` documented | Tooltip `k43KnowledgeTimelineLabel` |

---

## Findings

No blocking bugs found in builder logic for typical vault shapes. Primary UX gaps are navigational (dead-end timeline rows, Planner isolation) rather than incorrect metrics.
