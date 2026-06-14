# K-35 — Cosmos Integration Audit

**Branch:** `k35-noteview-modernization`

---

## Problem

Cosmos (spatial knowledge view) felt disconnected from daily note editing:

- Full Cosmos requires toggling view mode or Ctrl+G
- Panel graph tab showed local neighborhood without explaining full Cosmos
- Tier (star/planet/moon) visible only in graph rendering, not note chrome
- No inline path from "I'm editing" → "show me connections"

---

## Entry points (inventory)

| Entry | Location | K-35 status |
| ----- | -------- | ----------- |
| Header view toggle | Reading \| **Cosmos view** | Unchanged — opens full `NoteGraphView` |
| Context panel Cosmos tab | `LocalGraphView` neighborhood | **Enhanced** — footer CTA to full view |
| Context strip Cosmos chip | `NoteContextStrip` | **New** — opens panel graph tab |
| Context strip tier chip | Star / Core / Supporting | **New** — opens panel graph tab |
| Connections chip | Opens Links tab | **New** |
| Workspace dashboard | `wsOpenCosmos` | Unchanged (out of scope) |
| Slash / wiki links | In-editor | Unchanged |

---

## K-35 integration changes

### 1. Context strip tier badge

Uses `classifyGraphNodeTier()` with:

- Incoming backlink count
- Area hub flag
- Starred (pinned hub) flag

Labels: Star note / Core note / Supporting note — aligned with K-33 tier legend.

### 2. Cosmos context footer

On panel graph tab, below `LocalGraphView`:

- Hint copy (`k35CosmosPanelHint`) — galaxies, stars mental model
- Button: **Open full Cosmos view** → sets `viewMode = 'graph'`

### 3. Terminology

All new strings use Cosmos vocabulary (not "graph" in user-facing EN labels).

---

## Relationship creation shortcuts

Not added in K-35 (no schema change). Existing paths:

- Wiki `[[link]]` in editor
- Concept relations in Links → structure group
- Generic relations in Relations tab
- Reading source link in Sources group

**Backlog:** Quick-add relation from context strip (K-36).

---

## What was not changed (out of scope)

- `NoteGraphView` rendering / universe mode
- `knowledgeUniverse/*` galaxy clustering
- Graph scale policy
- Backend / sync

---

## Verification scenarios

1. Open note with backlinks → tier chip shows Core or Star; click opens panel Cosmos tab
2. Panel Cosmos tab → footer opens full Cosmos view
3. Empty local graph → empty state + footer still visible
4. Area hub note → tier chip shows Star note / Area hub chip

---

## Files

- `NoteContextStrip.tsx`
- `CosmosContextFooter.tsx` (in `LinksContextPanel.tsx`)
- `NoteView.tsx` (wiring, tier memo)
- `graphNodeTier.ts` (read-only use)
