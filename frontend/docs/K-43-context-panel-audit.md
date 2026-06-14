# K-43 Context Panel Audit

**Shell:** `KnowledgeContextPanel.tsx`  
**Tabs defined in:** `NoteView.tsx` → `RIGHT_PANELS`

---

## Tab inventory

| Tab | Label key | Icon | Scope | Suite header |
|-----|-----------|------|-------|--------------|
| Outline | `nvPanelToc` | AlignLeft | Note | No |
| Links | `nvPanelLinks` | Link | Note | No |
| Cosmos | `nvGraph` | Orbit | Note | Footer only |
| Insights | `k36PanelInsights` | Lightbulb | Note | Yes |
| Actions | `k37PanelActions` | Zap | Note | Yes |
| Discover | `k38PanelDiscover` | Compass | Vault | Yes |
| Timeline | `k42PanelTimeline` | History | Vault | Yes |
| Properties | `nvPanelProperties` | SlidersHorizontal | Note | No |
| Tags | `nvPanelTags` | Tag | Note | No |
| Relations | `nvPanelRelations` | ArrowRightLeft | Note | No |
| Stats | `nvPanelStats` | # | Note | No |

---

## Consistency checks

| Check | Status | Notes |
|-------|--------|-------|
| Visual hierarchy | Partial | Cosmos suite uses gradient header; legacy tabs use `KnowledgePanelSection` only |
| Icon consistency | Pass | Lucide 12px throughout |
| Naming consistency | Improved | Subtitle now includes Timeline; tooltip disambiguates Archive vs Knowledge timeline |
| Spacing | Pass | 8–10px panel insets, 9px tab labels |
| Empty states | Improved | `KnowledgePanelEmpty` for note-required tabs without note; Discover/Timeline have dedicated empties |

---

## Duplication

- **Insights vs Actions:** shared “suggested connections” and “opportunities” sections — intentional overlap (read vs act); document in UI hints later.
- **Cosmos tab vs full graph:** same `nvGraph` label — context strip tooltip should emphasize “local neighborhood” (existing `k35CosmosOpenLocal`).

---

## Visibility rule

Panel shows when `(activeNote || discover || timeline) && !graph && showRightPanel && !focusHide`.

K-43: note-required tabs show `k43ContextPanelSelectNote` instead of blank body.

---

## Width / density

- Panel width: 210px (tablet) / 230px (desktop).
- 11 tabs → horizontal scroll; labels truncate at 9px.
- Recommendation: overflow menu for legacy tabs (K-44).
