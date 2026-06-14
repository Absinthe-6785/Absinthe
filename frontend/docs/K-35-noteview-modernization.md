# K-35 — NoteView Modernization

**Branch:** `k35-noteview-modernization`  
**Builds on:** K-34 Foundation Cleanup

---

## Summary

K-35 makes NoteView the coherent center of the Absinthe knowledge workspace. No schema changes, no Cosmos rendering changes — usability, discoverability, information architecture, and visual hierarchy only.

**Verification:**

```text
Typecheck: PASS (0 errors)
Build:     PASS
Tests:     PASS (1785 / 1785)
```

---

## Tasks completed

| Task | Priority | Deliverable |
| ---- | -------- | ----------- |
| A — NoteView UX audit | P0 | `K-35-noteview-ux-audit.md` |
| B — Right panel architecture | P0 | `KnowledgeContextPanel`, `KnowledgePanelSection`, `K-35-context-panel-audit.md` |
| C — Properties modernization | P1 | Grouped `NotePropertiesPanel`, `propertyGroups.ts` |
| D — Links experience | P1 | `LinksContextPanel`, `K-35-links-experience-audit.md` |
| E — Note header | P1 | i18n fixes, tag overflow (+N more), spacing via context strip |
| F — Context awareness | P1 | `NoteContextStrip` (area, project, path, review, tier, connections) |
| G — Cosmos integration | P1 | `CosmosContextFooter`, tier chip, `K-35-cosmos-integration-audit.md` |
| H — Visual consistency | P1 | 12px tab icons, shared section headers, panel title block |
| I — Documentation | — | This file + audit docs + validation checklist |

---

## New components

| Component | Path |
| --------- | ---- |
| `KnowledgeContextPanel` | `features/knowledge/components/KnowledgeContextPanel.tsx` |
| `KnowledgePanelSection` | `features/knowledge/components/KnowledgePanelSection.tsx` |
| `OutlinePanel` | `features/knowledge/components/OutlinePanel.tsx` |
| `LinksContextPanel` | `features/knowledge/components/LinksContextPanel.tsx` |
| `CosmosContextFooter` | same file as LinksContextPanel |
| `NoteContextStrip` | `features/knowledge/components/NoteContextStrip.tsx` |
| `propertyGroups` | `features/knowledge/properties/propertyGroups.ts` |

---

## i18n

~40 keys added under K-35 block in `frontend/src/lib/i18n.ts` (en/ko/ja).

Header regressions fixed: `nvSyncing`, `nvCopied`, `nvCopyDocument`, `nvStar`, `nvUnstar`, event/milestone/area titles.

---

## Success criteria mapping

| Criterion | How |
| --------- | --- |
| Understand where note belongs | Context strip: area, project, path, review |
| Discover related knowledge | Connections chip → Links; tier → Cosmos tab |
| Edit metadata naturally | Grouped properties + add hints |
| Navigate context quickly | Knowledge Context panel shell + grouped tabs |

---

## Out of scope (honored)

- Planner, Archive, Database Views redesign
- Cosmos rendering changes
- Backend / schema changes

---

## K-36 backlog

- Extract `NoteHeader` from `NoteView.tsx`
- Optional: default context panel open on desktop
- First-visit context panel FTUE banner
- Relations tab consolidation with Links structure group
- Localize trash permanent-delete confirm

---

## Related docs

- [UX audit](./K-35-noteview-ux-audit.md)
- [Context panel audit](./K-35-context-panel-audit.md)
- [Links experience audit](./K-35-links-experience-audit.md)
- [Cosmos integration audit](./K-35-cosmos-integration-audit.md)
- [Validation checklist](./K-35-validation-checklist.md)
