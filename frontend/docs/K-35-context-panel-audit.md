# K-35 — Context Panel Architecture Audit

**Branch:** `k35-noteview-modernization`

---

## Before: separate tools

The right aside exposed seven equal-weight tabs (Outline, Links, Cosmos, Properties, Tags, Relations, Stats) with:

- No panel-level title or purpose statement
- Mixed icon sizes (11px vs 10px hash)
- Inline TOC with Korean strings
- Per-panel section headers styled independently
- Default **hidden** (`showRightPanel = false`)

Tabs felt like unrelated utilities rather than a unified **Knowledge Context** for the active note.

---

## Target: Knowledge Context experience

Single mental model: *"Everything I need to understand and connect this note."*

### Shell (`KnowledgeContextPanel`)

| Element | Spec |
| ------- | ---- |
| Title | `k35ContextPanelTitle` — "Knowledge context" |
| Subtitle | One-line purpose (outline, links, cosmos, metadata) |
| Tab bar | `role="tablist"`, 12px icons, vertical icon+label stack |
| Width | 230px desktop / 210px tablet (slightly wider for labels) |
| Body | Scroll region shared by all tabs |

### Shared primitives (`KnowledgePanelSection`)

- Uppercase 10px section headers
- Accent count badges
- Optional hint (keyboard, field examples)
- `KnowledgePanelEmpty` for consistent empty copy

Used in: Outline, Links groups, Properties groups.

---

## Tab-by-tab alignment

| Tab | Header pattern | Empty state | Loading |
| --- | -------------- | ----------- | ------- |
| Outline | `KnowledgePanelSection` + count | `k35OutlineEmpty` + toggle hint | N/A (sync from blocks) |
| Links | Three group sections | Per sub-panel + `CosmosEmptyHint` | N/A |
| Cosmos | Local graph + footer CTA | `graphNoConnectedNotes` | N/A |
| Properties | Study / Source / Metadata groups | `propCosmosOnboarding` + `k35PropEmptyHint` | N/A |
| Tags | Existing `NoteTagsPanel` | `tagNone` | N/A |
| Relations | Existing `NoteRelationsPanel` | `knNoRelations` | N/A |
| Stats | Uppercase title (unchanged) | Implicit zeros | N/A |

---

## Spacing & typography rhythm

- Panel header: 8px vertical padding
- Tab bar: 8px padding, 2px accent underline
- Section headers: 10px uppercase, 700 weight
- Body text: 11px; hints: 9–10px `textFaint`
- Icon stroke: **12px** in tab bar and context strip

---

## Mobile / tablet

- `mobile-panel-drawer` class preserved on compact chrome
- Tab bar horizontal scroll when labels overflow
- Context strip wraps chips (`flexWrap: wrap`)

---

## Files

| File | Role |
| ---- | ---- |
| `KnowledgeContextPanel.tsx` | Shell |
| `KnowledgePanelSection.tsx` | Section header + empty |
| `OutlinePanel.tsx` | Outline tab body |
| `LinksContextPanel.tsx` | Links grouping |
| `CosmosContextFooter.tsx` | Cosmos tab footer |
