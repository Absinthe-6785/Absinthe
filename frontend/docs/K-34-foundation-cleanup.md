# K-34 — Foundation Cleanup

**Branch:** `k34-foundation-cleanup`  
**Builds on:** K-33.3 Cosmos Experience, K-34 Typecheck Zero Sprint

---

## Summary

K-34 completes the polish pass before future Cosmos evolution (K-35+). No architecture changes, no new features — only localization, terminology alignment, dashboard maintainability, and documentation.

**Verification (final):**

```text
Typecheck: PASS (0 errors)
Build:     PASS
Tests:     PASS (1785 / 1785)
```

---

## 1. Localization Audit

### Completed (K-34)

| Surface | Keys / approach |
| ------- | ---------------- |
| **UnifiedWorkspaceDashboard** | Tab labels, section headers, aria-label — `wsTab*`, `wsRecentActivityInsights`, reused `wsKnowledgeReview`, `wsLearningPaths`, etc. |
| **30 knowledge dashboard panels** | Full i18n — collections, saved views, project/learning path editors, review queues, health panels, linked references, pinned/recent workspaces |
| **LocalGraphView** | `graphLocalOpen`, `graphConnectionCount`, `graphPreview`, `graphNoConnectedNotes` |
| **NoteGraphView** | `graphSearchNodes` search placeholder |
| **Block editor UI** | SelectionToolbar, WikiMenu, Question/Citation/Math/Mermaid/Code/Footnote/Audio/Image/Table blocks, ShortcutHelpOverlay |
| **Prior K-33.3** | WorkspaceDashboardView, Study/Research dashboards, slash menu, links panels, graph HUD |

### Key count

- **~127 keys** added in K-34 knowledge workspace block
- **~27 keys** added for block editor UI (K-34 pass 2)
- All keys provide **en / ko / ja** parity

### Remaining debt (non-user-facing)

| Item | Severity | Notes |
| ---- | -------- | ----- |
| Code comments in Korean | P3 | Developer-only; no UI impact |
| `blockUtils.ts` `BLOCK_TYPE_MENU` keyword metadata | P3 | Slash display uses `blockEditorLabels`; search keywords still Korean-biased |
| `editorShortcuts.ts` section labels | P2 | Shortcut overlay content may still mix languages — audit if shortcut help is localized end-to-end |
| Internal module names (`knowledgeUniverse/`) | P3 | Code-only; documented in terminology section |

**User-facing Korean in `components/views/**/*.tsx` attribute strings: none remaining.**

---

## 2. Terminology Consistency

### Canonical vocabulary (product)

| Term | User-facing label (EN) | Avoid |
| ---- | ---------------------- | ----- |
| **Cosmos** | Cosmos / Knowledge Cosmos | Universe, Knowledge Graph |
| **Cosmos view** | Cosmos view | Graph (nav label) |
| **Network** | Network | Classic graph |
| **Galaxy** | Galaxy (graph HUD) | Cluster (user-facing) |
| **Constellation** | Hint copy only | Replacing "Learning path" in panel titles |
| **Learning path** | Learning path | — (familiar productivity term) |
| **Star / Planet / Moon** | Tier legend | Hub / core / supporting (secondary) |
| **Concept** | Concept | Topic, entity |
| **Note** | Note | Node |
| **Area** | Area (property key) | Galaxy in property storage |

### Applied in K-34

| Key | Before (EN) | After (EN) |
| --- | ----------- | ---------- |
| `nvGraph` | Graph | **Cosmos view** |
| `nvGraphMode` | Graph (Ctrl+G) | **Cosmos (Ctrl+G)** |
| `nvScGraph` | Open graph | **Open cosmos** |
| `wsOpenGraph` → `wsOpenCosmos` | Open cosmos | Open cosmos (key renamed) |

### Still internal (K-35+ optional)

- `cosmosUniverseTitle` i18n key name (value is correct: "Knowledge Cosmos")
- `knowledgeUniverse/` module path and `isUniverseMode()` function names
- `wsKnowledgeClusters` label ("Knowledge clusters" — dashboard analytics; not Cosmos Galaxy)

See also: [K-33.3-terminology-consistency.md](./K-33.3-terminology-consistency.md)

---

## 3. Dashboard Cleanup Review

### UnifiedWorkspaceDashboard

**Before:** Hardcoded Korean tab labels and section headers; duplicated inline styles.

**After:**
- All strings via `useTranslation()`
- `DashboardSectionTitle` helper — single style for section headers
- Tab labels driven by `wsTabOverview` / `wsTabLearning` / `wsTabResearch` / `wsTabProjects`

**Duplication note:** `WorkspaceDashboardView` still renders individual dashboard cards when `unified` prop is absent. This is intentional — compact vs full dashboard modes. No merge in K-34 (would be architectural).

### Study / Research dashboards

Fully localized in K-33.3; no structural changes in K-34.

### SubjectWorkspacePanel

- Section titles via i18n
- `sectionId` prop for edit-button visibility (avoids comparing localized title strings)

---

## 4. First-Time Experience Audit

### What users understand immediately

| Surface | Teaching mechanism |
| ------- | ------------------ |
| Cosmos graph empty state | Tier legend + headline/subline |
| Links panel empty sections | `CosmosEmptyHint` secondary lines |
| Properties panel empty | `propCosmosOnboarding` |
| Mode toggle | Network vs Cosmos labels |
| Unified dashboard tabs | Overview / Learning / Research / Projects |

### What still benefits from exploration

| Gap | Recommendation (K-35) |
| --- | ------------------------ |
| Cosmos vs Network meaning on first visit | One-time dismissible banner on first Cosmos toggle |
| Learning path = Constellation metaphor | Wire `knCosmosHintLearningPath` in path editor empty state |
| Tier assignment is implicit | Read-only tier badge in note header |
| Area property vs Galaxy | Subtitle on area property: "Galaxy (area)" |

See: [K-33.3-onboarding-recommendations.md](./K-33.3-onboarding-recommendations.md)

---

## 5. Navigation Consistency Review

### Aligned

| Location | Label (EN) |
| -------- | ---------- |
| Note view mode tab | Cosmos view |
| Mode shortcut tooltip | Cosmos (Ctrl+G) |
| Empty note CTA | Open cosmos |
| Workspace quick action | Open cosmos (`wsOpenCosmos`) |
| Graph HUD title | Knowledge Cosmos |
| Graph mode toggle | Network / Cosmos |

### Navigation flow

```text
Sidebar → Note → Links panel     (relationship detail)
Note → Cosmos (Ctrl+G)           (spatial view)
Dashboard → Open cosmos          (workspace entry)
Search → Note                    (direct navigation)
```

All primary navigation paths now use Cosmos vocabulary for the graph view.

---

## 6. Cleanup Summary

| Deliverable | Status |
| ----------- | ------ |
| Localization cleanup | ✅ Knowledge dashboards + block editor UI |
| Terminology alignment | ✅ Nav and graph labels |
| Dashboard maintainability | ✅ Unified dashboard i18n + SectionTitle helper |
| Navigation consistency | ✅ Cosmos naming |
| Documentation | ✅ This document + K-33.3 companions |
| typecheck / build / test | ✅ All pass |

---

## 7. Remaining Debt (K-35 backlog)

1. First-visit Cosmos banner (localStorage flag)
2. Learning path editor constellation hint
3. Note header tier badge (Star/Planet/Moon)
4. i18n key renames: `cosmosUniverseTitle` → `cosmosTitle`
5. Module rename: `knowledgeUniverse/` → `knowledgeCosmos/` (internal)
6. `editorShortcuts.ts` full localization
7. `blockUtils` slash search keywords — language-aware metadata

---

## Document Index

| Doc | Purpose |
| --- | ------- |
| `K-34-foundation-cleanup.md` | This document |
| `K-33.3-cosmos-ux-audit.md` | UX findings |
| `K-33.3-terminology-consistency.md` | Vocabulary decisions |
| `K-33.3-onboarding-recommendations.md` | FTUE roadmap |
| `K-33.3-cosmos-user-mental-model.md` | Navigation + hierarchy |
| `K-33.2-cosmos-information-architecture.md` | Panel order + mapping |

---

## K-35 Readiness

Absinthe is in its most polished and internally consistent state to date:

- Zero TypeScript errors
- Full test suite green
- User-facing strings centralized in `i18n.ts`
- Cosmos terminology aligned in navigation and graph surfaces
- Dashboard panels localized and section structure simplified

K-35 can focus on Cosmos evolution features (tier badges, constellation overlay, relation picker examples) without carrying localization or terminology debt.
