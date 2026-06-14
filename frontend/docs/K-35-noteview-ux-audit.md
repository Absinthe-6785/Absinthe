# K-35 — NoteView UX Audit

**Branch:** `k35-noteview-modernization`  
**Scope:** Note creation, switching, editing, metadata, links, graph, outline

---

## Executive summary

NoteView is the daily center of Absinthe but suffered from hidden context panel (default off), fragmented right-side tabs, hardcoded strings, and context (area, project, path, review) visible only in workspace dashboards — not in the note chrome.

K-35 addresses discoverability and information architecture without schema or rendering changes.

---

## Workflows audited

| Workflow | Finding | Severity | K-35 action |
| -------- | ------- | -------- | ----------- |
| **Note creation** | Quick capture + sidebar new note work; context panel stays hidden | P2 | Context strip shows tier/connections immediately after create |
| **Note switching** | List + search solid; context resets per note | OK | Context strip + panel header clarify "this note" |
| **Note editing** | Block editor mature; toolbar search still had Korean in places (prior debt) | P2 | i18n pass on header chrome |
| **Metadata editing** | Flat key-value list felt technical | P1 | Grouped properties (study / source / metadata) + onboarding hints |
| **Links workflow** | Seven stacked panels with no group hierarchy | P1 | `LinksContextPanel` groups: structure / connections / sources |
| **Graph workflow** | Full Cosmos (Ctrl+G) disconnected from panel graph tab | P1 | `CosmosContextFooter` + context strip Cosmos chip |
| **Outline workflow** | Korean empty state despite i18n keys | P0 | Extracted `OutlinePanel` with localized empty state |

---

## Friction points (before K-35)

### Unnecessary clicks

1. **Right panel hidden by default** — users must find AlignLeft toggle to see outline, links, properties.
2. **Review state only on workspace dashboard** — no signal on the note itself.
3. **Project / learning path context** — required opening Properties or Links tab.

### Hidden actions

- Cosmos neighborhood graph buried in 7-tab bar with equal visual weight.
- Concept relations vs generic relations split across Links and Relations tabs (documented; not merged in K-35).

### Duplicated controls

- Tag display in header + Tags tab + Stats tag cloud (intentional at different depths; header now collapses overflow).
- `LinkedReferencesPanel` unused while split panels active (legacy; no change).

### Weak discoverability

- No "where does this note belong?" strip under title.
- Properties empty state did not suggest common keys.
- Outline empty state was non-English hardcode.

---

## K-35 improvements delivered

| Item | Component / file |
| ---- | ---------------- |
| Knowledge Context panel shell | `KnowledgeContextPanel.tsx` |
| Context awareness strip | `NoteContextStrip.tsx` |
| Grouped links | `LinksContextPanel.tsx` |
| Outline extraction + i18n | `OutlinePanel.tsx` |
| Properties grouping | `NotePropertiesPanel.tsx`, `propertyGroups.ts` |
| Cosmos panel bridge | `CosmosContextFooter.tsx` |
| Header i18n + tag overflow | `NoteView.tsx` |

---

## Remaining backlog (K-36+)

- Extract `NoteHeader` from `NoteView.tsx` monolith (~3,400 lines).
- Merge Relations tab mental model with Links structure group or rename tabs.
- First-visit banner when context panel never opened (localStorage FTUE).
- Default right panel visible on desktop (product decision).
- Localize permanent-delete confirm in trash panel.

---

## References

- `K-30.33-note-ux-audit.md`
- `K-33.2-cosmos-information-architecture.md`
- `K-34-foundation-cleanup.md` §7 K-35 backlog
