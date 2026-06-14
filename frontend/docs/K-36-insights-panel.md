# K-36 — Insights Panel

**Component:** `CosmosInsightsPanel.tsx`  
**Tab key:** `insights` in `KnowledgeContextPanel`

---

## Purpose

Primary **"What should I do next?"** surface for the active note — the intelligence counterpart to K-35's structural context panel.

---

## Tab placement

```text
Outline | Links | Cosmos | Insights | Properties | Tags | Relations | Stats
```

Icon: `Lightbulb` (12px) · Label: `k36PanelInsights`

---

## Sections

| Section | Content |
| ------- | ------- |
| Importance | Classification badge + score + connection summary |
| Knowledge context | Galaxy, area property, area health (score + category) |
| Suggested connections | Scored list with signal labels; click navigates |
| Knowledge opportunities | Action-oriented warnings with recommended next step |
| Potential knowledge gaps | Per-galaxy structural gaps for note's galaxy |

---

## Data source

```typescript
buildNoteIntelligenceSnapshot(activeNote, notes, knowledgeIndexService)
```

Recomputed when `activeNote` or `notes` change.

---

## Empty states

Each section uses `KnowledgePanelEmpty` + `CosmosEmptyHint` where appropriate (suggestions hint explains tag/wiki link path).

---

## Navigation hooks

- Suggested connection click → `setActiveNoteId`
- Opportunity with target → navigate to target
- Opportunity without target → open Links tab
